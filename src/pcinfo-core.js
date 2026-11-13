/* pc-info webkit module: "Конфигурация ПК" block under the system requirements on Steam store pages.
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
    cpu: "AMD Ryzen 7 5700X (8C/16T, 3.4–4.6 GHz)",
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

  /*__HW__*/

  var KEY = "nnPcInfoSettings";
  var FPS_KEY = "nnPcInfoFps";
  var DEFAULTS = {
    title: "🖥️ Конфигурация ПК",
    accent: "#22d3ee", border: "#8b5cf6", bg: "#06080e", bgAlpha: 88, text: "#c9d1e0", label: "#8b95aa",
    fontSize: 12, width: 100, radius: 12, labelWidth: 170, compare: true, fps: true, online: true,
    hidden: {}, custom: {}, extra: []
  };
  var ROWS = [
    ["cpu", "Процессор"],
    ["gpu", "Видеокарта"],
    ["ram", "Оперативная память"],
    ["board", "Материнская плата"],
    ["os", "ОС"],
    ["directx", "DirectX"],
    ["disks", "Диски"],
    ["audio", "Звук"],
    ["display", "Монитор"]
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
    if (/^(mb|мб)/.test(unit)) return v / 1024;
    if (/^(tb|тб)/.test(unit)) return v * 1024;
    return v;
  }
  function readNeeds(root) {
    var needs = {}, items = root.querySelectorAll("li");
    for (var i = 0; i < items.length; i++) {
      var t = items[i].textContent.replace(/\s+/g, " ").trim();
      var m = t.match(/(\d+(?:[.,]\d+)?)\s*(MB|GB|TB|МБ|ГБ|ТБ)/i);
      if (!m) continue;
      if (/RAM|Memory|Оператив/i.test(t) && needs.ram === undefined) needs.ram = toGB(m[1], m[2]);
      else if (/Storage|Disk|Место/i.test(t) && needs.disk === undefined) needs.disk = toGB(m[1], m[2]);
    }
    return needs;
  }
  function mark(ok) { return ok ? '<span class="nn-ok">✓</span>' : '<span class="nn-bad">✗</span>'; }


  // ---------------------------------------------------------------- requirements: CPU / GPU check
  function colReqs(col) {
    var o = { cpu: [], gpu: [] };
    if (!col) return o;
    var li = col.querySelectorAll("li");
    for (var i = 0; i < li.length; i++) {
      var t = li[i].textContent.replace(/\s+/g, " ").trim();
      var m = /^([^:：]{2,32})[:：]\s*(.+)$/.exec(t);
      if (!m) continue;
      var lab = m[1].toLowerCase();
      if (/processor|cpu|процессор/.test(lab)) o.cpu = o.cpu.concat(HW.alts(m[2]));
      else if (/graphics|video|gpu|видео/.test(lab)) o.gpu = o.gpu.concat(HW.alts(m[2]));
    }
    return o;
  }
  function readReqs(sys) {
    var scope = sys.querySelector('.game_area_sys_req[data-os="win"]') || sys.querySelector(".game_area_sys_req") || sys;
    var left = scope.querySelector(".game_area_sys_req_leftCol"), right = scope.querySelector(".game_area_sys_req_rightCol");
    if (left || right) return { min: colReqs(left), rec: colReqs(right) };
    return { min: colReqs(scope), rec: { cpu: [], gpu: [] } };
  }
  function myParts(s) {
    return {
      cpu: s.custom.cpu || state.data.cpu || "",
      gpu: s.custom.gpu || state.data.gpu || ""
    };
  }
  function checkHw(reqs, my) {
    var res = { cpu: {}, gpu: {} };
    ["min", "rec"].forEach(function (l) {
      res.cpu[l] = HW.rate(HW.cpuScore(my.cpu), HW.reqMin(reqs[l].cpu, HW.cpuScore));
      res.gpu[l] = HW.rate(HW.gpuScore(my.gpu), HW.reqMin(reqs[l].gpu, HW.gpuScore));
    });
    return res;
  }
  function chkHtml(r) {
    if (!r || (!r.min && !r.rec)) return "";
    function one(label, x) {
      if (!x) return '<span class="nn-na" title="нет данных для сравнения">' + label + " ?</span>";
      var sign = x.cls === "ok" ? "✓" : (x.cls === "mid" ? "≈" : "✗");
      var tip = "ваш компонент примерно в " + x.r.toFixed(2) + " раза от требуемого (оценка по условным баллам)";
      return '<span class="nn-' + x.cls + '" title="' + tip + '">' + label + " " + sign + " ×" + x.r.toFixed(1) + "</span>";
    }
    return '<span class="nn-chk">' + one("Мин", r.min) + " · " + one("Рек", r.rec) + "</span>";
  }
  function verdict(res) {
    function lvl(l) {
      var a = [];
      if (res.cpu[l]) a.push({ x: res.cpu[l], n: "процессор" });
      if (res.gpu[l]) a.push({ x: res.gpu[l], n: "видеокарта" });
      return a.length ? a : null;
    }
    function worst(a) { return a.reduce(function (w, v) { return v.x.r < w.x.r ? v : w; }); }
    function names(a) { return a.map(function (v) { return v.n; }).join(" и "); }
    var rec = lvl("rec"), min = lvl("min"), w;
    if (rec) {
      w = worst(rec);
      if (w.x.cls === "ok") return ["ok", "Ваш " + names(rec) + " — на уровне рекомендуемых требований или выше."];
      if (w.x.cls === "mid") return ["mid", "Почти на уровне рекомендуемых требований (" + names(rec) + ") — игра должна идти нормально."];
      if (min && worst(min).x.cls !== "bad") return ["mid", "Выше минимальных, но ниже рекомендуемых требований (слабее всего: " + w.n + ")."];
      return ["bad", "Ниже требований игры (слабее всего: " + w.n + ") — возможны сильные тормоза."];
    }
    if (min) {
      w = worst(min);
      if (w.x.cls === "ok") return ["ok", "Соответствует минимальным требованиям (" + names(min) + ")."];
      if (w.x.cls === "mid") return ["mid", "Почти на уровне минимальных требований (" + names(min) + ")."];
      return ["bad", "Ниже минимальных требований (слабее всего: " + w.n + ")."];
    }
    return null;
  }

  // ---------------------------------------------------------------- FPS: local model + sites (via the Lua backend)
  var fps = { key: "", status: "idle", online: null, log: [] };
  var PRESETS = [["low", "Низкие"], ["medium", "Средние"], ["high", "Высокие"], ["ultra", "Ультра"]];
  var RES_ROWS = [["1080p", "1920×1080"], ["1440p", "2560×1440"], ["4k", "3840×2160"]];

  function appId() { var m = /\/app\/(\d+)/.exec(location.href); return m ? m[1] : ""; }
  function gameName() {
    var e = document.getElementById("appHubAppName") || document.querySelector(".apphub_AppName");
    return e ? e.textContent.trim() : "";
  }
  function nativeRes() {
    var m = /(\d{3,4})\s*[x×]\s*(\d{3,4})/.exec(String((state.data && state.data.display) || ""));
    if (!m) return "";
    var h = +m[2];
    return h >= 2000 ? "4k" : (h >= 1300 ? "1440p" : "1080p");
  }
  function sane(o) {
    var a = [o.ultra, o.high, o.medium, o.low], i;
    for (i = 0; i < 4; i++) if (!(a[i] >= 3 && a[i] <= 999)) return false;
    for (i = 0; i < 3; i++) if (a[i] > a[i + 1] * 1.08) return false;
    return true;
  }
  var NUM = "(\\d{1,3}(?:\\.\\d)?)(?!\\d|\\s?[pPxX×])";
  function parsePresets(seg) {
    var o = {}, m, names = ["ultra", "high", "medium", "low"], i;
    var L = "(ultra|high|medium|low)", re = new RegExp(L + "\\W+" + L + "\\W+" + L + "\\W+" + L + "\\W+" + NUM + "\\W+" + NUM + "\\W+" + NUM + "\\W+" + NUM, "i");
    if ((m = re.exec(seg))) {
      var seen = {};
      for (i = 1; i <= 4; i++) seen[m[i].toLowerCase()] = +m[i + 4];
      if (seen.ultra && seen.high && seen.medium && seen.low) o = seen;
    }
    if (!o.low) {
      for (i = 0; i < 4; i++) {
        var r = new RegExp(names[i] + "(?:\\W|avg|fps|average)*?" + NUM, "i"), mm = r.exec(seg);
        if (mm) o[names[i]] = +mm[1];
      }
    }
    return (o.low && o.medium && o.high && o.ultra && sane(o)) ? o : null;
  }
  function markPositions(text, defs) {
    var pos = [];
    defs.forEach(function (d) {
      var re = new RegExp(d[1].source, "ig"), m;
      while ((m = re.exec(text))) pos.push({ res: d[0], i: m.index });
    });
    pos.sort(function (a, b) { return a.i - b.i; });
    return pos;
  }
  function parseFpsbench(text) {
    var out = {}, pos = markPositions(text, [["1080p", /1920\s*[x×]\s*1080/], ["1440p", /2560\s*[x×]\s*1440/], ["4k", /3840\s*[x×]\s*2160/]]);
    pos.forEach(function (p, k) {
      if (out[p.res]) return;
      var seg = text.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : p.i + 800);
      var o = parsePresets(seg);
      if (o) out[p.res] = o;
    });
    return Object.keys(out).length ? out : null;
  }
  function parseChipversus(text) {
    var out = {}, pos = markPositions(text, [["1080p", /1080\s?p/], ["1440p", /1440\s?p/], ["4k", /\b4k\b/]]);
    pos.forEach(function (p, k) {
      if (out[p.res]) return;
      var seg = text.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : p.i + 500);
      var re = /(\d{1,3})\s*fps/ig, m, nums = [], first = -1, last = -1;
      while ((m = re.exec(seg)) && nums.length < 4) { if (first < 0) first = m.index; last = m.index; nums.push(+m[1]); }
      if (nums.length < 4 || last - first > 200) return;
      nums.sort(function (a, b) { return b - a; });
      var o = { low: nums[0], medium: nums[1], high: nums[2], ultra: nums[3] };
      if (sane(o)) out[p.res] = o;
    });
    return Object.keys(out).length ? out : null;
  }
  function parseCheckfps(text) {
    var rows = {}, names = ["ultra", "high", "medium", "low"], i;
    for (i = 0; i < 4; i++) {
      var re = new RegExp(names[i] + "[\\s\\S]{0,60}?(\\d{1,3})\\s*fps[\\s\\S]{0,60}?(\\d{1,3})\\s*fps[\\s\\S]{0,60}?(\\d{1,3})\\s*fps", "i"), m = re.exec(text);
      if (!m) return null;
      rows[names[i]] = [+m[1], +m[2], +m[3]];
    }
    var out = {}, keys = ["1080p", "1440p", "4k"];
    for (i = 0; i < 3; i++) {
      var o = { ultra: rows.ultra[i], high: rows.high[i], medium: rows.medium[i], low: rows.low[i] };
      if (sane(o)) out[keys[i]] = o;
    }
    return Object.keys(out).length ? out : null;
  }
  function plausible(data, local) {
    if (!local) return true;
    var bad = 0, n = 0;
    Object.keys(data).forEach(function (r) {
      if (!local[r]) return;
      PRESETS.forEach(function (p) { n++; var q = data[r][p[0]] / local[r][p[0]]; if (q < 0.2 || q > 5) bad++; });
    });
    return bad === 0;
  }

  // plain RPC to the Lua backend; tries both known signatures of callServerMethod
  function unwrap(v) {
    if (v && typeof v === "object" && v.returnValue !== undefined) return v.returnValue;
    return v;
  }
  function rpc(fn, args) {
    return new Promise(function (resolve) {
      var M = window.Millennium, done = false;
      function fin(v) { if (done) return; done = true; resolve(unwrap(v)); }
      if (!M || typeof M.callServerMethod !== "function") return resolve(null);
      function two() {
        try {
          var p = M.callServerMethod(fn, args);
          if (p && p.then) p.then(fin, function () { fin(null); }); else fin(p);
        } catch (e) { fin(null); }
      }
      try {
        var p3 = M.callServerMethod("pc-info", fn, args);
        if (p3 && p3.then) p3.then(function (v) { v = unwrap(v); if (v == null || v === "") two(); else fin(v); }, two);
        else if (p3 == null) two(); else fin(p3);
      } catch (e) { two(); }
      setTimeout(function () { fin(null); }, 25000);
    });
  }

  function fpsCacheGet(key) {
    try {
      var all = JSON.parse(localStorage.getItem(FPS_KEY) || "{}"), c = all[key];
      if (c && Date.now() - c.t < (c.ok ? 7 : 1) * 86400000) return c;
    } catch (e) {}
    return null;
  }
  function fpsCacheSet(key, c) {
    try {
      var all = JSON.parse(localStorage.getItem(FPS_KEY) || "{}");
      c.t = Date.now(); all[key] = c;
      var ks = Object.keys(all);
      if (ks.length > 60) ks.sort(function (a, b) { return all[a].t - all[b].t; }).slice(0, ks.length - 60).forEach(function (k) { delete all[k]; });
      localStorage.setItem(FPS_KEY, JSON.stringify(all));
    } catch (e) {}
  }
  function diag(v) { try { document.documentElement.setAttribute("data-pcinfo-fps", v); } catch (e) {} }

  function candidates(my) {
    var cpu = HW.cpuModel(my.cpu), gpu = HW.gpuModel(my.gpu), games = HW.gameSlugs(gameName()), out = [];
    if (!games.length || !gpu) return out;
    var gpuFull = HW.slug(gpu), gpuShort = gpuFull.replace(/^nvidia-geforce-|^nvidia-|^amd-radeon-|^amd-/, "");
    var gpuNoBrand = gpuFull.replace(/^nvidia-|^amd-/, "");
    var cpuFull = cpu ? HW.slug(cpu) : "", cpuNoBrand = cpuFull.replace(/^amd-|^intel-/, "");
    games.forEach(function (g) {
      if (cpu) out.push({ src: "fpsbench.com", url: "https://fpsbench.com/game/" + g + "/" + cpuFull + "-" + gpuFull, parse: parseFpsbench });
    });
    games.forEach(function (g) {
      if (cpu) out.push({ src: "chipversus.com", url: "https://chipversus.com/fps-calculator/" + cpuNoBrand + "-" + gpuNoBrand + "/" + g, parse: parseChipversus });
    });
    games.forEach(function (g) {
      var short = gpuShort.replace(/^geforce-/, "").replace(/^rtx-/, "rtx-");
      out.push({ src: "checkfps.io", url: "https://checkfps.io/en/fps-calculator/" + g + "/" + short, parse: parseCheckfps, noCpu: true, note: "расчёт сайта для процессора Core i5-13400" });
    });
    return out;
  }

  function startOnline(key, my, local) {
    var list = candidates(my), i = 0;
    if (!list.length) { fps.status = "none"; fps.log.push("no-candidates"); diag(fps.log.join(",")); return; }
    function next() {
      if (fps.key !== key) return;
      if (i >= list.length) {
        var answered = fps.log.some(function (x) { return !/:no-answer$/.test(x); });
        fps.status = answered ? "none" : "norpc";
        diag(fps.log.join(","));
        if (answered) fpsCacheSet(key, { ok: false });
        render(); return;
      }
      var c = list[i++];
      rpc("FetchPage", { url: c.url }).then(function (text) {
        if (fps.key !== key) return;
        if (typeof text !== "string" || !text || /^ERR/.test(text)) { fps.log.push(c.src + ":" + (text ? String(text).slice(0, 40) : "no-answer")); return next(); }
        var data = null;
        try { data = c.parse(text); } catch (e) { data = null; }
        if (!data || !plausible(data, local)) { fps.log.push(c.src + ":no-data"); return next(); }
        fps.log.push(c.src + ":ok");
        fps.status = "done";
        fps.online = { src: c.src, url: c.url, note: c.note || "", data: data, cpu: c.noCpu ? "" : HW.cpuModel(my.cpu), gpu: HW.gpuModel(my.gpu) };
        diag(fps.log.join(","));
        fpsCacheSet(key, { ok: true, data: fps.online });
        render();
      });
    }
    next();
  }
  function ensureFps(s, local) {
    if (!s.fps || !s.online) { if (fps.key) fps = { key: "", status: "idle", online: null, log: [] }; return; }
    var my = myParts(s), key = appId() + "|" + my.cpu + "|" + my.gpu;
    if (fps.key === key) return;
    fps = { key: key, status: "loading", online: null, log: [] };
    var c = fpsCacheGet(key);
    if (c) { fps.status = c.ok ? "done" : "none"; fps.online = c.ok ? c.data : null; return; }
    startOnline(key, my, local);
  }

  function fpsClass(v) { return v >= 120 ? "f4" : (v >= 60 ? "f3" : (v >= 30 ? "f2" : "f1")); }
  function fpsTable(data) {
    var nat = nativeRes(), h = "<table><tr><th></th>";
    PRESETS.forEach(function (p) { h += "<th>" + p[1] + "</th>"; });
    h += "</tr>";
    RES_ROWS.forEach(function (r) {
      var row = data[r[0]];
      if (!row) return;
      h += '<tr' + (r[0] === nat ? ' class="nat"' : "") + "><th>" + r[1] + (r[0] === nat ? " ◂ ваш монитор" : "") + "</th>";
      PRESETS.forEach(function (p) { h += '<td class="' + fpsClass(row[p[0]]) + '">' + (row[p[0]] != null ? row[p[0]] : "—") + "</td>"; });
      h += "</tr>";
    });
    return h + "</table>";
  }
  function fpsBlock(s, local) {
    if (!s.fps) return "";
    var h = '<div class="nn-fps"><h4>Примерный FPS на вашем ПК</h4>';
    if (fps.status === "done" && fps.online) {
      var o = fps.online;
      h += fpsTable(o.data) + '<div class="nn-src">Источник: <a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + esc(o.src) + "</a>" +
        (o.cpu || o.gpu ? " — " + esc([o.cpu, o.gpu].filter(Boolean).join(" + ")) : "") + (o.note ? " (" + esc(o.note) + ")" : "") +
        ". Это оценка сайта, а не замер на вашем ПК.</div>";
    } else if (local) {
      h += fpsTable(local) + '<div class="nn-src">Локальная оценка по системным требованиям игры (≈ ±30 %). ' +
        (s.online ? (fps.status === "loading" ? "Ищу данные на сайтах…" : (fps.status === "norpc" ? "Не удалось связаться с бэкендом плагина — сайты не опрошены." : "Данных на сайтах для этой игры не нашлось.")) : "Поиск на сайтах выключен в настройках.") + "</div>";
    } else {
      return '<div class="nn-fps"><h4>Примерный FPS на вашем ПК</h4><div class="nn-src">' +
        (fps.status === "loading" ? "Ищу данные на сайтах…" : "Нет данных: в требованиях игры не указаны известные процессор/видеокарта, и на сайтах эта игра не найдена.") + "</div></div>";
    }
    return h + "</div>";
  }

  function values() {
    var d = state.data;
    var disks = (d.disks || []).map(function (x) {
      var size = (x.free != null) ? x.free + " / " + x.total : x.total;
      return esc(x.id) + " " + size + " ГБ" + (x.model ? " (" + esc(x.model) + ")" : "");
    }).join("<br>");
    return {
      os: esc(d.os), cpu: esc(d.cpu), ram: d.ramGB ? d.ramGB + " ГБ" : "", gpu: esc(d.gpu),
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
      ".nn-chk{margin-left:10px;font-size:.92em;white-space:nowrap}.nn-chk .nn-ok,.nn-chk .nn-bad,.nn-chk .nn-mid,.nn-chk .nn-na{margin-left:0;font-weight:600}" +
      ".nn-mid{color:#fbbf24;font-weight:700}.nn-na{color:" + s.label + ";opacity:.7}" +
      ".nn-verdict{margin:8px 0 2px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}" +
      ".nn-v-ok{border-color:rgba(74,222,128,.45);color:#86efac}.nn-v-mid{border-color:rgba(251,191,36,.45);color:#fcd34d}.nn-v-bad{border-color:rgba(248,113,113,.5);color:#fca5a5}" +
      ".nn-fps{margin-top:10px}.nn-fps h4{margin:0 0 4px;color:" + s.accent + ";font-size:inherit}" +
      ".nn-fps table{border-collapse:collapse}.nn-fps th{font-weight:600;color:" + s.label + ";text-align:left;padding:2px 14px 2px 0;white-space:nowrap}.nn-fps td{text-align:center;padding:2px 12px;font-weight:700}" +
      ".nn-fps tr.nat th{color:" + s.text + "}.nn-fps tr.nat td{background:rgba(255,255,255,.05)}" +
      ".f4{color:#4ade80}.f3{color:#22d3ee}.f2{color:#fbbf24}.f1{color:#f87171}" +
      ".nn-fps .nn-src{margin:4px 0 0}.nn-fps a{color:" + s.accent + "}" +
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
    var reqs = readReqs(box.sys), my = myParts(s), hw = checkHw(reqs, my);
    var local = s.fps ? HW.estimateFps(reqs, my.cpu, my.gpu) : null;
    ensureFps(s, local);
    styleEl.textContent = css(s);
    (state.data.disks || []).forEach(function (d) { if (d.free != null && d.free > best) best = d.free; });
    var src = state.source === "auto"
      ? "✓ характеристики определены автоматически" + (state.updated ? " (" + esc(state.updated) + ")" : "")
      : "пока показаны сохранённые данные — идёт автоопределение…";

    var html = '<button class="nn-gear" title="Настройки">⚙</button><h3>' + esc(s.title) + '</h3><div class="nn-src">' + src + "</div><ul>";
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
        if (r[0] === "cpu") m = chkHtml(hw.cpu);
        if (r[0] === "gpu") m = chkHtml(hw.gpu);
      }
      html += "<li><b>" + r[1] + ":</b><i>" + val + "</i>" + m + "</li>";
    });
    (s.extra || []).forEach(function (e) {
      if (e && e.label && e.value) html += "<li><b>" + esc(e.label) + ":</b><i>" + esc(e.value) + "</i></li>";
    });
    html += "</ul>";
    if (s.compare) {
      var v = verdict(hw);
      if (v) html += '<div class="nn-verdict nn-v-' + v[0] + '">' + (v[0] === "ok" ? "✓ " : (v[0] === "mid" ? "≈ " : "✗ ")) + v[1] + "</div>";
    }
    html += fpsBlock(s, local);
    if (open) html += panel(s);
    box.div.innerHTML = html;
    box.div.querySelector(".nn-gear").onclick = function () { open = !open; render(); };
    if (open) bindPanel();
  }

  function panel(s) {
    function num(id, label, v, min, max) { return '<label><span>' + label + '</span><input type="number" data-k="' + id + '" value="' + v + '" min="' + min + '" max="' + max + '"></label>'; }
    function col(id, label, v) { return '<label><span>' + label + '</span><input type="color" data-k="' + id + '" value="' + v + '"></label>'; }
    var auto = values();
    var h = '<div class="nn-set"><h4>Вид</h4>' +
      '<label><span>Заголовок</span><input type="text" data-k="title" value="' + esc(s.title) + '"></label>' +
      col("accent", "Акцент", s.accent) + col("border", "Рамка", s.border) + col("bg", "Фон", s.bg) +
      col("text", "Текст", s.text) + col("label", "Названия строк", s.label) +
      num("bgAlpha", "Непрозрачность фона, %", s.bgAlpha, 0, 100) +
      num("fontSize", "Размер шрифта, px", s.fontSize, 9, 24) +
      num("width", "Ширина, %", s.width, 30, 100) +
      num("radius", "Скругление, px", s.radius, 0, 30) +
      num("labelWidth", "Ширина названий, px", s.labelWidth, 60, 300) +
      '<label><span>Проверка ✓/✗ (процессор, видеокарта)</span><input type="checkbox" data-k="compare"' + (s.compare ? " checked" : "") + "></label>" +
      '<label><span>Показывать примерный FPS</span><input type="checkbox" data-k="fps"' + (s.fps ? " checked" : "") + "></label>" +
      '<label><span>Искать FPS на сайтах</span><input type="checkbox" data-k="online"' + (s.online ? " checked" : "") + "></label>" +
      "<h4>Строки: показывать / своё значение (пусто = авто)</h4>";
    ROWS.forEach(function (r) {
      h += '<label><input type="checkbox" data-show="' + r[0] + '"' + (s.hidden[r[0]] ? "" : " checked") + "><span>" + r[1] + '</span><input type="text" data-c="' + r[0] + '" value="' + esc(s.custom[r[0]] || "") + '" placeholder="' + esc(String(auto[r[0]] || "").replace(/<br>/g, ", ").replace(/&amp;/g, "&")) + '"></label>';
    });
    h += "<h4>Дополнительные строки</h4>";
    for (var i = 0; i < 4; i++) {
      var e = (s.extra || [])[i] || {};
      h += '<label><input type="text" data-el="' + i + '" value="' + esc(e.label || "") + '" placeholder="Название" style="max-width:150px"><input type="text" data-ev="' + i + '" value="' + esc(e.value || "") + '" placeholder="Значение"></label>';
    }
    return h + '<button data-act="refresh">Обновить FPS</button><button data-act="reset">Сбросить</button></div>';
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
    root.querySelector('[data-act="refresh"]').onclick = function () {
      try { localStorage.removeItem(FPS_KEY); } catch (e) {}
      fps = { key: "", status: "idle", online: null, log: [] };
      render();
    };
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
    var sys = document.querySelector('.game_area_sys_req[data-os="win"]') || document.querySelector(".game_area_sys_req") || document.querySelector(".sys_req") || document.querySelector(".sysreq_contents");
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
