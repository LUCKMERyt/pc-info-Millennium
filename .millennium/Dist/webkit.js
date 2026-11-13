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

  /* ---- HW: CPU/GPU recognition, relative performance scores, requirement checks, local FPS model ----
   Scores are APPROXIMATE (PassMark-like values written down by hand). They are only used to
   compare two parts of the same table, never as absolute numbers. */
var HW = (function () {
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[\u2122\u00ae\u00a9]/g, "").replace(/\((?:r|tm)\)/g, "")
      .replace(/[_]/g, " ").replace(/\s+/g, " ").trim();
  }

  // ------------------------------------------------------------------ GPU
  var GPU = {
    gt710: 700, gt730: 1000, gt740: 1500, gt1030: 2900,
    gtx650: 1350, gtx650ti: 2700, gtx660: 3700, gtx660ti: 4600, gtx670: 5200, gtx680: 5400,
    gtx750: 3100, gtx750ti: 3800, gtx760: 4100, gtx770: 4600, gtx780: 6000, gtx780ti: 6900,
    gtx950: 4600, gtx960: 5700, gtx970: 8800, gtx980: 10500, gtx980ti: 12000,
    gtx1050: 4300, gtx1050ti: 6100, "gtx1060-3gb": 9000, gtx1060: 10000, gtx1070: 14000,
    gtx1070ti: 15500, gtx1080: 17000, gtx1080ti: 18600,
    gtx1630: 5500, gtx1650: 7800, gtx1650super: 9800, gtx1660: 12000, gtx1660super: 13000, gtx1660ti: 13100,
    rtx2060: 14200, rtx2060super: 16000, rtx2070: 16500, rtx2070super: 18300, rtx2080: 19700,
    rtx2080super: 20500, rtx2080ti: 22000,
    rtx3050: 12800, rtx3060: 17000, rtx3060ti: 20000, rtx3070: 22200, rtx3070ti: 23500,
    rtx3080: 24800, rtx3080ti: 26500, rtx3090: 26500, rtx3090ti: 28000,
    rtx4060: 19800, rtx4060ti: 22500, rtx4070: 26800, rtx4070super: 29500, rtx4070ti: 31000,
    rtx4070tisuper: 33500, rtx4080: 34500, rtx4080super: 35000, rtx4090: 38500,
    rtx5050: 18500, rtx5060: 23000, rtx5060ti: 26500, rtx5070: 31000, rtx5070ti: 36000,
    rtx5080: 39000, rtx5090: 45000,
    hd7770: 1800, hd7850: 2800, hd7870: 3200, hd7950: 3700, hd7970: 4400,
    r9270x: 3800, r9280x: 4600, r9290: 6000, r9290x: 6500, r9380: 4100, r9390: 6600,
    rx460: 4000, rx470: 7500, rx480: 8200, rx550: 2700, rx560: 3800, rx570: 8000, rx580: 9100, rx590: 10000,
    vega56: 12500, vega64: 13900, radeonvii: 17000,
    rx5500xt: 9400, rx5600xt: 13100, rx5700: 15500, rx5700xt: 17500,
    rx6400: 7800, rx6500xt: 8900, rx6600: 15700, rx6600xt: 17000, rx6650xt: 17700, rx6700: 19500,
    rx6700xt: 21800, rx6750xt: 22800, rx6800: 25000, rx6800xt: 27500, rx6900xt: 28500, rx6950xt: 29500,
    rx7600: 19700, rx7600xt: 20500, rx7700xt: 26000, rx7800xt: 28500, rx7900gre: 30500,
    rx7900xt: 33500, rx7900xtx: 35500, rx9060xt: 25500, rx9070: 32000, rx9070xt: 34500,
    arca380: 6000, arca580: 13500, arca750: 16500, arca770: 17500, arcb570: 19000, arcb580: 21000,
    intelhd4000: 700, intelhd530: 1200, uhd630: 1700, irisxe: 2000
  };

  function gpuKey(raw) {
    var s = norm(raw).replace(/geforce|nvidia|radeon|\bamd\b|graphics|series|\bgpu\b/g, " ").replace(/\s+/g, " ").trim();
    var m;
    if (/intel/.test(norm(raw))) {
      if ((m = /\barc\s?(?:pro\s?)?([ab]\d{3})/.exec(s))) return "arc" + m[1];
      if (/iris\s?xe/.test(s)) return "irisxe";
      if ((m = /\buhd\s?(\d{3})/.exec(s))) return "uhd" + m[1];
      if ((m = /\bhd\s?(\d{3,4})\b/.exec(s))) return "intelhd" + m[1];
    }
    if ((m = /\barc\s?(?:pro\s?)?([ab]\d{3})/.exec(s))) return "arc" + m[1];
    if ((m = /\b(rtx|gtx|gt)\s?-?(\d{3,4})\s?(ti\s?super|super|ti)?(?![a-z0-9])/.exec(s))) {
      var suf = (m[3] || "").replace(/\s/g, "");
      var key = m[1] + m[2] + suf;
      if (key === "gtx1060" && /\b3\s?gb\b/.test(s)) return "gtx1060-3gb";
      return key;
    }
    if ((m = /\brx\s?-?(\d{3,4})\s?(xtx|xt|gre)?(?![a-z0-9])/.exec(s))) return "rx" + m[1] + (m[2] || "");
    if ((m = /\bvega\s?-?(56|64)\b/.exec(s))) return "vega" + m[1];
    if (/radeon\s?vii\b|\bvii\b/.test(s)) return "radeonvii";
    if ((m = /\br([79])\s?-?(\d{3}x?)\b/.exec(s))) return "r" + m[1] + m[2];
    if ((m = /\bhd\s?-?(\d{4})\b/.exec(s))) return "hd" + m[1];
    return null;
  }
  function gpuScore(raw) {
    var k = gpuKey(raw);
    return (k && GPU[k]) ? GPU[k] : null;
  }

  // ------------------------------------------------------------------ CPU
  // Intel matrix [tier][generation] (non-K, desktop)
  var IC = {
    3: { 1: 2000, 2: 2400, 3: 2800, 4: 3500, 6: 4500, 7: 4800, 8: 6800, 9: 7300, 10: 8200, 11: 9500, 12: 11500, 13: 12500, 14: 12800 },
    5: { 1: 3100, 2: 4400, 3: 5400, 4: 5400, 6: 6300, 7: 6800, 8: 9300, 9: 9600, 10: 12200, 11: 14500, 12: 19000, 13: 23000, 14: 24500 },
    7: { 1: 5300, 2: 6500, 3: 7200, 4: 9400, 5: 8000, 6: 10000, 7: 10000, 8: 14500, 9: 14000, 10: 16500, 11: 19000, 12: 30000, 13: 41000, 14: 48000 },
    9: { 9: 19000, 10: 23000, 11: 22500, 12: 39000, 13: 55000, 14: 60000 }
  };
  var IC_OVR = {
    "i5-2500k": 4900, "i5-3570k": 6000, "i5-4690k": 6400, "i5-6600k": 6900, "i5-7600k": 7400,
    "i5-8400": 9300, "i5-8600k": 10500, "i5-9400": 9600, "i5-9600k": 10800, "i5-10400": 12200,
    "i5-10600k": 14300, "i5-11400": 14500, "i5-11600k": 17300, "i5-12400": 19000, "i5-12600k": 25500,
    "i5-13400": 21500, "i5-13600k": 38000, "i5-14400": 22500, "i5-14600k": 40000,
    "i7-2600k": 6500, "i7-3770": 7200, "i7-4770": 9400, "i7-4790k": 10300, "i7-6700k": 10800,
    "i7-7700k": 11000, "i7-8700": 14500, "i7-8700k": 15500, "i7-9700k": 14000, "i7-10700k": 19000,
    "i7-11700k": 20500, "i7-12700k": 33500, "i7-13700k": 46500, "i7-14700k": 53000,
    "i9-9900k": 19000, "i9-10900k": 23000, "i9-11900k": 22500, "i9-12900k": 40000,
    "i9-13900k": 59500, "i9-14900k": 61000
  };
  // Ryzen matrix [tier][series digit]
  var RZ = {
    3: { 1: 7000, 2: 7500, 3: 10500, 4: 10500, 5: 12500, 7: 14000 },
    5: { 1: 12000, 2: 13000, 3: 17500, 4: 17500, 5: 20500, 7: 27500, 8: 25500, 9: 28500 },
    7: { 1: 14000, 2: 16500, 3: 22800, 4: 22000, 5: 24300, 7: 34500, 8: 30500, 9: 36500 },
    9: { 3: 33000, 5: 40000, 7: 52000, 9: 55000 }
  };
  var RZ_OVR = {
    "3-1200": 6800, "3-1300x": 7300, "3-3100": 9900, "3-3300x": 11500,
    "5-1400": 8300, "5-1500x": 8800, "5-1600": 12000, "5-1600x": 12800, "5-2400g": 7500,
    "5-2600": 13200, "5-2600x": 14000, "5-3400g": 9500, "5-3500": 12700, "5-3500x": 13000,
    "5-3600": 17800, "5-3600x": 18300, "5-4500": 16500, "5-5500": 19000, "5-5600": 20600,
    "5-5600g": 19800, "5-5600x": 21800, "5-7600": 27500, "5-7600x": 28600, "5-9600x": 28500,
    "7-1700": 13900, "7-1700x": 14500, "7-1800x": 15500, "7-2700": 15400, "7-2700x": 17100,
    "7-3700x": 22800, "7-3800x": 23300, "7-5700": 23500, "7-5700g": 20800, "7-5700x": 24400,
    "7-5800x": 27500, "7-5800x3d": 27800, "7-7700": 33500, "7-7700x": 35000, "7-7800x3d": 34000,
    "7-9700x": 36000, "7-9800x3d": 37500,
    "9-3900x": 32500, "9-3950x": 39000, "9-5900x": 39000, "9-5950x": 45500, "9-7900x": 52000,
    "9-7950x": 63000, "9-9950x": 66000
  };
  var OTHER_CPU = [
    [/core\s?2\s?duo/, 1700], [/core\s?2\s?quad/, 2300], [/phenom\s?(?:ii\s?)?x4/, 2800],
    [/phenom\s?(?:ii\s?)?x6/, 4600], [/athlon\s?(?:ii\s?)?x4/, 3000], [/pentium\s?g?4560/, 3900]
  ];

  function cpuScore(raw) {
    var s = norm(raw), m, v;
    if ((m = /core\s?ultra\s?([579])\s?(\d{3})([a-z]{0,2})/.exec(s))) {
      var u = { 5: 46000, 7: 58000, 9: 66000 }[m[1]];
      return /k/.test(m[3]) ? u : Math.round(u * 0.88);
    }
    if ((m = /\bi([3579])[\s-]?(\d{3,5})([a-z]{0,2})(?![a-z0-9])/.exec(s))) {
      var tier = m[1], digits = m[2], suf = m[3].replace(/^s$/, "");
      var gen = digits.length === 3 ? 1 : (digits.length === 4 ? +digits.charAt(0) : +digits.slice(0, 2));
      var kk = suf.replace(/f$/, "");
      if (kk !== "" && kk !== "k" && kk !== "s") return null;     // T/U/H/X ... : different class, don't guess
      var key = "i" + tier + "-" + digits + (kk === "k" ? "k" : "");
      if (IC_OVR[key]) return IC_OVR[key];
      v = IC[tier] && IC[tier][gen];
      if (!v) return null;
      return Math.round(kk === "k" ? v * (gen >= 12 ? 1.28 : 1.12) : v);
    }
    if ((m = /ryzen\s?([3579])\s?(?:pro\s)?(\d{4})\s?(x3d|xt|x|gt|ge|g|f)?(?![a-z0-9])/.exec(s))) {
      var rs = m[3] || "";
      if (rs === "ge") return null;
      var rk = m[1] + "-" + m[2] + rs;
      if (RZ_OVR[rk]) return RZ_OVR[rk];
      var base = RZ[m[1]] && RZ[m[1]][+m[2].charAt(0)];
      if (!base) return null;
      if (rs === "x" || rs === "xt") base *= 1.06;
      if (rs === "x3d") base *= 1.1;
      if (rs === "g" || rs === "gt") base *= 0.88;
      return Math.round(base);
    }
    if ((m = /\bfx[\s-]?(\d)(\d{3})\b/.exec(s))) return { 4: 3500, 6: 5000, 8: 6800, 9: 7500 }[m[1]] || null;
    for (var i = 0; i < OTHER_CPU.length; i++) if (OTHER_CPU[i][0].test(s)) return OTHER_CPU[i][1];
    return null;
  }

  // ------------------------------------------------------------------ requirement text
  function alts(val) {
    return String(val || "").split(/\s+(?:or|\u0438|\u0438\u043b\u0438)\s+|\s*[\/;|,]\s*/i).map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 2; });
  }
  function scoreList(list, fn) {
    var out = [];
    for (var i = 0; i < list.length; i++) { var v = fn(list[i]); if (v) out.push(v); }
    return out;
  }
  // lenient threshold: you pass if you reach the weakest of the listed alternatives
  function reqMin(list, fn) { var a = scoreList(list, fn); return a.length ? Math.min.apply(null, a) : null; }
  function reqMean(list, fn) {
    var a = scoreList(list, fn); if (!a.length) return null;
    var p = 0; for (var i = 0; i < a.length; i++) p += Math.log(a[i]);
    return Math.exp(p / a.length);
  }
  // ratio of your part to the requirement -> {r, cls: ok|mid|bad}
  function rate(mine, req) {
    if (!mine || !req) return null;
    var r = mine / req;
    return { r: r, cls: r >= 1 ? "ok" : (r >= 0.85 ? "mid" : "bad") };
  }

  // ------------------------------------------------------------------ local FPS model
  var PRESET = { low: 1.8, medium: 1.35, high: 1.0, ultra: 0.72 };     // vs "high"
  var RES = { "1080p": 1.0, "1440p": 0.66, "4k": 0.36 };
  function anchorK(sMin, sRec, fMin, fRec) {
    var ks = [];
    if (sRec) ks.push(fRec / sRec);
    if (sMin) ks.push(fMin / sMin);
    if (!ks.length) return null;
    var p = 0; for (var i = 0; i < ks.length; i++) p += Math.log(ks[i]);
    return Math.exp(p / ks.length);
  }
  // reqs: {min:{cpu:[],gpu:[]}, rec:{cpu:[],gpu:[]}}; returns {"1080p":{low,medium,high,ultra},...} or null
  function estimateFps(reqs, myCpu, myGpu) {
    var gMin = reqMean(reqs.min.gpu, gpuScore), gRec = reqMean(reqs.rec.gpu, gpuScore);
    var cMin = reqMean(reqs.min.cpu, cpuScore), cRec = reqMean(reqs.rec.cpu, cpuScore);
    var mg = gpuScore(myGpu), mc = cpuScore(myCpu);
    if (!mg || (!gMin && !gRec)) return null;
    var kg = anchorK(gMin, gRec, 30 / PRESET.low, 60);          // min -> 30 fps @1080p low; rec -> 60 fps @1080p high
    var kc = (mc && (cMin || cRec)) ? anchorK(cMin, cRec, 30, 60) : null;
    var out = {};
    for (var res in RES) {
      out[res] = {};
      for (var p in PRESET) {
        var g = kg * mg * PRESET[p] * RES[res];
        var f = g;
        if (kc) { var c = kc * mc; f = Math.pow(Math.pow(g, -3) + Math.pow(c, -3), -1 / 3); }
        out[res][p] = Math.max(1, Math.round(f));
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ names -> site slugs
  function cpuModel(raw) {
    var s = String(raw || "").replace(/[\u2122\u00ae\u00a9]/g, "").replace(/\((?:R|TM)\)/gi, "").replace(/\s+/g, " ");
    var m;
    if ((m = /AMD\s+Ryzen\s+[3579]\s+(?:PRO\s+)?\d{4}\w*/i.exec(s))) return m[0];
    if ((m = /Intel\s+Core\s+(?:i[3579]-\d{3,5}\w*|Ultra\s+[579]\s+\d{3}\w*)/i.exec(s))) return m[0];
    if ((m = /Core\s+(i[3579]-\d{3,5}\w*|Ultra\s+[579]\s+\d{3}\w*)/i.exec(s))) return "Intel Core " + m[1];
    return null;
  }
  function gpuModel(raw) {
    var s = String(raw || "").replace(/[\u2122\u00ae\u00a9]/g, "").replace(/\((?:R|TM)\)/gi, "").replace(/\s+/g, " ")
      .replace(/\s*\(?\d+(?:[.,]\d+)?\s?GB\)?\s*$/i, "").trim();
    var m;
    if ((m = /(NVIDIA\s+)?GeForce\s+(?:RTX|GTX|GT)\s?\d{3,4}(?:\s?(?:Ti\s?SUPER|SUPER|Ti))?/i.exec(s))) return "NVIDIA " + m[0].replace(/^NVIDIA\s+/i, "");
    if ((m = /(AMD\s+)?Radeon\s+RX\s?\d{3,4}(?:\s?(?:XTX|XT|GRE))?/i.exec(s))) return "AMD " + m[0].replace(/^AMD\s+/i, "");
    return null;
  }
  function slug(s) {
    return String(s || "").toLowerCase().replace(/[\u2122\u00ae\u00a9]/g, "").replace(/&/g, " and ")
      .replace(/['\u2019`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function gameSlugs(name) {
    var out = [], full = slug(name);
    if (full) out.push(full);
    var short = slug(String(name || "").replace(/\(.*?\)/g, " ").split(/\s*[:\u2013\u2014]\s*|\s+-\s+/)[0]);
    if (short && short !== full && short.length > 2) out.push(short);
    return out;
  }

  return {
    cpuScore: cpuScore, gpuScore: gpuScore, gpuKey: gpuKey, alts: alts, reqMin: reqMin, reqMean: reqMean,
    rate: rate, estimateFps: estimateFps, cpuModel: cpuModel, gpuModel: gpuModel, slug: slug, gameSlugs: gameSlugs
  };
})();


  var KEY = "nnPcInfoSettings";
  var FPS_KEY = "nnPcInfoFps";
  var DEFAULTS = {
    title: "\ud83d\udda5\ufe0f \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u041f\u041a",
    accent: "#22d3ee", border: "#8b5cf6", bg: "#06080e", bgAlpha: 88, text: "#c9d1e0", label: "#8b95aa",
    fontSize: 12, width: 100, radius: 12, labelWidth: 170, compare: true, fps: true, online: true,
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


  // ---------------------------------------------------------------- requirements: CPU / GPU check
  function colReqs(col) {
    var o = { cpu: [], gpu: [] };
    if (!col) return o;
    var li = col.querySelectorAll("li");
    for (var i = 0; i < li.length; i++) {
      var t = li[i].textContent.replace(/\s+/g, " ").trim();
      var m = /^([^:\uff1a]{2,32})[:\uff1a]\s*(.+)$/.exec(t);
      if (!m) continue;
      var lab = m[1].toLowerCase();
      if (/processor|cpu|\u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440/.test(lab)) o.cpu = o.cpu.concat(HW.alts(m[2]));
      else if (/graphics|video|gpu|\u0432\u0438\u0434\u0435\u043e/.test(lab)) o.gpu = o.gpu.concat(HW.alts(m[2]));
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
      if (!x) return '<span class="nn-na" title="\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f">' + label + " ?</span>";
      var sign = x.cls === "ok" ? "\u2713" : (x.cls === "mid" ? "\u2248" : "\u2717");
      var tip = "\u0432\u0430\u0448 \u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442 \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u043e \u0432 " + x.r.toFixed(2) + " \u0440\u0430\u0437\u0430 \u043e\u0442 \u0442\u0440\u0435\u0431\u0443\u0435\u043c\u043e\u0433\u043e (\u043e\u0446\u0435\u043d\u043a\u0430 \u043f\u043e \u0443\u0441\u043b\u043e\u0432\u043d\u044b\u043c \u0431\u0430\u043b\u043b\u0430\u043c)";
      return '<span class="nn-' + x.cls + '" title="' + tip + '">' + label + " " + sign + " \u00d7" + x.r.toFixed(1) + "</span>";
    }
    return '<span class="nn-chk">' + one("\u041c\u0438\u043d", r.min) + " \u00b7 " + one("\u0420\u0435\u043a", r.rec) + "</span>";
  }
  function verdict(res) {
    function lvl(l) {
      var a = [];
      if (res.cpu[l]) a.push({ x: res.cpu[l], n: "\u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440" });
      if (res.gpu[l]) a.push({ x: res.gpu[l], n: "\u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430" });
      return a.length ? a : null;
    }
    function worst(a) { return a.reduce(function (w, v) { return v.x.r < w.x.r ? v : w; }); }
    function names(a) { return a.map(function (v) { return v.n; }).join(" \u0438 "); }
    var rec = lvl("rec"), min = lvl("min"), w;
    if (rec) {
      w = worst(rec);
      if (w.x.cls === "ok") return ["ok", "\u0412\u0430\u0448 " + names(rec) + " \u2014 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 \u0438\u043b\u0438 \u0432\u044b\u0448\u0435."];
      if (w.x.cls === "mid") return ["mid", "\u041f\u043e\u0447\u0442\u0438 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 (" + names(rec) + ") \u2014 \u0438\u0433\u0440\u0430 \u0434\u043e\u043b\u0436\u043d\u0430 \u0438\u0434\u0442\u0438 \u043d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e."];
      if (min && worst(min).x.cls !== "bad") return ["mid", "\u0412\u044b\u0448\u0435 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0445, \u043d\u043e \u043d\u0438\u0436\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 (\u0441\u043b\u0430\u0431\u0435\u0435 \u0432\u0441\u0435\u0433\u043e: " + w.n + ")."];
      return ["bad", "\u041d\u0438\u0436\u0435 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 \u0438\u0433\u0440\u044b (\u0441\u043b\u0430\u0431\u0435\u0435 \u0432\u0441\u0435\u0433\u043e: " + w.n + ") \u2014 \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u044b \u0441\u0438\u043b\u044c\u043d\u044b\u0435 \u0442\u043e\u0440\u043c\u043e\u0437\u0430."];
    }
    if (min) {
      w = worst(min);
      if (w.x.cls === "ok") return ["ok", "\u0421\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u043c \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c (" + names(min) + ")."];
      if (w.x.cls === "mid") return ["mid", "\u041f\u043e\u0447\u0442\u0438 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 (" + names(min) + ")."];
      return ["bad", "\u041d\u0438\u0436\u0435 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 (\u0441\u043b\u0430\u0431\u0435\u0435 \u0432\u0441\u0435\u0433\u043e: " + w.n + ")."];
    }
    return null;
  }

  // ---------------------------------------------------------------- FPS: local model + sites (via the Lua backend)
  var fps = { key: "", status: "idle", online: null, log: [] };
  var PRESETS = [["low", "\u041d\u0438\u0437\u043a\u0438\u0435"], ["medium", "\u0421\u0440\u0435\u0434\u043d\u0438\u0435"], ["high", "\u0412\u044b\u0441\u043e\u043a\u0438\u0435"], ["ultra", "\u0423\u043b\u044c\u0442\u0440\u0430"]];
  var RES_ROWS = [["1080p", "1920\u00d71080"], ["1440p", "2560\u00d71440"], ["4k", "3840\u00d72160"]];

  function appId() { var m = /\/app\/(\d+)/.exec(location.href); return m ? m[1] : ""; }
  function gameName() {
    var e = document.getElementById("appHubAppName") || document.querySelector(".apphub_AppName");
    return e ? e.textContent.trim() : "";
  }
  function nativeRes() {
    var m = /(\d{3,4})\s*[x\u00d7]\s*(\d{3,4})/.exec(String((state.data && state.data.display) || ""));
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
  var NUM = "(\\d{1,3}(?:\\.\\d)?)(?!\\d|\\s?[pPxX\u00d7])";
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
    var out = {}, pos = markPositions(text, [["1080p", /1920\s*[x\u00d7]\s*1080/], ["1440p", /2560\s*[x\u00d7]\s*1440/], ["4k", /3840\s*[x\u00d7]\s*2160/]]);
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
      out.push({ src: "checkfps.io", url: "https://checkfps.io/en/fps-calculator/" + g + "/" + short, parse: parseCheckfps, noCpu: true, note: "\u0440\u0430\u0441\u0447\u0451\u0442 \u0441\u0430\u0439\u0442\u0430 \u0434\u043b\u044f \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440\u0430 Core i5-13400" });
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
      h += '<tr' + (r[0] === nat ? ' class="nat"' : "") + "><th>" + r[1] + (r[0] === nat ? " \u25c2 \u0432\u0430\u0448 \u043c\u043e\u043d\u0438\u0442\u043e\u0440" : "") + "</th>";
      PRESETS.forEach(function (p) { h += '<td class="' + fpsClass(row[p[0]]) + '">' + (row[p[0]] != null ? row[p[0]] : "\u2014") + "</td>"; });
      h += "</tr>";
    });
    return h + "</table>";
  }
  function fpsBlock(s, local) {
    if (!s.fps) return "";
    var h = '<div class="nn-fps"><h4>\u041f\u0440\u0438\u043c\u0435\u0440\u043d\u044b\u0439 FPS \u043d\u0430 \u0432\u0430\u0448\u0435\u043c \u041f\u041a</h4>';
    if (fps.status === "done" && fps.online) {
      var o = fps.online;
      h += fpsTable(o.data) + '<div class="nn-src">\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: <a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + esc(o.src) + "</a>" +
        (o.cpu || o.gpu ? " \u2014 " + esc([o.cpu, o.gpu].filter(Boolean).join(" + ")) : "") + (o.note ? " (" + esc(o.note) + ")" : "") +
        ". \u042d\u0442\u043e \u043e\u0446\u0435\u043d\u043a\u0430 \u0441\u0430\u0439\u0442\u0430, \u0430 \u043d\u0435 \u0437\u0430\u043c\u0435\u0440 \u043d\u0430 \u0432\u0430\u0448\u0435\u043c \u041f\u041a.</div>";
    } else if (local) {
      h += fpsTable(local) + '<div class="nn-src">\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0446\u0435\u043d\u043a\u0430 \u043f\u043e \u0441\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u043c \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c \u0438\u0433\u0440\u044b (\u2248 \u00b130 %). ' +
        (s.online ? (fps.status === "loading" ? "\u0418\u0449\u0443 \u0434\u0430\u043d\u043d\u044b\u0435 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445\u2026" : (fps.status === "norpc" ? "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u0431\u044d\u043a\u0435\u043d\u0434\u043e\u043c \u043f\u043b\u0430\u0433\u0438\u043d\u0430 \u2014 \u0441\u0430\u0439\u0442\u044b \u043d\u0435 \u043e\u043f\u0440\u043e\u0448\u0435\u043d\u044b." : "\u0414\u0430\u043d\u043d\u044b\u0445 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445 \u0434\u043b\u044f \u044d\u0442\u043e\u0439 \u0438\u0433\u0440\u044b \u043d\u0435 \u043d\u0430\u0448\u043b\u043e\u0441\u044c.")) : "\u041f\u043e\u0438\u0441\u043a \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445 \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445.") + "</div>";
    } else {
      return '<div class="nn-fps"><h4>\u041f\u0440\u0438\u043c\u0435\u0440\u043d\u044b\u0439 FPS \u043d\u0430 \u0432\u0430\u0448\u0435\u043c \u041f\u041a</h4><div class="nn-src">' +
        (fps.status === "loading" ? "\u0418\u0449\u0443 \u0434\u0430\u043d\u043d\u044b\u0435 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445\u2026" : "\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445: \u0432 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u0445 \u0438\u0433\u0440\u044b \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u044b \u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0435 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440/\u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430, \u0438 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445 \u044d\u0442\u0430 \u0438\u0433\u0440\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.") + "</div></div>";
    }
    return h + "</div>";
  }

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
      if (v) html += '<div class="nn-verdict nn-v-' + v[0] + '">' + (v[0] === "ok" ? "\u2713 " : (v[0] === "mid" ? "\u2248 " : "\u2717 ")) + v[1] + "</div>";
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
    var h = '<div class="nn-set"><h4>\u0412\u0438\u0434</h4>' +
      '<label><span>\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a</span><input type="text" data-k="title" value="' + esc(s.title) + '"></label>' +
      col("accent", "\u0410\u043a\u0446\u0435\u043d\u0442", s.accent) + col("border", "\u0420\u0430\u043c\u043a\u0430", s.border) + col("bg", "\u0424\u043e\u043d", s.bg) +
      col("text", "\u0422\u0435\u043a\u0441\u0442", s.text) + col("label", "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u044f \u0441\u0442\u0440\u043e\u043a", s.label) +
      num("bgAlpha", "\u041d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u044c \u0444\u043e\u043d\u0430, %", s.bgAlpha, 0, 100) +
      num("fontSize", "\u0420\u0430\u0437\u043c\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430, px", s.fontSize, 9, 24) +
      num("width", "\u0428\u0438\u0440\u0438\u043d\u0430, %", s.width, 30, 100) +
      num("radius", "\u0421\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u0438\u0435, px", s.radius, 0, 30) +
      num("labelWidth", "\u0428\u0438\u0440\u0438\u043d\u0430 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0439, px", s.labelWidth, 60, 300) +
      '<label><span>\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u2713/\u2717 (\u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440, \u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430)</span><input type="checkbox" data-k="compare"' + (s.compare ? " checked" : "") + "></label>" +
      '<label><span>\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u044b\u0439 FPS</span><input type="checkbox" data-k="fps"' + (s.fps ? " checked" : "") + "></label>" +
      '<label><span>\u0418\u0441\u043a\u0430\u0442\u044c FPS \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445</span><input type="checkbox" data-k="online"' + (s.online ? " checked" : "") + "></label>" +
      "<h4>\u0421\u0442\u0440\u043e\u043a\u0438: \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c / \u0441\u0432\u043e\u0451 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 (\u043f\u0443\u0441\u0442\u043e = \u0430\u0432\u0442\u043e)</h4>";
    ROWS.forEach(function (r) {
      h += '<label><input type="checkbox" data-show="' + r[0] + '"' + (s.hidden[r[0]] ? "" : " checked") + "><span>" + r[1] + '</span><input type="text" data-c="' + r[0] + '" value="' + esc(s.custom[r[0]] || "") + '" placeholder="' + esc(String(auto[r[0]] || "").replace(/<br>/g, ", ").replace(/&amp;/g, "&")) + '"></label>';
    });
    h += "<h4>\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0442\u0440\u043e\u043a\u0438</h4>";
    for (var i = 0; i < 4; i++) {
      var e = (s.extra || [])[i] || {};
      h += '<label><input type="text" data-el="' + i + '" value="' + esc(e.label || "") + '" placeholder="\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435" style="max-width:150px"><input type="text" data-ev="' + i + '" value="' + esc(e.value || "") + '" placeholder="\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435"></label>';
    }
    return h + '<button data-act="refresh">\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c FPS</button><button data-act="reset">\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c</button></div>';
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
