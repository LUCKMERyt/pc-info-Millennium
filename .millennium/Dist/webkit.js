/* pc-info webkit module: "\u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u041f\u041a" block under the system requirements on Steam store pages.
   - shows immediately with built-in default specs
   - detected specs (from the Lua/PowerShell backend) replace them as soon as they arrive
   - gear button: colors, sizes, rows, own values (saved in localStorage) */
(function () {
  "use strict";
  var DETECTED = /*__DATA__*/null;

  // ---- if the module is already running (loaded twice), just hand over the data ----
  if (window.__pcInfo) { if (DETECTED) window.__pcInfo.setData(DETECTED); return; }
  try { document.documentElement.setAttribute("data-pcinfo", "injected"); } catch (e) {}
  if (!/steampowered\.com\/app\//.test(location.href)) return;

  // ---- built-in specs, used until the backend delivers the real ones ----
  var DEFAULT_DATA = {
    os: "Windows 10 Pro 64-bit",
    cpu: "AMD Ryzen 7 5700X (8C/16T, 3.4\u20134.6 GHz)",
    ramGB: 32,
    gpu: "NVIDIA GeForce RTX 5060 8 GB",
    directx: "12",
    board: "MSI MPG B550 GAMING PLUS",
    display: "AQ27H3 27\" 2560x1440 180 Hz HDR",
    disks: [
      { id: "C:", free: null, total: 243, model: "Silicon Power NVMe" },
      { id: "D:", free: null, total: 488, model: "Apacer AS350 SSD" },
      { id: "E:", free: null, total: 476, model: "Toshiba HDWD105 HDD" }
    ],
    audio: "Logitech G435 Wireless Headset"
  };

  var KEY = "nnPcInfoSettings";
  var DEFAULTS = {
    title: "\ud83d\udda5\ufe0f \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u041f\u041a",
    accent: "#22d3ee", border: "#8b5cf6", bg: "#06080e", bgAlpha: 88, text: "#c9d1e0", label: "#8b95aa",
    fontSize: 12, width: 100, radius: 12, labelWidth: 170, compare: true,
    hidden: {}, custom: {}, extra: []
  };
  var ROWS = [
    ["cpu", "\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440"],
    ["gpu", "\u0412\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430"],
    ["ram", "\u041e\u043f\u0435\u0440\u0430\u0442\u0438\u0432\u043d\u0430\u044f \u043f\u0430\u043c\u044f\u0442\u044c"],
    ["board", "\u041c\u0430\u0442\u0435\u0440\u0438\u043d\u0441\u043a\u0430\u044f \u043f\u043b\u0430\u0442\u0430"],
    ["os", "\u041e\u0421"],
    ["directx", "DirectX"],
    ["disks", "\u0414\u0438\u0441\u043a\u0438"],
    ["audio", "\u0417\u0432\u0443\u043a"],
    ["display", "\u041c\u043e\u043d\u0438\u0442\u043e\u0440"]
  ];

  var state = { data: DEFAULT_DATA, source: "default", updated: "" };
  var box = null, styleEl = null, open = false;

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { s = {}; }
    var o = {}, k;
    for (k in DEFAULTS) o[k] = (s[k] !== undefined) ? s[k] : DEFAULTS[k];
    return o;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function rgba(hex, a) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    return m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")" : hex;
  }
  function toGB(v, unit) {
    v = parseFloat(String(v).replace(",", "."));
    unit = unit.toLowerCase();
    if (/^(mb|\u043c\u0431)/.test(unit)) return v / 1024;
    if (/^(tb|\u0442\u0431)/.test(unit)) return v * 1024;
    return v;
  }
  function readNeeds(root) {
    var needs = {}, items = root.querySelectorAll("li");
    for (var i = 0; i < items.length; i++) {
      var t = items[i].textContent.replace(/\s+/g, " ").trim();
      var m = t.match(/(\d+(?:[.,]\d+)?)\s*(MB|GB|TB|\u041c\u0411|\u0413\u0411|\u0422\u0411)/i);
      if (!m) continue;
      if (/RAM|Memory|\u041e\u043f\u0435\u0440\u0430\u0442\u0438\u0432/i.test(t) && needs.ram === undefined) needs.ram = toGB(m[1], m[2]);
      else if (/Storage|Disk|\u041c\u0435\u0441\u0442\u043e/i.test(t) && needs.disk === undefined) needs.disk = toGB(m[1], m[2]);
    }
    return needs;
  }
  function mark(ok) { return ok ? '<span class="nn-ok">\u2713</span>' : '<span class="nn-bad">\u2717</span>'; }

  function values() {
    var d = state.data;
    var disks = (d.disks || []).map(function (x) {
      var size = (x.free != null) ? x.free + " / " + x.total : x.total;
      return esc(x.id) + " " + size + " \u0413\u0411" + (x.model ? " (" + esc(x.model) + ")" : "");
    }).join("<br>");
    return {
      os: esc(d.os), cpu: esc(d.cpu), ram: d.ramGB ? d.ramGB + " \u0413\u0411" : "", gpu: esc(d.gpu),
      directx: esc(d.directx), board: esc(d.board), disks: disks, audio: esc(d.audio), display: esc(d.display)
    };
  }

  function css(s) {
    var w = Math.max(30, Math.min(100, +s.width || 100));
    return ".nn-pc{position:relative;box-sizing:border-box;width:" + w + "%;margin:14px 0 6px;padding:12px 16px;border-radius:" + (+s.radius) + "px;background:" + rgba(s.bg, (+s.bgAlpha) / 100) + ";border:1px solid " + rgba(s.border, .4) + ";border-left:3px solid " + s.accent + ";color:" + s.text + ";font-size:" + (+s.fontSize) + "px;line-height:1.5;clear:both}" +
      ".nn-pc h3{margin:0 0 2px;font-size:" + (+s.fontSize + 1) + "px;letter-spacing:.06em;color:" + s.accent + ";font-weight:700}" +
      ".nn-pc .nn-src{margin:0 0 8px;font-size:" + Math.max(9, (+s.fontSize) - 2) + "px;color:" + s.label + ";opacity:.8}" +
      ".nn-pc ul{list-style:none;margin:0;padding:0}" +
      ".nn-pc li{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)}.nn-pc li:last-child{border-bottom:0}" +
      ".nn-pc li b{display:inline-block;vertical-align:top;min-width:" + (+s.labelWidth) + "px;color:" + s.label + ";font-weight:600}" +
      ".nn-pc li i{font-style:normal;display:inline-block}" +
      ".nn-ok{color:#4ade80;font-weight:700;margin-left:8px}.nn-bad{color:#f87171;font-weight:700;margin-left:8px}" +
      ".nn-gear{position:absolute;top:8px;right:10px;cursor:pointer;opacity:.6;font-size:15px;background:none;border:0;color:" + s.accent + "}.nn-gear:hover{opacity:1}" +
      ".nn-set{margin-top:10px;padding:10px;border-top:1px dashed " + rgba(s.border, .5) + "}" +
      ".nn-set label{display:flex;align-items:center;gap:8px;margin:4px 0}.nn-set label span{min-width:150px;color:" + s.label + "}" +
      ".nn-set input[type=text],.nn-set input[type=number]{background:rgba(0,0,0,.4);border:1px solid " + rgba(s.border, .5) + ";color:" + s.text + ";padding:2px 6px;border-radius:6px;font-size:inherit}" +
      ".nn-set input[type=text]{flex:1;min-width:120px}.nn-set input[type=number]{width:70px}" +
      ".nn-set input[type=color]{width:34px;height:22px;padding:0;border:0;background:none}" +
      ".nn-set h4{margin:10px 0 4px;color:" + s.accent + ";font-size:inherit}" +
      ".nn-set button{cursor:pointer;background:" + rgba(s.border, .25) + ";border:1px solid " + rgba(s.border, .6) + ";color:" + s.text + ";padding:3px 10px;border-radius:6px;margin:6px 6px 0 0}";
  }

  function render() {
    if (!box) return;
    var s = load(), vals = values(), needs = readNeeds(box.sys), best = 0;
    styleEl.textContent = css(s);
    (state.data.disks || []).forEach(function (d) { if (d.free != null && d.free > best) best = d.free; });
    var src = state.source === "auto"
      ? "\u2713 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u044b \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438" + (state.updated ? " (" + esc(state.updated) + ")" : "")
      : "\u043f\u043e\u043a\u0430 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u2014 \u0438\u0434\u0451\u0442 \u0430\u0432\u0442\u043e\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435\u2026";

    var html = '<button class="nn-gear" title="\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438">\u2699</button><h3>' + esc(s.title) + '</h3><div class="nn-src">' + src + "</div><ul>";
    ROWS.forEach(function (r) {
      if (s.hidden[r[0]]) return;
      var val = s.custom[r[0]] ? esc(s.custom[r[0]]) : vals[r[0]];
      if (!val) return;
      var m = "";
      if (s.compare) {
        if (r[0] === "ram" && needs.ram !== undefined) {
          var have = s.custom.ram ? parseFloat(String(s.custom.ram).replace(",", ".")) : state.data.ramGB;
          if (have && !isNaN(have)) m = mark(have + 0.5 >= needs.ram);
        }
        if (r[0] === "disks" && needs.disk !== undefined && !s.custom.disks && best > 0) m = mark(best >= needs.disk);
      }
      html += "<li><b>" + r[1] + ":</b><i>" + val + "</i>" + m + "</li>";
    });
    (s.extra || []).forEach(function (e) {
      if (e && e.label && e.value) html += "<li><b>" + esc(e.label) + ":</b><i>" + esc(e.value) + "</i></li>";
    });
    html += "</ul>";
    if (open) html += panel(s);
    box.div.innerHTML = html;
    box.div.querySelector(".nn-gear").onclick = function () { open = !open; render(); };
    if (open) bindPanel();
  }

  function panel(s) {
    function num(id, label, v, min, max) { return '<label><span>' + label + '</span><input type="number" data-k="' + id + '" value="' + v + '" min="' + min + '" max="' + max + '"></label>'; }
    function col(id, label, v) { return '<label><span>' + label + '</span><input type="color" data-k="' + id + '" value="' + v + '"></label>'; }
    var auto = values();
    var h = '<div class="nn-set"><h4>\u0412\u0438\u0434</h4>' +
      '<label><span>\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a</span><input type="text" data-k="title" value="' + esc(s.title) + '"></label>' +
      col("accent", "\u0410\u043a\u0446\u0435\u043d\u0442", s.accent) + col("border", "\u0420\u0430\u043c\u043a\u0430", s.border) + col("bg", "\u0424\u043e\u043d", s.bg) +
      col("text", "\u0422\u0435\u043a\u0441\u0442", s.text) + col("label", "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u044f \u0441\u0442\u0440\u043e\u043a", s.label) +
      num("bgAlpha", "\u041d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u044c \u0444\u043e\u043d\u0430, %", s.bgAlpha, 0, 100) +
      num("fontSize", "\u0420\u0430\u0437\u043c\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430, px", s.fontSize, 9, 24) +
      num("width", "\u0428\u0438\u0440\u0438\u043d\u0430, %", s.width, 30, 100) +
      num("radius", "\u0421\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u0438\u0435, px", s.radius, 0, 30) +
      num("labelWidth", "\u0428\u0438\u0440\u0438\u043d\u0430 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0439, px", s.labelWidth, 60, 300) +
      '<label><span>\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u2713/\u2717</span><input type="checkbox" data-k="compare"' + (s.compare ? " checked" : "") + "></label>" +
      "<h4>\u0421\u0442\u0440\u043e\u043a\u0438: \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c / \u0441\u0432\u043e\u0451 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 (\u043f\u0443\u0441\u0442\u043e = \u0430\u0432\u0442\u043e)</h4>";
    ROWS.forEach(function (r) {
      h += '<label><input type="checkbox" data-show="' + r[0] + '"' + (s.hidden[r[0]] ? "" : " checked") + "><span>" + r[1] + '</span><input type="text" data-c="' + r[0] + '" value="' + esc(s.custom[r[0]] || "") + '" placeholder="' + esc(String(auto[r[0]] || "").replace(/<br>/g, ", ").replace(/&amp;/g, "&")) + '"></label>';
    });
    h += "<h4>\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0442\u0440\u043e\u043a\u0438</h4>";
    for (var i = 0; i < 4; i++) {
      var e = (s.extra || [])[i] || {};
      h += '<label><input type="text" data-el="' + i + '" value="' + esc(e.label || "") + '" placeholder="\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435" style="max-width:150px"><input type="text" data-ev="' + i + '" value="' + esc(e.value || "") + '" placeholder="\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435"></label>';
    }
    return h + '<button data-act="reset">\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c</button></div>';
  }

  function bindPanel() {
    var root = box.div.querySelector(".nn-set");
    function collect() {
      var s = load();
      [].forEach.call(root.querySelectorAll("[data-k]"), function (i) {
        s[i.getAttribute("data-k")] = i.type === "checkbox" ? i.checked : (i.type === "number" ? +i.value : i.value);
      });
      s.hidden = {}; s.custom = {}; s.extra = [];
      [].forEach.call(root.querySelectorAll("[data-show]"), function (i) { if (!i.checked) s.hidden[i.getAttribute("data-show")] = true; });
      [].forEach.call(root.querySelectorAll("[data-c]"), function (i) { if (i.value.trim()) s.custom[i.getAttribute("data-c")] = i.value.trim(); });
      for (var n = 0; n < 4; n++) {
        var l = root.querySelector('[data-el="' + n + '"]').value.trim(), v = root.querySelector('[data-ev="' + n + '"]').value.trim();
        if (l && v) s.extra.push({ label: l, value: v });
      }
      return s;
    }
    [].forEach.call(root.querySelectorAll("input"), function (i) { i.onchange = function () { save(collect()); render(); }; });
    root.querySelector('[data-act="reset"]').onclick = function () { save({}); render(); };
  }

  // ---- data from the backend: detected values override the defaults field by field ----
  function setData(d) {
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { return; } }
    if (d && d.returnValue !== undefined) return setData(d.returnValue);
    if (!d || typeof d !== "object" || !d.cpu) return;
    var m = {}, k;
    for (k in DEFAULT_DATA) m[k] = (d[k] !== undefined && d[k] !== "" && d[k] !== null) ? d[k] : DEFAULT_DATA[k];
    state = { data: m, source: "auto", updated: d.updated || "" };
    render();
  }

  function requestData() {
    // 1) Millennium RPC to the Lua backend (function GetPcInfo)
    try {
      if (window.Millennium && typeof window.Millennium.callServerMethod === "function") {
        var p = window.Millennium.callServerMethod("pc-info", "GetPcInfo", {});
        if (p && p.then) p.then(setData, function () {});
      }
    } catch (e) {}
    // 2) data file written by the helper, served from steamui
    try {
      var sc = document.createElement("script");
      sc.src = "https://steamloopback.host/pc-info/data.js?t=" + Date.now();
      (document.head || document.documentElement).appendChild(sc);
    } catch (e) {}
  }

  window.__pcInfo = { setData: setData };
  if (window.__pcInfoPending) setData(window.__pcInfoPending);
  if (DETECTED) setData(DETECTED);

  function build() {
    if (box) return true;
    var sys = document.querySelector(".game_area_sys_req") || document.querySelector(".sys_req") || document.querySelector(".sysreq_contents");
    if (!sys) return false;
    if (sys.parentNode && sys.parentNode.classList && sys.parentNode.classList.contains("game_page_autocollapse")) sys = sys.parentNode;
    var div = document.createElement("div");
    div.className = "nn-pc";
    sys.parentNode.insertBefore(div, sys.nextSibling);
    box = { sys: sys, div: div };
    render();
    return true;
  }

  function init() {
    try { document.documentElement.setAttribute("data-pcinfo", "init"); } catch (e) {}
    styleEl = document.createElement("style");
    (document.head || document.documentElement).appendChild(styleEl);
    var tries = 0;
    (function tick() { if (build() || ++tries > 40) return; setTimeout(tick, 500); })();
    // ask for real data now and retry while the backend is still collecting it
    requestData();
    [3000, 8000, 15000].forEach(function (ms) { setTimeout(function () { if (state.source !== "auto") requestData(); }, ms); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
