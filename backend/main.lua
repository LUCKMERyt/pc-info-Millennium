-- pc-info: Millennium plugin (Lua backend)
-- On Steam start: runs pc-info.ps1 (detects OS/CPU/GPU/RAM/disks/audio), which writes
-- <Steam>\steamui\pc-info\*.js and returns the data as JSON. The webkit module
-- (.millennium\Dist\webkit.js, injected into store pages by Millennium) builds the
-- "PC configuration" block and fills it with this data via GetPcInfo().

local logger = require("logger")
local millennium = require("millennium")
local utils = require("utils")
local fs = require("fs")

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
