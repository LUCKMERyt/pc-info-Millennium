-- pc-info: Millennium plugin (Lua backend)
-- On Steam start: runs pc-info.ps1 (detects OS/CPU/GPU/RAM/disks/audio), which writes
-- <Steam>\steamui\pc-info\*.js and returns the data as JSON. The webkit module
-- (.millennium\Dist\webkit.js, injected into store pages by Millennium) builds the
-- "PC configuration" block and fills it with this data via GetPcInfo().

local logger = require("logger")
local millennium = require("millennium")
local utils = require("utils")
local fs = require("fs")
local ok_cjson, cjson = pcall(require, "cjson")

local JS_REL = "pc-info/pc-info.js"   -- relative to <Steam>\steamui
local last_json = ""                  -- result of the last detection (JSON)

local function trim_slashes(p)
    return (tostring(p or ""):gsub("[/\\]+$", ""))
end

local function backend_dir()
    local dir = utils.get_backend_path()
    if dir and dir ~= "" then return trim_slashes(dir) end
    local steam = trim_slashes(millennium.steam_path())
    for _, c in ipairs({
        fs.join(steam, "millennium", "plugins", "pc-info", "backend"),
        fs.join(steam, "plugins", "pc-info", "backend"),
    }) do
        if fs.exists(c) then return c end
    end
    return nil
end

-- Runs the PowerShell helper once (blocking, ~2-5 s). Returns its output text.
local function run_helper()
    local dir = backend_dir()
    if not dir then
        logger:error("pc-info: backend folder not found")
        return "no backend dir"
    end
    local steam = trim_slashes(millennium.steam_path())
    local cmd = string.format(
        'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%s" -SteamPath "%s"',
        fs.join(dir, "pc-info.ps1"), steam)
    logger:info("pc-info: running helper")
    local ok, out, status = pcall(utils.exec, cmd)
    if not ok then
        logger:error("pc-info: exec failed: " .. tostring(out))
        return "exec failed"
    end
    out = tostring(out or "")
    local json = out:match("(%b{})")
    if json then
        last_json = json
        logger:info("pc-info: detected: " .. json)
    else
        logger:error("pc-info: helper returned no data: " .. out .. " (status " .. tostring(status) .. ")")
    end
    return last_json
end

local function register_js()
    local steam = trim_slashes(millennium.steam_path())
    local file = fs.join(steam, "steamui", "pc-info", "pc-info.js")
    if not fs.exists(file) then
        logger:error("pc-info: " .. file .. " was not created, see backend\\pc-info.log")
        return
    end
    local fn = millennium.add_browser_js
    if type(fn) ~= "function" then
        logger:error("pc-info: millennium.add_browser_js is not available in this Millennium version")
        return
    end
    local ok, err = pcall(fn, JS_REL, ".*")
    if not ok then
        logger:warn("pc-info: add_browser_js(path, pattern) failed (" .. tostring(err) .. "), retrying with path only")
        ok, err = pcall(fn, JS_REL)
    end
    if ok then
        logger:info("pc-info: browser script registered: " .. JS_REL)
    else
        logger:error("pc-info: add_browser_js failed: " .. tostring(err))
    end
end

-- ---------------------------------------------------------------------------
-- FPS pages: the webkit module (store page) cannot read other sites because of CORS, so it asks
-- the backend. FetchPage(url) downloads ONE page from a short allow-list of FPS-estimate sites and
-- returns its text (HTML tags removed). The module parses the numbers itself.
-- ---------------------------------------------------------------------------
local ALLOWED_HOSTS = {
    ["fpsbench.com"] = true, ["www.fpsbench.com"] = true,
    ["chipversus.com"] = true, ["www.chipversus.com"] = true,
    ["checkfps.io"] = true, ["www.checkfps.io"] = true,
    ["www.pcgamingwiki.com"] = true, ["pcgamingwiki.com"] = true,
}
local UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
local MAX_TEXT = 100000
local page_cache = {}   -- url -> { t = os.time(), text = "..." }, kept for 6 hours

local function strip_html(body)
    body = body:gsub("<script([^>]*)>(.-)</script>", function(attrs, inner)
        -- keep JSON blobs (Next.js data etc.), drop real scripts
        if attrs:lower():find("json", 1, true) then return " " .. inner .. " " end
        return " "
    end)
    body = body:gsub("<style.-</style>", " ")
    body = body:gsub("<!%-%-.-%-%->", " ")
    body = body:gsub("<[^>]*>", " ")
    body = body:gsub("&nbsp;", " ")
    body = body:gsub("&amp;", "&")
    body = body:gsub("%s+", " ")
    return body
end

-- the url can arrive as a table {url=...}, a plain string or a JSON string, depending on the Millennium version
local function arg_url(...)
    for i = 1, select("#", ...) do
        local a = select(i, ...)
        if type(a) == "table" then
            if type(a.url) == "string" then return a.url end
            if type(a[1]) == "string" then return a[1] end
        elseif type(a) == "string" then
            if a:match("^https://") then return a end
            if ok_cjson and type(cjson) == "table" then
                local ok, d = pcall(cjson.decode, a)
                if ok and type(d) == "table" and type(d.url) == "string" then return d.url end
            end
        end
    end
    return nil
end

function FetchPage(...)
    local url = arg_url(...)
    if not url then
        logger:warn("pc-info: FetchPage called without a url")
        return "ERR no url"
    end
    local host = url:match("^https://([^/%?#:]+)")
    if not host or not ALLOWED_HOSTS[host:lower()] then
        logger:warn("pc-info: FetchPage refused: " .. url)
        return "ERR host not allowed"
    end
    local c = page_cache[url]
    if c and os.time() - c.t < 21600 then return c.text end

    local ok_mod, http = pcall(require, "http")
    if not ok_mod or type(http) ~= "table" or type(http.get) ~= "function" then
        logger:error("pc-info: http module is not available")
        return "ERR no http module"
    end
    local ok, res, err = pcall(http.get, url, {
        headers = { ["User-Agent"] = UA, ["Accept"] = "text/html,application/xhtml+xml", ["Accept-Language"] = "en-US,en;q=0.9" },
        timeout = 8,
    })
    if not ok then
        logger:warn("pc-info: http.get failed: " .. tostring(res))
        return "ERR http " .. tostring(res):sub(1, 60)
    end
    if not res then
        logger:warn("pc-info: no response for " .. url .. ": " .. tostring(err))
        return "ERR no response"
    end
    local status = tonumber(res.status) or 0
    if status ~= 200 then
        logger:info("pc-info: " .. url .. " -> HTTP " .. tostring(res.status))
        return "ERR HTTP " .. tostring(res.status)
    end
    local text = strip_html(tostring(res.body or "")):sub(1, MAX_TEXT)
    logger:info("pc-info: fetched " .. url .. " (" .. #text .. " chars)")
    page_cache[url] = { t = os.time(), text = text }
    return text
end

-- Callable from the webkit module (Millennium.callServerMethod("pc-info", "GetPcInfo")):
-- returns the detected specs as a JSON string ("" while detection is still running).
function GetPcInfo()
    return last_json
end

-- Re-detect now and return the new JSON
function RefreshPcInfo()
    return run_helper()
end

local function on_load()
    logger:info("pc-info: loaded")
    millennium.ready()          -- must come first and fast
    run_helper()
    register_js()
end

local function on_unload()
    logger:info("pc-info: unloaded")
end

return { on_load = on_load, on_unload = on_unload }
