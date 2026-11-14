/* pc-info webkit module: "PC configuration" block under the system requirements on Steam store pages.
   - shows immediately with built-in default specs; detected specs (Lua/PowerShell backend) replace them
   - compares CPU / GPU / RAM / VRAM / SSD with the game's requirements
   - FPS table: average of several FPS-estimate sites (via the Lua backend) or a local estimate
   - gear button: look, language, sources, resolution, scores, rows (saved in localStorage)
   - Russian / English, auto-detected from the Steam page language */
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
    gpus: [],
    directx: "12",
    board: "MSI MPG B550 GAMING PLUS",
    display: "AQ27H3 27\" 2560x1440 180 Hz HDR",
    disks: [
      { id: "C:", free: null, total: 243, model: "Silicon Power NVMe", type: "NVMe" },
      { id: "D:", free: null, total: 488, model: "Apacer AS350 SSD", type: "SSD" },
      { id: "E:", free: null, total: 476, model: "Toshiba HDWD105 HDD", type: "HDD" }
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
    intelhd4000: 700, intelhd4600: 900, intelhd520: 1000, intelhd530: 1200, intelhd620: 1300, intelhd630: 1700, uhd620: 1400, uhd630: 1700, irisxe: 2000
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
    if (!k || !GPU[k]) return null;
    var n = norm(raw), v = GPU[k];
    if (/max-?q/.test(n)) return Math.round(v * 0.65);
    if (/laptop|notebook|mobile|\bmx\d|\(m\)/.test(n) || /\d{3,4}m\b/.test(n)) return Math.round(v * 0.75);
    return v;
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
      var kk = suf.replace(/f$/, "").replace(/^ks$/, "k");
      var mob = { t: 0.65, h: 0.8, hk: 0.9, hx: 0.95, u: 0.4, p: 0.6 }[kk];
      if (kk !== "" && kk !== "k" && kk !== "s" && !mob) return null;   // X (HEDT), G-series... : don't guess
      var key = "i" + tier + "-" + digits + (kk === "k" ? "k" : "");
      if (IC_OVR[key]) return IC_OVR[key];
      v = IC[tier] && IC[tier][gen];
      if (!v) return null;
      if (mob) return Math.round(v * mob);
      return Math.round(kk === "k" ? v * (gen >= 12 ? 1.28 : 1.12) : v);
    }
    if ((m = /ryzen\s?([3579])\s?(?:pro\s)?(\d{4})\s?(hx3d|hx|hs|h|x3d|xt|x|gt|ge|g|f|u|e)?(?![a-z0-9])/.exec(s))) {
      var rs = m[3] || "";
      var rk = m[1] + "-" + m[2] + rs;
      if (RZ_OVR[rk]) return RZ_OVR[rk];
      var rmob = { h: 0.75, hs: 0.7, hx: 0.95, hx3d: 1.0, u: 0.45, e: 0.5, ge: 0.7 }[rs];
      var base = RZ[m[1]] && RZ[m[1]][+m[2].charAt(0)];
      if (!base) return null;
      if (rs === "x" || rs === "xt") base *= 1.06;
      if (rs === "x3d") base *= 1.1;
      if (rs === "g" || rs === "gt") base *= 0.88;
      if (rmob) base *= rmob;
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
  // (an outlier far below the others, e.g. "or Intel HD 630" next to GTX 660, is ignored)
  function reqMin(list, fn) {
    var a = scoreList(list, fn);
    if (!a.length) return null;
    var hi = Math.max.apply(null, a);
    a = a.filter(function (v) { return v >= hi * 0.5; });
    return Math.min.apply(null, a);
  }
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
  function estimateFps(reqs, mc, mg) {   // mc / mg: your CPU / GPU scores (numbers)
    var gMin = reqMean(reqs.min.gpu, gpuScore), gRec = reqMean(reqs.rec.gpu, gpuScore);
    var cMin = reqMean(reqs.min.cpu, cpuScore), cRec = reqMean(reqs.rec.cpu, cpuScore);
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


  // ================================================================ texts (ru / en)
  var I18N = {
    ru: {
      title: "\ud83d\udda5\ufe0f \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u041f\u041a",
      r_cpu: "\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440", r_gpu: "\u0412\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430", r_ram: "\u041e\u043f\u0435\u0440\u0430\u0442\u0438\u0432\u043d\u0430\u044f \u043f\u0430\u043c\u044f\u0442\u044c", r_board: "\u041c\u0430\u0442\u0435\u0440\u0438\u043d\u0441\u043a\u0430\u044f \u043f\u043b\u0430\u0442\u0430",
      r_os: "\u041e\u0421", r_directx: "DirectX", r_disks: "\u0414\u0438\u0441\u043a\u0438", r_audio: "\u0417\u0432\u0443\u043a", r_display: "\u041c\u043e\u043d\u0438\u0442\u043e\u0440",
      src_auto: "\u2713 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u044b \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438", src_wait: "\u043f\u043e\u043a\u0430 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u2014 \u0438\u0434\u0451\u0442 \u0430\u0432\u0442\u043e\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435\u2026",
      gb: "\u0413\u0411", min: "\u041c\u0438\u043d", rec: "\u0420\u0435\u043a",
      chk_tip: "\u0432\u0430\u0448 \u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442 \u2248 \u00d7{0} \u043e\u0442 \u0442\u0440\u0435\u0431\u0443\u0435\u043c\u043e\u0433\u043e (\u043e\u0446\u0435\u043d\u043a\u0430 \u043f\u043e \u0443\u0441\u043b\u043e\u0432\u043d\u044b\u043c \u0431\u0430\u043b\u043b\u0430\u043c)", na_tip: "\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f",
      unk: "\u26a0 \u043d\u0435 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d \u2014 \u0432\u0432\u0435\u0441\u0442\u0438 \u0431\u0430\u043b\u043b\u044b", vram_tip: "\u0432\u0438\u0434\u0435\u043e\u043f\u0430\u043c\u044f\u0442\u044c: \u0443 \u0432\u0430\u0441 {0} \u0413\u0411, \u043d\u0443\u0436\u043d\u043e {1} \u0413\u0411",
      n_cpu: "\u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440", n_gpu: "\u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430", n_ram: "\u043e\u043f\u0435\u0440\u0430\u0442\u0438\u0432\u043d\u0430\u044f \u043f\u0430\u043c\u044f\u0442\u044c", n_vram: "\u0432\u0438\u0434\u0435\u043e\u043f\u0430\u043c\u044f\u0442\u044c", and: " \u0438 ",
      v_rec_ok: "\u0412\u0430\u0448 {0} \u2014 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 \u0438\u043b\u0438 \u0432\u044b\u0448\u0435.",
      v_rec_mid: "\u041f\u043e\u0447\u0442\u0438 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 ({0}) \u2014 \u0438\u0433\u0440\u0430 \u0434\u043e\u043b\u0436\u043d\u0430 \u0438\u0434\u0442\u0438 \u043d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e.",
      v_between: "\u0412\u044b\u0448\u0435 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0445, \u043d\u043e \u043d\u0438\u0436\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 (\u0441\u043b\u0430\u0431\u0435\u0435 \u0432\u0441\u0435\u0433\u043e: {0}).",
      v_bad: "\u041d\u0438\u0436\u0435 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 \u0438\u0433\u0440\u044b (\u0441\u043b\u0430\u0431\u0435\u0435 \u0432\u0441\u0435\u0433\u043e: {0}) \u2014 \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u044b \u0441\u0438\u043b\u044c\u043d\u044b\u0435 \u0442\u043e\u0440\u043c\u043e\u0437\u0430.",
      v_min_ok: "\u0421\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u043c \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c ({0}).", v_min_mid: "\u041f\u043e\u0447\u0442\u0438 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 ({0}).",
      v_min_bad: "\u041d\u0438\u0436\u0435 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 (\u0441\u043b\u0430\u0431\u0435\u0435 \u0432\u0441\u0435\u0433\u043e: {0}).",
      s_ok: "\u041f\u043e\u0434\u0445\u043e\u0434\u0438\u0442", s_mid: "\u041f\u043e\u0447\u0442\u0438 \u043d\u0430 \u0443\u0440\u043e\u0432\u043d\u0435", s_bad: "\u0421\u043b\u0430\u0431\u043e\u0432\u0430\u0442\u043e",
      bn: "\u0423\u0437\u043a\u043e\u0435 \u043c\u0435\u0441\u0442\u043e: {0} (\u0443 {1} \u0437\u0430\u043f\u0430\u0441 \u00d7{2}).", balanced: "\u0421\u0432\u044f\u0437\u043a\u0430 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440 + \u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430 \u0441\u0431\u0430\u043b\u0430\u043d\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u0430.",
      ssd_ok: "\u0418\u0433\u0440\u0435 \u043d\u0443\u0436\u0435\u043d SSD \u2014 \u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043d\u0430 {0} ({1}, \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e {2} \u0413\u0411).",
      ssd_rec_ok: "SSD \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f \u2014 \u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043d\u0430 {0} ({1}, \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e {2} \u0413\u0411).",
      ssd_hdd: "\u0418\u0433\u0440\u0435 \u043d\u0443\u0436\u0435\u043d SSD, \u0430 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0433\u043e \u043c\u0435\u0441\u0442\u0430 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 HDD ({0}). \u041e\u0441\u0432\u043e\u0431\u043e\u0434\u0438\u0442\u0435 \u043c\u0435\u0441\u0442\u043e \u043d\u0430 SSD.",
      ssd_rec_hdd: "SSD \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f, \u043d\u043e \u0441\u0435\u0439\u0447\u0430\u0441 \u043c\u0435\u0441\u0442\u0430 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 HDD ({0}).",
      dlc_note: "\u0423 \u044d\u0442\u043e\u0433\u043e DLC \u043d\u0435\u0442 \u0441\u0432\u043e\u0438\u0445 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u0439 \u2014 \u0432\u0437\u044f\u0442\u044b \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u0438\u0433\u0440\u044b: {0}.",
      fps_title: "\u041f\u0440\u0438\u043c\u0435\u0440\u043d\u044b\u0439 FPS \u043d\u0430 \u0432\u0430\u0448\u0435\u043c \u041f\u041a", pr_low: "\u041d\u0438\u0437\u043a\u0438\u0435", pr_medium: "\u0421\u0440\u0435\u0434\u043d\u0438\u0435", pr_high: "\u0412\u044b\u0441\u043e\u043a\u0438\u0435", pr_ultra: "\u0423\u043b\u044c\u0442\u0440\u0430",
      at_monitor: " \u25c2 \u0432\u0430\u0448 \u043c\u043e\u043d\u0438\u0442\u043e\u0440", at_res: " \u25c2 \u0432\u0430\u0448\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0435", fps_min: "\u043c\u0438\u043d. {0}",
      fps_avg: "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u043f\u043e {0} \u0441\u0430\u0439\u0442\u0430\u043c: {1}.", fps_one: "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: {0}.", fps_not_measure: "\u042d\u0442\u043e \u043e\u0446\u0435\u043d\u043a\u0438 \u0441\u0430\u0439\u0442\u043e\u0432, \u0430 \u043d\u0435 \u0437\u0430\u043c\u0435\u0440\u044b \u043d\u0430 \u0432\u0430\u0448\u0435\u043c \u041f\u041a.",
      fps_local: "\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0446\u0435\u043d\u043a\u0430 \u043f\u043e \u0441\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u043c \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c \u0438\u0433\u0440\u044b (\u2248 \u00b130 %).", fps_more: "\u0418\u0449\u0443 \u0435\u0449\u0451 \u043d\u0430 \u0434\u0440\u0443\u0433\u0438\u0445 \u0441\u0430\u0439\u0442\u0430\u0445\u2026",
      fps_loading: "\u0418\u0449\u0443 \u0434\u0430\u043d\u043d\u044b\u0435 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445\u2026", fps_none: "\u0414\u0430\u043d\u043d\u044b\u0445 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445 \u0434\u043b\u044f \u044d\u0442\u043e\u0439 \u0438\u0433\u0440\u044b \u043d\u0435 \u043d\u0430\u0448\u043b\u043e\u0441\u044c.",
      fps_norpc: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u0431\u044d\u043a\u0435\u043d\u0434\u043e\u043c \u043f\u043b\u0430\u0433\u0438\u043d\u0430 \u2014 \u0441\u0430\u0439\u0442\u044b \u043d\u0435 \u043e\u043f\u0440\u043e\u0448\u0435\u043d\u044b.", fps_off: "\u041f\u043e\u0438\u0441\u043a \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445 \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445.",
      fps_nodata: "\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445: \u0432 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u0445 \u0438\u0433\u0440\u044b \u043d\u0435\u0442 \u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0445 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440\u0430/\u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u044b, \u0430 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445 \u0438\u0433\u0440\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.",
      hz_legend: "\u041f\u043e\u0434\u0447\u0451\u0440\u043a\u043d\u0443\u0442\u043e \u2014 \u0434\u043e\u0441\u0442\u0438\u0433\u0430\u0435\u0442 \u0447\u0430\u0441\u0442\u043e\u0442\u044b {0} \u0413\u0446.", cpu_adj_yes: "checkfps.io: \u043f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u043d\u043e \u0441 Core i5-13400 \u043f\u043e\u0434 \u0432\u0430\u0448 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440",
      cpu_adj_no: "checkfps.io \u0441\u0447\u0438\u0442\u0430\u0435\u0442 \u0434\u043b\u044f Core i5-13400 (\u0432\u0430\u0448 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440 \u043d\u0435 \u0441\u043b\u0430\u0431\u0435\u0435)", detail_tip: "\u043f\u043e \u0441\u0430\u0439\u0442\u0430\u043c",
      up_head: "\u0410\u043f\u0441\u043a\u0435\u0439\u043b ({0}, {1}; \u043e\u0446\u0435\u043d\u043a\u0430, \u0435\u0441\u043b\u0438 \u0438\u0433\u0440\u0430 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442):", fg: "+ \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u043a\u0430\u0434\u0440\u043e\u0432",
      fold: "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c", unfold: "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c", settings: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
      p_view: "\u0412\u0438\u0434", p_title: "\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a", p_lang: "\u042f\u0437\u044b\u043a", p_lang_auto: "\u0410\u0432\u0442\u043e (\u043a\u0430\u043a \u0432 Steam)",
      p_accent: "\u0410\u043a\u0446\u0435\u043d\u0442", p_border: "\u0420\u0430\u043c\u043a\u0430", p_bg: "\u0424\u043e\u043d", p_text: "\u0422\u0435\u043a\u0441\u0442", p_label: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u044f \u0441\u0442\u0440\u043e\u043a",
      p_alpha: "\u041d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u044c \u0444\u043e\u043d\u0430, %", p_font: "\u0420\u0430\u0437\u043c\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430, px", p_width: "\u0428\u0438\u0440\u0438\u043d\u0430, %", p_radius: "\u0421\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u0438\u0435, px", p_lw: "\u0428\u0438\u0440\u0438\u043d\u0430 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0439, px",
      p_compare: "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043f\u043e \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c (\u2713/\u2248/\u2717)", p_fps: "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u044b\u0439 FPS", p_online: "\u0418\u0441\u043a\u0430\u0442\u044c FPS \u043d\u0430 \u0441\u0430\u0439\u0442\u0430\u0445",
      p_upscale: "\u0421\u0442\u0440\u043e\u043a\u0430 \u043f\u0440\u043e DLSS / FSR", p_collapsed: "\u0421\u0432\u0451\u0440\u043d\u0443\u0442\u044b\u0439 (\u043a\u043e\u043c\u043f\u0430\u043a\u0442\u043d\u044b\u0439) \u0432\u0438\u0434",
      p_play: "\u0418\u0433\u0440\u043e\u0432\u043e\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u0438 \u0447\u0430\u0441\u0442\u043e\u0442\u0430", p_playres: "\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0435, \u043d\u0430 \u043a\u043e\u0442\u043e\u0440\u043e\u043c \u0432\u044b \u0438\u0433\u0440\u0430\u0435\u0442\u0435", p_auto_monitor: "\u0410\u0432\u0442\u043e (\u043f\u043e \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0443)",
      p_hz: "\u0426\u0435\u043b\u0435\u0432\u0430\u044f \u0447\u0430\u0441\u0442\u043e\u0442\u0430, \u0413\u0446 (0 = \u043a\u0430\u043a \u0443 \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0430)",
      p_sources: "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 FPS (\u0431\u0435\u0440\u0451\u0442\u0441\u044f \u0441\u0440\u0435\u0434\u043d\u0435\u0435 \u043f\u043e \u0432\u043a\u043b\u044e\u0447\u0451\u043d\u043d\u044b\u043c)", p_scores: "\u0421\u0432\u043e\u0438 \u0431\u0430\u043b\u043b\u044b (0 = \u0430\u0432\u0442\u043e)",
      p_score_cpu: "\u0411\u0430\u043b\u043b\u044b \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440\u0430", p_score_gpu: "\u0411\u0430\u043b\u043b\u044b \u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u044b",
      p_score_hint: "\u0428\u043a\u0430\u043b\u0430 \u0443\u0441\u043b\u043e\u0432\u043d\u0430\u044f (\u043a\u0430\u043a PassMark): RTX 3060 \u2248 17000, RTX 4070 \u2248 27000, Ryzen 5 5600X \u2248 21800, Core i5-12400 \u2248 19000. \u0420\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d\u043e: \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440 {0}, \u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430 {1}.",
      p_rows: "\u0421\u0442\u0440\u043e\u043a\u0438: \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c / \u0441\u0432\u043e\u0451 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 (\u043f\u0443\u0441\u0442\u043e = \u0430\u0432\u0442\u043e)", p_extra: "\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0442\u0440\u043e\u043a\u0438", p_ph_name: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", p_ph_value: "\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
      p_refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c FPS", p_reset: "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c"
    },
    en: {
      title: "\ud83d\udda5\ufe0f PC configuration",
      r_cpu: "Processor", r_gpu: "Graphics card", r_ram: "Memory", r_board: "Motherboard",
      r_os: "OS", r_directx: "DirectX", r_disks: "Disks", r_audio: "Audio", r_display: "Display",
      src_auto: "\u2713 specs detected automatically", src_wait: "showing saved data \u2014 auto-detection in progress\u2026",
      gb: "GB", min: "Min", rec: "Rec",
      chk_tip: "your part \u2248 \u00d7{0} of the required one (rough score-based estimate)", na_tip: "no data to compare",
      unk: "\u26a0 not recognised \u2014 enter score", vram_tip: "video memory: you have {0} GB, needed {1} GB",
      n_cpu: "CPU", n_gpu: "GPU", n_ram: "RAM", n_vram: "VRAM", and: " and ",
      v_rec_ok: "Your {0} meet the recommended requirements or better.",
      v_rec_mid: "Close to the recommended requirements ({0}) \u2014 the game should run fine.",
      v_between: "Above minimum but below recommended requirements (weakest: {0}).",
      v_bad: "Below the game's requirements (weakest: {0}) \u2014 expect heavy slowdowns.",
      v_min_ok: "Meets the minimum requirements ({0}).", v_min_mid: "Close to the minimum requirements ({0}).",
      v_min_bad: "Below the minimum requirements (weakest: {0}).",
      s_ok: "Runs well", s_mid: "Borderline", s_bad: "Below spec",
      bn: "Bottleneck: {0} ({1} has \u00d7{2} headroom).", balanced: "CPU and GPU are well balanced.",
      ssd_ok: "The game wants an SSD \u2014 install it on {0} ({1}, {2} GB free).",
      ssd_rec_ok: "An SSD is recommended \u2014 install it on {0} ({1}, {2} GB free).",
      ssd_hdd: "The game wants an SSD, but only an HDD ({0}) has enough free space. Free up space on an SSD.",
      ssd_rec_hdd: "An SSD is recommended, but only an HDD ({0}) has enough free space now.",
      dlc_note: "This DLC has no requirements of its own \u2014 using the base game's: {0}.",
      fps_title: "Estimated FPS on your PC", pr_low: "Low", pr_medium: "Medium", pr_high: "High", pr_ultra: "Ultra",
      at_monitor: " \u25c2 your display", at_res: " \u25c2 your resolution", fps_min: "min {0}",
      fps_avg: "Average of {0} sites: {1}.", fps_one: "Source: {0}.", fps_not_measure: "These are the sites' estimates, not measurements of your PC.",
      fps_local: "Local estimate from the game's own requirements (\u2248 \u00b130%).", fps_more: "Looking at more sites\u2026",
      fps_loading: "Looking for data on the sites\u2026", fps_none: "No data found on the sites for this game.",
      fps_norpc: "Could not reach the plugin backend \u2014 the sites were not queried.", fps_off: "Site lookup is turned off in the settings.",
      fps_nodata: "No data: the requirements list no known CPU/GPU and the game was not found on the sites.",
      hz_legend: "Underlined \u2014 reaches {0} Hz.", cpu_adj_yes: "checkfps.io: rescaled from Core i5-13400 to your CPU",
      cpu_adj_no: "checkfps.io assumes a Core i5-13400 (your CPU is not slower)", detail_tip: "per site",
      up_head: "Upscaling ({0}, {1}; estimate, if the game supports it):", fg: "+ frame generation",
      fold: "Collapse", unfold: "Expand", settings: "Settings",
      p_view: "Look", p_title: "Title", p_lang: "Language", p_lang_auto: "Auto (as in Steam)",
      p_accent: "Accent", p_border: "Border", p_bg: "Background", p_text: "Text", p_label: "Row names",
      p_alpha: "Background opacity, %", p_font: "Font size, px", p_width: "Width, %", p_radius: "Corner radius, px", p_lw: "Name column width, px",
      p_compare: "Check against requirements (\u2713/\u2248/\u2717)", p_fps: "Show estimated FPS", p_online: "Look up FPS on the sites",
      p_upscale: "DLSS / FSR line", p_collapsed: "Collapsed (compact) view",
      p_play: "Play resolution and refresh rate", p_playres: "Resolution you play at", p_auto_monitor: "Auto (from the monitor)",
      p_hz: "Target refresh rate, Hz (0 = same as monitor)",
      p_sources: "FPS sources (the average of the enabled ones is used)", p_scores: "Own scores (0 = auto)",
      p_score_cpu: "CPU score", p_score_gpu: "GPU score",
      p_score_hint: "Rough PassMark-like scale: RTX 3060 \u2248 17000, RTX 4070 \u2248 27000, Ryzen 5 5600X \u2248 21800, Core i5-12400 \u2248 19000. Recognised: CPU {0}, GPU {1}.",
      p_rows: "Rows: show / own value (empty = auto)", p_extra: "Extra rows", p_ph_name: "Name", p_ph_value: "Value",
      p_refresh: "Refresh FPS", p_reset: "Reset"
    }
  };
  var LANG = "en";
  function t(k) {
    var d = I18N[LANG] || I18N.en, v = d[k];
    if (v == null) v = I18N.en[k];
    if (v == null) return k;
    for (var i = 1; i < arguments.length; i++) v = v.split("{" + (i - 1) + "}").join(arguments[i]);
    return v;
  }
  function pickLang(s) {
    if (s.lang === "ru" || s.lang === "en") return s.lang;
    var l = (document.documentElement.lang || "").toLowerCase();
    if (!l) {
      var m = /(?:^|;\s*)Steam_Language=([a-z]+)/i.exec(document.cookie || "");
      if (m) return /^russian$/i.test(m[1]) ? "ru" : "en";
    }
    return l.indexOf("ru") === 0 ? "ru" : "en";
  }

  // ================================================================ settings
  var KEY = "nnPcInfoSettings";
  var FPS_KEY = "nnPcInfoFps2";
  var DEFAULTS = {
    title: "", lang: "auto",
    accent: "#22d3ee", border: "#8b5cf6", bg: "#06080e", bgAlpha: 88, text: "#c9d1e0", label: "#8b95aa",
    fontSize: 12, width: 100, radius: 12, labelWidth: 170,
    compare: true, fps: true, online: true, upscale: true, collapsed: false,
    playRes: "auto", targetHz: 0, scoreCpu: 0, scoreGpu: 0,
    sources: { fpsbench: true, chipversus: true, checkfps: true },
    hidden: {}, custom: {}, extra: []
  };
  var ROWS = ["cpu", "gpu", "ram", "board", "os", "directx", "disks", "audio", "display"];

  var state = { data: DEFAULT_DATA, source: "default", updated: "" };
  var box = null, styleEl = null, open = false, focusScore = false;

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { s = {}; }
    var o = {}, k;
    for (k in DEFAULTS) o[k] = (s[k] !== undefined) ? s[k] : DEFAULTS[k];
    var src = {};
    for (k in DEFAULTS.sources) src[k] = !(s.sources && s.sources[k] === false);
    o.sources = src;
    if (s.title === "\ud83d\udda5\ufe0f \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u041f\u041a") o.title = "";      // old default title -> follow the language
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
    unit = String(unit).toLowerCase();
    if (/^(mb|\u043c\u0431)/.test(unit)) return v / 1024;
    if (/^(tb|\u0442\u0431)/.test(unit)) return v * 1024;
    return v;
  }

  // ================================================================ requirements
  var SIZE = /(\d+(?:[.,]\d+)?)\s*(MB|GB|TB|\u041c\u0411|\u0413\u0411|\u0422\u0411)/i;
  function colReqs(col) {
    var o = { cpu: [], gpu: [], ram: null, vram: null, disk: null, ssd: 0 };
    if (!col) return o;
    var li = col.querySelectorAll("li");
    for (var i = 0; i < li.length; i++) {
      var tx = li[i].textContent.replace(/\s+/g, " ").trim();
      var m = /^([^:\uff1a]{2,32})[:\uff1a]\s*(.+)$/.exec(tx);
      if (!m) continue;
      var lab = m[1].toLowerCase(), val = m[2], z;
      if (/processor|cpu|\u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0440/.test(lab)) o.cpu = o.cpu.concat(HW.alts(val));
      else if (/graphics|video|gpu|\u0432\u0438\u0434\u0435\u043e/.test(lab)) {
        o.gpu = o.gpu.concat(HW.alts(val));
        z = /(\d+(?:[.,]\d+)?)\s*(GB|\u0413\u0411|MB|\u041c\u0411)\s*(?:of\s*)?(?:dedicated\s*)?(?:v?ram|video|\u0432\u0438\u0434\u0435\u043e)/i.exec(val);
        if (z && o.vram === null) o.vram = toGB(z[1], z[2]);
      } else if (/memory|ram|\u043e\u043f\u0435\u0440\u0430\u0442\u0438\u0432|\u043f\u0430\u043c\u044f\u0442/.test(lab)) {
        z = SIZE.exec(val);
        if (z && o.ram === null) o.ram = toGB(z[1], z[2]);
      } else if (/storage|hard drive|disk|drive|\u043c\u0435\u0441\u0442\u043e|\u043d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b|\u0434\u0438\u0441\u043a/.test(lab)) {
        z = SIZE.exec(val);
        if (z && o.disk === null) o.disk = toGB(z[1], z[2]);
        if (/ssd|solid[- ]state/i.test(val)) {
          var strict = /(ssd|solid[- ]state)[^.;,]{0,25}(required|only|mandatory)|(required|only)[^.;,]{0,12}(ssd|solid)/i.test(val) ||
            !/recommend|prefer|ideal|\u0436\u0435\u043b\u0430\u0442\u0435\u043b\u044c\u043d\u043e|\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434/i.test(val);
          o.ssd = Math.max(o.ssd, strict ? 2 : 1);
        }
      }
    }
    return o;
  }
  function readReqs(sys) {
    var scope = sys.querySelector('.game_area_sys_req[data-os="win"]') || sys.querySelector(".game_area_sys_req") || sys;
    var left = scope.querySelector(".game_area_sys_req_leftCol"), right = scope.querySelector(".game_area_sys_req_rightCol");
    if (left || right) return { min: colReqs(left), rec: colReqs(right) };
    return { min: colReqs(scope), rec: colReqs(null) };
  }

  // ================================================================ my hardware
  function parseDisplay(s) {
    var str = String((s.custom && s.custom.display) || (state.data && state.data.display) || "");
    var m = /(\d{3,4})\s*[x\u00d7]\s*(\d{3,4})/.exec(str), h = /(\d{2,3})\s*Hz/i.exec(str);
    return { w: m ? +m[1] : 0, h: m ? +m[2] : 0, hz: h ? +h[1] : 0 };
  }
  function resKey(h) { return h >= 2000 ? "4k" : (h >= 1300 ? "1440p" : (h > 0 ? "1080p" : "")); }
  function playRes(s) { return s.playRes && s.playRes !== "auto" ? s.playRes : (resKey(parseDisplay(s).h) || "1080p"); }
  function targetHz(s) { return s.targetHz > 0 ? +s.targetHz : parseDisplay(s).hz; }
  function myParts(s) {
    return { cpu: s.custom.cpu || state.data.cpu || "", gpu: s.custom.gpu || state.data.gpu || "" };
  }
  function myScores(s, my) {
    var ca = HW.cpuScore(my.cpu), ga = HW.gpuScore(my.gpu);
    return { cpu: s.scoreCpu > 0 ? +s.scoreCpu : ca, gpu: s.scoreGpu > 0 ? +s.scoreGpu : ga, cpuAuto: ca, gpuAuto: ga };
  }
  function myRam(s) {
    var v = s.custom.ram ? parseFloat(String(s.custom.ram).replace(",", ".")) : state.data.ramGB;
    return v && !isNaN(v) ? v : null;
  }
  function myVram(my) {
    var m = /(\d+(?:[.,]\d+)?)\s*GB/i.exec(my.gpu);
    return m ? parseFloat(m[1].replace(",", ".")) : null;
  }

  // ================================================================ checks
  function memRate(have, need) {
    if (!have || !need) return null;
    var ok = have + 0.5 >= need;
    return { r: have / need, cls: ok ? "ok" : "bad" };
  }
  function checkHw(reqs, s, my, sc) {
    var res = { cpu: {}, gpu: {}, ram: {}, vram: {} }, ram = myRam(s), vram = myVram(my);
    ["min", "rec"].forEach(function (l) {
      res.cpu[l] = HW.rate(sc.cpu, HW.reqMin(reqs[l].cpu, HW.cpuScore));
      res.gpu[l] = HW.rate(sc.gpu, HW.reqMin(reqs[l].gpu, HW.gpuScore));
      res.ram[l] = memRate(ram, reqs[l].ram);
      res.vram[l] = memRate(vram, reqs[l].vram);
    });
    res.have = { ram: ram, vram: vram };
    res.need = { ram: reqs.rec.ram || reqs.min.ram, vram: reqs.rec.vram || reqs.min.vram };
    return res;
  }
  function chkHtml(r, plain) {
    if (!r || (!r.min && !r.rec)) return "";
    function one(label, x) {
      if (!x) return '<span class="nn-na" title="' + esc(t("na_tip")) + '">' + label + " ?</span>";
      var sign = x.cls === "ok" ? "\u2713" : (x.cls === "mid" ? "\u2248" : "\u2717");
      return '<span class="nn-' + x.cls + '"' + (plain ? "" : ' title="' + esc(t("chk_tip", x.r.toFixed(2))) + '"') + ">" + label + " " + sign + (plain ? "" : " \u00d7" + x.r.toFixed(1)) + "</span>";
    }
    return '<span class="nn-chk">' + one(t("min"), r.min) + " \u00b7 " + one(t("rec"), r.rec) + "</span>";
  }
  function vramChip(res) {
    var x = res.vram.rec || res.vram.min;
    if (!x) return "";
    return '<span class="nn-chk"><span class="nn-' + x.cls + '" title="' + esc(t("vram_tip", res.have.vram, res.need.vram)) + '">VRAM ' + (x.cls === "ok" ? "\u2713" : "\u2717") + "</span></span>";
  }
  function verdict(res) {
    var names = { cpu: t("n_cpu"), gpu: t("n_gpu"), ram: t("n_ram"), vram: t("n_vram") };
    function lvl(l) {
      var a = [];
      ["cpu", "gpu", "ram", "vram"].forEach(function (k) { if (res[k][l]) a.push({ x: res[k][l], n: names[k] }); });
      return a.length ? a : null;
    }
    function worst(a) { return a.reduce(function (w, v) { return v.x.r < w.x.r ? v : w; }); }
    function nm(a) {
      var n = a.map(function (v) { return v.n; });
      return n.length > 1 ? n.slice(0, -1).join(", ") + t("and") + n[n.length - 1] : n[0];
    }
    var rec = lvl("rec"), min = lvl("min"), w;
    if (rec) {
      w = worst(rec);
      if (w.x.cls === "ok") return ["ok", t("v_rec_ok", nm(rec))];
      if (w.x.cls === "mid") return ["mid", t("v_rec_mid", nm(rec))];
      if (min && worst(min).x.cls !== "bad") return ["mid", t("v_between", w.n)];
      return ["bad", t("v_bad", w.n)];
    }
    if (min) {
      w = worst(min);
      if (w.x.cls === "ok") return ["ok", t("v_min_ok", nm(min))];
      if (w.x.cls === "mid") return ["mid", t("v_min_mid", nm(min))];
      return ["bad", t("v_min_bad", w.n)];
    }
    return null;
  }
  function bottleneck(res) {
    var l = (res.cpu.rec && res.gpu.rec) ? "rec" : ((res.cpu.min && res.gpu.min) ? "min" : "");
    if (!l) return "";
    var c = res.cpu[l], g = res.gpu[l];
    var hi = Math.max(c.r, g.r), lo = Math.min(c.r, g.r);
    if (hi / lo >= 1.4) {
      var weakIsGpu = g.r < c.r;
      return t("bn", weakIsGpu ? t("n_gpu") : t("n_cpu"), weakIsGpu ? t("n_cpu") : t("n_gpu"), (hi / lo).toFixed(1));
    }
    return (c.cls !== "bad" && g.cls !== "bad") ? t("balanced") : "";
  }
  function isSsd(d) { return d.type === "SSD" || d.type === "NVMe" || /ssd|nvme|m\.2/i.test(d.model || ""); }
  function isHdd(d) { return d.type === "HDD" || /\bhdd\b|hdwd|barracuda/i.test(d.model || ""); }
  function ssdAdvice(reqs) {
    var flag = Math.max(reqs.min.ssd || 0, reqs.rec.ssd || 0);
    if (!flag) return "";
    var need = reqs.min.disk || reqs.rec.disk || 0;
    var disks = (state.data.disks || []).filter(function (d) { return d.free != null && d.free >= need; });
    var ssd = disks.filter(isSsd).sort(function (a, b) { return b.free - a.free; })[0];
    var hdd = disks.filter(function (d) { return !isSsd(d) && isHdd(d); })[0];
    if (ssd) return t(flag === 2 ? "ssd_ok" : "ssd_rec_ok", esc(ssd.id), esc(ssd.type || "SSD"), ssd.free);
    if (hdd) return t(flag === 2 ? "ssd_hdd" : "ssd_rec_hdd", esc(hdd.id));
    return "";
  }

  // ================================================================ page helpers
  function pageAppId() { var m = /\/app\/(\d+)/.exec(location.href); return m ? m[1] : ""; }
  function pageGameName() {
    var e = document.getElementById("appHubAppName") || document.querySelector(".apphub_AppName");
    return e ? e.textContent.trim() : "";
  }
  function curApp() { return (box && box.base) ? box.base : { id: pageAppId(), name: pageGameName() }; }

  // ================================================================ FPS sites: parsers
  var PRESETS = ["low", "medium", "high", "ultra"];
  var RES_ROWS = [["1080p", "1920\u00d71080"], ["1440p", "2560\u00d71440"], ["4k", "3840\u00d72160"]];
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
      var o = parsePresets(text.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : p.i + 800));
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
  // checkfps cells look like "96FPS min 69": we keep the average and, when present, the minimum
  function parseCheckfps(text) {
    var rows = {}, rmin = {}, names = ["ultra", "high", "medium", "low"], i, j;
    for (i = 0; i < 4; i++) {
      var cell = "(\\d{1,3})\\s*fps(?:\\s*min\\s*(\\d{1,3}))?";
      var re = new RegExp(names[i] + "[\\s\\S]{0,60}?" + cell + "[\\s\\S]{0,60}?" + cell + "[\\s\\S]{0,60}?" + cell, "i"), m = re.exec(text);
      if (!m) return null;
      rows[names[i]] = [+m[1], +m[3], +m[5]];
      rmin[names[i]] = [m[2] ? +m[2] : null, m[4] ? +m[4] : null, m[6] ? +m[6] : null];
    }
    var out = {}, mins = {}, keys = ["1080p", "1440p", "4k"];
    for (j = 0; j < 3; j++) {
      var o = { ultra: rows.ultra[j], high: rows.high[j], medium: rows.medium[j], low: rows.low[j] };
      if (!sane(o)) continue;
      out[keys[j]] = o;
      var mo = {}, any = false;
      for (i = 0; i < 4; i++) { if (rmin[names[i]][j]) { mo[names[i]] = rmin[names[i]][j]; any = true; } }
      if (any) mins[keys[j]] = mo;
    }
    return Object.keys(out).length ? { data: out, mins: Object.keys(mins).length ? mins : null } : null;
  }
  function plausible(data, local) {
    if (!local) return true;
    var bad = 0;
    Object.keys(data).forEach(function (r) {
      if (!local[r]) return;
      PRESETS.forEach(function (p) { var q = data[r][p] / local[r][p]; if (q < 0.2 || q > 5) bad++; });
    });
    return bad === 0;
  }
  // checkfps assumes a Core i5-13400: weaker CPUs lose FPS mostly at low resolutions
  var CHECKFPS_CPU = 21500;
  function cpuAdjust(data, mine) {
    if (!mine || mine >= CHECKFPS_CPU) return { data: data, changed: false };
    var r = Math.max(mine / CHECKFPS_CPU, 0.4), f = { "1080p": Math.pow(r, 0.6), "1440p": Math.pow(r, 0.3), "4k": 1 };
    var out = {};
    Object.keys(data).forEach(function (res) {
      out[res] = {};
      PRESETS.forEach(function (p) { out[res][p] = Math.max(1, Math.round(data[res][p] * (f[res] || 1))); });
    });
    return { data: out, changed: true };
  }

  // sources: id, display name, url builder
  var SOURCES = [
    { id: "fpsbench", name: "fpsbench.com", parse: parseFpsbench, needCpu: true,
      urls: function (games, cpu, gpu) {
        var c = HW.slug(cpu), g = HW.slug(gpu);
        return games.map(function (x) { return "https://fpsbench.com/game/" + x + "/" + c + "-" + g; });
      } },
    { id: "chipversus", name: "chipversus.com", parse: parseChipversus, needCpu: true,
      urls: function (games, cpu, gpu) {
        var c = HW.slug(cpu).replace(/^amd-|^intel-/, ""), g = HW.slug(gpu).replace(/^nvidia-|^amd-/, "");
        return games.map(function (x) { return "https://chipversus.com/fps-calculator/" + c + "-" + g + "/" + x; });
      } },
    { id: "checkfps", name: "checkfps.io", parse: parseCheckfps, noCpu: true,
      urls: function (games, cpu, gpu) {
        var g = HW.slug(gpu).replace(/^nvidia-geforce-|^nvidia-|^amd-radeon-|^amd-/, "");
        return games.map(function (x) { return "https://checkfps.io/en/fps-calculator/" + x + "/" + g; });
      } }
  ];

  // ================================================================ RPC to the Lua backend
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

  // ================================================================ FPS state, cache, merging
  var fps = { key: "", status: "idle", list: [], merged: null, log: [] };
  function resetFps() { fps = { key: "", status: "idle", list: [], merged: null, log: [] }; }
  function diag(v) { try { document.documentElement.setAttribute("data-pcinfo-fps", v); } catch (e) {} }
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
  // average over all sources that know the game; detail keeps every site's own number for the tooltip
  function mergeSources(list) {
    var data = {}, detail = {}, mins = {};
    RES_ROWS.forEach(function (r) {
      var res = r[0];
      PRESETS.forEach(function (p) {
        var vals = [], det = [];
        list.forEach(function (src) {
          var v = src.data[res] && src.data[res][p];
          if (v) { vals.push(v); det.push(src.name.replace(/\.\w+$/, "") + " " + v); }
        });
        if (!vals.length) return;
        (data[res] = data[res] || {})[p] = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
        (detail[res] = detail[res] || {})[p] = det.join(" \u00b7 ");
      });
      var mv = {};
      PRESETS.forEach(function (p) {
        var a = [];
        list.forEach(function (src) { var v = src.mins && src.mins[res] && src.mins[res][p]; if (v) a.push(v); });
        if (a.length) mv[p] = Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length);
      });
      if (Object.keys(mv).length) mins[res] = mv;
    });
    return { data: data, detail: detail, mins: mins, list: list };
  }
  function enabledSources(s) { return SOURCES.filter(function (x) { return s.sources[x.id] !== false; }); }

  function startOnline(key, my, local, sc, en) {
    var gpu = HW.gpuModel(my.gpu), cpu = HW.cpuModel(my.cpu), games = HW.gameSlugs(curApp().name);
    var jobs = [];
    if (games.length && gpu) en.forEach(function (src) {
      if (src.needCpu && !cpu) return;
      jobs.push({ src: src, urls: src.urls(games, cpu, gpu) });
    });
    function finish() {
      if (fps.key !== key) return;
      var answered = fps.log.some(function (x) { return !/:no-answer$/.test(x); });
      fps.status = fps.list.length ? "done" : (answered ? "none" : "norpc");
      diag(fps.log.join(","));
      if (fps.list.length) fpsCacheSet(key, { ok: true, list: fps.list });
      else if (answered) fpsCacheSet(key, { ok: false });
      render();
    }
    if (!jobs.length) { fps.log.push("no-candidates"); fps.status = "none"; diag("no-candidates"); return; }
    var ji = 0;
    (function nextJob() {
      if (fps.key !== key) return;
      if (ji >= jobs.length) return finish();
      var job = jobs[ji++], ui = 0;
      (function nextUrl() {
        if (fps.key !== key) return;
        if (ui >= job.urls.length) return nextJob();
        var url = job.urls[ui++];
        rpc("FetchPage", { url: url }).then(function (text) {
          if (fps.key !== key) return;
          if (typeof text !== "string" || !text || /^ERR/.test(text)) { fps.log.push(job.src.id + ":" + (text ? String(text).slice(0, 40) : "no-answer")); return nextUrl(); }
          var r = null;
          try { r = job.src.parse(text); } catch (e) { r = null; }
          var data = r && r.data ? r.data : r, mins = r && r.mins ? r.mins : null;
          if (!data || !plausible(data, local)) { fps.log.push(job.src.id + ":no-data"); return nextUrl(); }
          var note = "";
          if (job.src.noCpu) {
            var adj = cpuAdjust(data, sc.cpu);
            data = adj.data; note = adj.changed ? t("cpu_adj_yes") : t("cpu_adj_no");
            if (adj.changed) mins = null;
          }
          fps.log.push(job.src.id + ":ok");
          fps.list.push({ id: job.src.id, name: job.src.name, url: url, data: data, mins: mins, note: note });
          fps.merged = mergeSources(fps.list);
          render();
          nextJob();
        });
      })();
    })();
  }
  function ensureFps(s, local, sc) {
    if (!s.fps || !s.online) { if (fps.key) resetFps(); return; }
    var my = myParts(s), en = enabledSources(s);
    var key = [curApp().id, my.cpu, my.gpu, en.map(function (x) { return x.id; }).join("+"), Math.round(sc.cpu || 0)].join("|");
    if (fps.key === key) return;
    fps = { key: key, status: "loading", list: [], merged: null, log: [] };
    var c = fpsCacheGet(key);
    if (c) {
      fps.list = c.list || [];
      fps.merged = fps.list.length ? mergeSources(fps.list) : null;
      fps.status = fps.list.length ? "done" : "none";
      return;
    }
    startOnline(key, my, local, sc, en);
  }

  // ================================================================ FPS rendering
  function fpsClass(v) { return v >= 120 ? "f4" : (v >= 60 ? "f3" : (v >= 30 ? "f2" : "f1")); }
  function fpsTable(data, s, extra) {
    var play = playRes(s), hz = targetHz(s), auto = !(s.playRes && s.playRes !== "auto");
    var h = "<table><tr><th></th>";
    PRESETS.forEach(function (p) { h += "<th>" + t("pr_" + p) + "</th>"; });
    h += "</tr>";
    RES_ROWS.forEach(function (r) {
      var row = data[r[0]];
      if (!row) return;
      var isPlay = r[0] === play;
      h += "<tr" + (isPlay ? ' class="nat"' : "") + "><th>" + r[1] + (isPlay ? t(auto ? "at_monitor" : "at_res") : "") + "</th>";
      PRESETS.forEach(function (p) {
        var v = row[p], cls = fpsClass(v) + (hz && v >= hz * 0.95 ? " hz" : "");
        var tip = extra && extra.detail && extra.detail[r[0]] && extra.detail[r[0]][p];
        var mn = isPlay && extra && extra.mins && extra.mins[r[0]] && extra.mins[r[0]][p];
        h += '<td class="' + cls + '"' + (tip ? ' title="' + esc(t("detail_tip") + ": " + tip) + '"' : "") + ">" + (v != null ? v : "\u2014") +
          (mn ? "<small>" + t("fps_min", mn) + "</small>" : "") + "</td>";
      });
      h += "</tr>";
    });
    return h + "</table>";
  }
  function upscaleLine(table, s, gpuStr) {
    var play = playRes(s), key = table[play] ? play : (table["1440p"] ? "1440p" : (table["1080p"] ? "1080p" : "4k")), row = table[key];
    if (!row || !row.high) return "";
    var k = HW.gpuKey(gpuStr) || "", fam = /^rtx/.test(k) ? "DLSS" : (/^(rx|arc|gtx|vega|r9|hd)/.test(k) ? "FSR" : "");
    if (!fam) return "";
    var num = parseInt((/\d+/.exec(k) || [0])[0], 10), base = row.high;
    var q = Math.round(base * 1.35), p = Math.round(base * 1.7);
    var parts = [fam + " Quality \u2248 <b>" + q + "</b>", fam + " Performance \u2248 <b>" + p + "</b>"];
    if ((fam === "DLSS" && num >= 4000) || (fam === "FSR" && /^rx[79]/.test(k))) parts.push(t("fg") + " \u2248 <b>" + Math.round(q * 1.7) + "</b>");
    var label = (RES_ROWS.filter(function (r) { return r[0] === key; })[0] || ["", ""])[1];
    return '<div class="nn-up"><span>' + t("up_head", label, t("pr_high")) + "</span> " + parts.join(" \u00b7 ") + "</div>";
  }
  function tableForView(s, local) {
    if (fps.merged && fps.merged.list.length) return fps.merged.data;
    return local;
  }
  function fpsBlock(s, local, my) {
    if (!s.fps) return "";
    var h = '<div class="nn-fps"><h4>' + t("fps_title") + "</h4>", m = fps.merged, tail = "";
    if (m && m.list.length) {
      h += fpsTable(m.data, s, m);
      var links = m.list.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + "</a>"; });
      var src = m.list.length > 1 ? t("fps_avg", m.list.length, links.join(", ")) : t("fps_one", links[0]);
      var notes = m.list.map(function (x) { return x.note; }).filter(Boolean);
      tail = src + " " + t("fps_not_measure") + (fps.status === "loading" ? " " + t("fps_more") : "") +
        (notes.length ? "<br>" + notes.map(esc).join("<br>") : "");
      if (s.upscale) h += upscaleLine(m.data, s, my.gpu);
    } else if (local) {
      h += fpsTable(local, s, null);
      tail = t("fps_local") + " " + (s.online ? (fps.status === "loading" ? t("fps_loading") : (fps.status === "norpc" ? t("fps_norpc") : t("fps_none"))) : t("fps_off"));
      if (s.upscale) h += upscaleLine(local, s, my.gpu);
    } else {
      return '<div class="nn-fps"><h4>' + t("fps_title") + '</h4><div class="nn-src">' + (fps.status === "loading" ? t("fps_loading") : t("fps_nodata")) + "</div></div>";
    }
    var hz = targetHz(s), tbl = (m && m.list.length) ? m.data : local, reach = false;
    if (hz && tbl) Object.keys(tbl).forEach(function (r) { PRESETS.forEach(function (p) { if (tbl[r][p] >= hz * 0.95) reach = true; }); });
    if (reach) tail += (tail ? "<br>" : "") + t("hz_legend", hz);
    return h + '<div class="nn-src">' + tail + "</div></div>";
  }

  // ================================================================ rendering
  function values() {
    var d = state.data;
    var disks = (d.disks || []).map(function (x) {
      var size = (x.free != null) ? x.free + " / " + x.total : x.total;
      var tag = (x.type && !new RegExp(x.type, "i").test(x.model || "")) ? x.type : "";
      var info = [x.model || "", tag].filter(Boolean).join(", ");
      return esc(x.id) + " " + size + " " + t("gb") + (info ? " (" + esc(info) + ")" : "");
    }).join("<br>");
    var extra = (d.gpus && d.gpus.length) ? ' <span class="nn-sub">(+ ' + esc(d.gpus.join(", ")) + ")</span>" : "";
    return {
      os: esc(d.os), cpu: esc(d.cpu), ram: d.ramGB ? d.ramGB + " " + t("gb") : "", gpu: esc(d.gpu) + extra,
      directx: esc(d.directx), board: esc(d.board), disks: disks, audio: esc(d.audio), display: esc(d.display)
    };
  }

  function css(s) {
    var w = Math.max(30, Math.min(100, +s.width || 100));
    return ".nn-pc{position:relative;box-sizing:border-box;width:" + w + "%;margin:14px 0 6px;padding:12px 16px;border-radius:" + (+s.radius) + "px;background:" + rgba(s.bg, (+s.bgAlpha) / 100) + ";border:1px solid " + rgba(s.border, .4) + ";border-left:3px solid " + s.accent + ";color:" + s.text + ";font-size:" + (+s.fontSize) + "px;line-height:1.5;clear:both}" +
      ".nn-pc h3{margin:0 0 2px;font-size:" + (+s.fontSize + 1) + "px;letter-spacing:.06em;color:" + s.accent + ";font-weight:700}" +
      ".nn-pc .nn-src{margin:0 0 8px;font-size:" + Math.max(9, (+s.fontSize) - 2) + "px;color:" + s.label + ";opacity:.85}" +
      ".nn-pc ul{list-style:none;margin:0;padding:0}" +
      ".nn-pc li{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)}.nn-pc li:last-child{border-bottom:0}" +
      ".nn-pc li b{display:inline-block;vertical-align:top;min-width:" + (+s.labelWidth) + "px;color:" + s.label + ";font-weight:600}" +
      ".nn-pc li i{font-style:normal;display:inline-block}.nn-sub{opacity:.7}" +
      ".nn-ok{color:#4ade80;font-weight:700;margin-left:8px}.nn-bad{color:#f87171;font-weight:700;margin-left:8px}" +
      ".nn-chk{margin-left:10px;font-size:.92em;white-space:nowrap}.nn-chk .nn-ok,.nn-chk .nn-bad,.nn-chk .nn-mid,.nn-chk .nn-na{margin-left:0;font-weight:600}.nn-chk+.nn-chk{margin-left:6px}" +
      ".nn-mid{color:#fbbf24;font-weight:700}.nn-na{color:" + s.label + ";opacity:.7}" +
      ".nn-unk{margin-left:10px;color:#fbbf24;cursor:pointer;text-decoration:underline dotted;font-size:.92em}" +
      ".nn-verdict{margin:8px 0 2px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}" +
      ".nn-v-ok{border-color:rgba(74,222,128,.45);color:#86efac}.nn-v-mid{border-color:rgba(251,191,36,.45);color:#fcd34d}.nn-v-bad{border-color:rgba(248,113,113,.5);color:#fca5a5}" +
      ".nn-note{margin:4px 2px 0;font-size:" + Math.max(10, (+s.fontSize) - 1) + "px;color:" + s.label + "}" +
      ".nn-fps{margin-top:10px}.nn-fps h4{margin:0 0 4px;color:" + s.accent + ";font-size:inherit}" +
      ".nn-fps table{border-collapse:collapse}.nn-fps th{font-weight:600;color:" + s.label + ";text-align:left;padding:2px 14px 2px 0;white-space:nowrap}.nn-fps td{text-align:center;padding:2px 12px;font-weight:700;vertical-align:top}" +
      ".nn-fps td small{display:block;font-weight:400;font-size:.8em;opacity:.7}" +
      ".nn-fps tr.nat th{color:" + s.text + "}.nn-fps tr.nat td{background:rgba(255,255,255,.05)}.nn-fps td.hz{text-decoration:underline;text-underline-offset:3px}" +
      ".f4{color:#4ade80}.f3{color:#22d3ee}.f2{color:#fbbf24}.f1{color:#f87171}" +
      ".nn-fps .nn-src{margin:4px 0 0}.nn-fps a{color:" + s.accent + "}.nn-up{margin-top:6px;font-size:" + Math.max(10, (+s.fontSize) - 1) + "px}.nn-up span{color:" + s.label + "}" +
      ".nn-btn{position:absolute;top:8px;cursor:pointer;opacity:.6;font-size:15px;background:none;border:0;color:" + s.accent + "}.nn-btn:hover{opacity:1}.nn-gear{right:10px}.nn-fold{right:36px}" +
      ".nn-compact{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;cursor:pointer;padding-right:60px}.nn-compact b{color:" + s.accent + ";letter-spacing:.04em}" +
      ".nn-chip{padding:1px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-weight:600}" +
      ".nn-set{margin-top:10px;padding:10px;border-top:1px dashed " + rgba(s.border, .5) + "}" +
      ".nn-set label{display:flex;align-items:center;gap:8px;margin:4px 0}.nn-set label span{min-width:190px;color:" + s.label + "}" +
      ".nn-set input[type=text],.nn-set input[type=number],.nn-set select{background:rgba(0,0,0,.4);border:1px solid " + rgba(s.border, .5) + ";color:" + s.text + ";padding:2px 6px;border-radius:6px;font-size:inherit}" +
      ".nn-set input[type=text]{flex:1;min-width:120px}.nn-set input[type=number]{width:80px}" +
      ".nn-set input[type=color]{width:34px;height:22px;padding:0;border:0;background:none}" +
      ".nn-set h4{margin:10px 0 4px;color:" + s.accent + ";font-size:inherit}.nn-set .nn-hint{margin:2px 0 6px;color:" + s.label + ";font-size:.9em}" +
      ".nn-set button{cursor:pointer;background:" + rgba(s.border, .25) + ";border:1px solid " + rgba(s.border, .6) + ";color:" + s.text + ";padding:3px 10px;border-radius:6px;margin:6px 6px 0 0}";
  }

  function compactHtml(s, v, local) {
    var tbl = tableForView(s, local), play = playRes(s), fp = "";
    if (tbl) {
      var key = tbl[play] ? play : (tbl["1440p"] ? "1440p" : (tbl["1080p"] ? "1080p" : "4k")), row = tbl[key];
      if (row && row.high) fp = "~" + row.high + " FPS \u00b7 " + (RES_ROWS.filter(function (r) { return r[0] === key; })[0] || ["", ""])[1] + " \u00b7 " + t("pr_high").toLowerCase();
    }
    var chip = v ? '<span class="nn-chip nn-v-' + v[0] + '">' + (v[0] === "ok" ? "\u2713 " : (v[0] === "mid" ? "\u2248 " : "\u2717 ")) + t("s_" + v[0]) + "</span>" : "";
    return '<div class="nn-compact" data-act="unfold" title="' + esc(t("unfold")) + '"><b>' + esc(s.title || t("title")) + "</b>" + chip + (fp ? "<span>" + esc(fp) + "</span>" : "") + "</div>";
  }

  function render() {
    if (!box) return;
    var s = load(); LANG = pickLang(s);
    var vals = values(), reqs = readReqs(box.sys), my = myParts(s), sc = myScores(s, my);
    var hw = checkHw(reqs, s, my, sc);
    var local = s.fps ? HW.estimateFps(reqs, sc.cpu, sc.gpu) : null;
    ensureFps(s, local, sc);
    styleEl.textContent = css(s);
    var v = s.compare ? verdict(hw) : null, html;

    var head = '<button class="nn-btn nn-gear" title="' + esc(t("settings")) + '">\u2699</button>';
    if (s.collapsed) {
      html = head + compactHtml(s, v, local);
    } else {
      var src = state.source === "auto"
        ? t("src_auto") + (state.updated ? " (" + esc(state.updated) + ")" : "")
        : t("src_wait");
      html = head + '<button class="nn-btn nn-fold" title="' + esc(t("fold")) + '" data-act="fold">\u25b4</button><h3>' + esc(s.title || t("title")) + '</h3><div class="nn-src">' + src + "</div><ul>";
      ROWS.forEach(function (k) {
        if (s.hidden[k]) return;
        var val = s.custom[k] ? esc(s.custom[k]) : vals[k];
        if (!val) return;
        var m = "";
        if (s.compare) {
          if (k === "cpu") m = chkHtml(hw.cpu);
          if (k === "gpu") m = chkHtml(hw.gpu) + vramChip(hw);
          if (k === "ram") m = chkHtml(hw.ram, true);
        }
        if (k === "cpu" && sc.cpu == null) m += '<a class="nn-unk" data-act="score">' + t("unk") + "</a>";
        if (k === "gpu" && sc.gpu == null) m += '<a class="nn-unk" data-act="score">' + t("unk") + "</a>";
        html += "<li><b>" + t("r_" + k) + ":</b><i>" + val + "</i>" + m + "</li>";
      });
      (s.extra || []).forEach(function (e) {
        if (e && e.label && e.value) html += "<li><b>" + esc(e.label) + ":</b><i>" + esc(e.value) + "</i></li>";
      });
      html += "</ul>";
      if (s.compare) {
        if (v) html += '<div class="nn-verdict nn-v-' + v[0] + '">' + (v[0] === "ok" ? "\u2713 " : (v[0] === "mid" ? "\u2248 " : "\u2717 ")) + v[1] + "</div>";
        var notes = [bottleneck(hw), ssdAdvice(reqs), box.base ? t("dlc_note", esc(box.base.name)) : ""].filter(Boolean);
        notes.forEach(function (n) { html += '<div class="nn-note">' + n + "</div>"; });
      }
      html += fpsBlock(s, local, my);
    }
    if (open) html += panel(s, sc);
    box.div.innerHTML = html;
    bindMain();
    if (open) {
      bindPanel();
      if (focusScore) { focusScore = false; var f = box.div.querySelector('[data-k="scoreCpu"]'); if (f && f.scrollIntoView) f.scrollIntoView({ block: "center" }); }
    }
  }
  function bindMain() {
    var g = box.div.querySelector(".nn-gear");
    if (g) g.onclick = function () { open = !open; render(); };
    [].forEach.call(box.div.querySelectorAll("[data-act]"), function (el) {
      var a = el.getAttribute("data-act");
      if (a === "fold" || a === "unfold") el.onclick = function () { var x = load(); x.collapsed = (a === "fold"); save(x); render(); };
      if (a === "score") el.onclick = function () { open = true; focusScore = true; render(); };
    });
  }

  // ================================================================ settings panel
  function panel(s, sc) {
    function num(id, label, v, min, max) { return '<label><span>' + label + '</span><input type="number" data-k="' + id + '" value="' + v + '" min="' + min + '" max="' + max + '"></label>'; }
    function col(id, label, v) { return '<label><span>' + label + '</span><input type="color" data-k="' + id + '" value="' + v + '"></label>'; }
    function chk(id, label, v) { return '<label><span>' + label + '</span><input type="checkbox" data-k="' + id + '"' + (v ? " checked" : "") + "></label>"; }
    function sel(id, label, v, opts) {
      return '<label><span>' + label + '</span><select data-k="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
    }
    var auto = values();
    var h = '<div class="nn-set"><h4>' + t("p_view") + "</h4>" +
      '<label><span>' + t("p_title") + '</span><input type="text" data-k="title" value="' + esc(s.title) + '" placeholder="' + esc(t("title")) + '"></label>' +
      sel("lang", t("p_lang"), s.lang, [["auto", t("p_lang_auto")], ["ru", "\u0420\u0443\u0441\u0441\u043a\u0438\u0439"], ["en", "English"]]) +
      col("accent", t("p_accent"), s.accent) + col("border", t("p_border"), s.border) + col("bg", t("p_bg"), s.bg) +
      col("text", t("p_text"), s.text) + col("label", t("p_label"), s.label) +
      num("bgAlpha", t("p_alpha"), s.bgAlpha, 0, 100) + num("fontSize", t("p_font"), s.fontSize, 9, 24) +
      num("width", t("p_width"), s.width, 30, 100) + num("radius", t("p_radius"), s.radius, 0, 30) + num("labelWidth", t("p_lw"), s.labelWidth, 60, 300) +
      chk("compare", t("p_compare"), s.compare) + chk("fps", t("p_fps"), s.fps) + chk("online", t("p_online"), s.online) +
      chk("upscale", t("p_upscale"), s.upscale) + chk("collapsed", t("p_collapsed"), s.collapsed) +
      "<h4>" + t("p_play") + "</h4>" +
      sel("playRes", t("p_playres"), s.playRes, [["auto", t("p_auto_monitor")], ["1080p", "1920\u00d71080"], ["1440p", "2560\u00d71440"], ["4k", "3840\u00d72160"]]) +
      num("targetHz", t("p_hz"), s.targetHz, 0, 540) +
      "<h4>" + t("p_sources") + "</h4>" +
      SOURCES.map(function (x) { return '<label><span>' + x.name + '</span><input type="checkbox" data-src="' + x.id + '"' + (s.sources[x.id] !== false ? " checked" : "") + "></label>"; }).join("") +
      "<h4>" + t("p_scores") + "</h4>" +
      num("scoreCpu", t("p_score_cpu"), s.scoreCpu, 0, 200000) + num("scoreGpu", t("p_score_gpu"), s.scoreGpu, 0, 200000) +
      '<div class="nn-hint">' + esc(t("p_score_hint", sc.cpuAuto || "\u2014", sc.gpuAuto || "\u2014")) + "</div>" +
      "<h4>" + t("p_rows") + "</h4>";
    ROWS.forEach(function (k) {
      h += '<label><input type="checkbox" data-show="' + k + '"' + (s.hidden[k] ? "" : " checked") + "><span>" + t("r_" + k) + '</span><input type="text" data-c="' + k + '" value="' + esc(s.custom[k] || "") + '" placeholder="' + esc(String(auto[k] || "").replace(/<br>/g, ", ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")) + '"></label>';
    });
    h += "<h4>" + t("p_extra") + "</h4>";
    for (var i = 0; i < 4; i++) {
      var e = (s.extra || [])[i] || {};
      h += '<label><input type="text" data-el="' + i + '" value="' + esc(e.label || "") + '" placeholder="' + esc(t("p_ph_name")) + '" style="max-width:150px"><input type="text" data-ev="' + i + '" value="' + esc(e.value || "") + '" placeholder="' + esc(t("p_ph_value")) + '"></label>';
    }
    return h + '<button data-pact="refresh">' + t("p_refresh") + '</button><button data-pact="reset">' + t("p_reset") + "</button></div>";
  }
  function bindPanel() {
    var root = box.div.querySelector(".nn-set");
    function collect() {
      var s = load();
      [].forEach.call(root.querySelectorAll("[data-k]"), function (i) {
        s[i.getAttribute("data-k")] = i.type === "checkbox" ? i.checked : (i.type === "number" ? +i.value : i.value);
      });
      s.hidden = {}; s.custom = {}; s.extra = []; s.sources = {};
      [].forEach.call(root.querySelectorAll("[data-show]"), function (i) { if (!i.checked) s.hidden[i.getAttribute("data-show")] = true; });
      [].forEach.call(root.querySelectorAll("[data-c]"), function (i) { if (i.value.trim()) s.custom[i.getAttribute("data-c")] = i.value.trim(); });
      [].forEach.call(root.querySelectorAll("[data-src]"), function (i) { s.sources[i.getAttribute("data-src")] = i.checked; });
      for (var n = 0; n < 4; n++) {
        var l = root.querySelector('[data-el="' + n + '"]').value.trim(), v = root.querySelector('[data-ev="' + n + '"]').value.trim();
        if (l && v) s.extra.push({ label: l, value: v });
      }
      return s;
    }
    [].forEach.call(root.querySelectorAll("input,select"), function (i) { i.onchange = function () { save(collect()); render(); }; });
    root.querySelector('[data-pact="reset"]').onclick = function () { save({}); render(); };
    root.querySelector('[data-pact="refresh"]').onclick = function () {
      try { localStorage.removeItem(FPS_KEY); } catch (e) {}
      resetFps(); render();
    };
  }

  // ================================================================ data from the backend
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

  // ================================================================ placing the block
  var dlcTried = false;
  function insertBlock(anchor, sys, base) {
    var div = document.createElement("div");
    div.className = "nn-pc";
    anchor.parentNode.insertBefore(div, anchor.nextSibling);
    box = { sys: sys, div: div, base: base || null };
    render();
  }
  // a DLC page without its own requirements: take them from the base game's page (same origin)
  function tryDlc() {
    if (dlcTried) return false;
    var a = document.querySelector('.game_area_dlc_bubble a[href*="/app/"]');
    if (!a) return false;
    var m = /\/app\/(\d+)/.exec(a.getAttribute("href") || "");
    if (!m || m[1] === pageAppId()) return false;
    dlcTried = true;
    try {
      fetch("/app/" + m[1] + "/", { credentials: "include" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
        if (!html || box) return;
        var doc = new DOMParser().parseFromString(html, "text/html");
        var sys = doc.querySelector('.game_area_sys_req[data-os="win"]') || doc.querySelector(".game_area_sys_req");
        if (!sys) return;
        var nm = doc.getElementById("appHubAppName"), bub = document.querySelector(".game_area_dlc_bubble");
        insertBlock(bub, sys, { id: m[1], name: nm ? nm.textContent.trim() : a.textContent.trim() });
      })["catch"](function () {});
    } catch (e) {}
    return false;
  }
  function build() {
    if (box) return true;
    var sys = document.querySelector('.game_area_sys_req[data-os="win"]') || document.querySelector(".game_area_sys_req") || document.querySelector(".sys_req") || document.querySelector(".sysreq_contents");
    if (!sys) return tryDlc();
    if (sys.parentNode && sys.parentNode.classList && sys.parentNode.classList.contains("game_page_autocollapse")) sys = sys.parentNode;
    insertBlock(sys, sys, null);
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
