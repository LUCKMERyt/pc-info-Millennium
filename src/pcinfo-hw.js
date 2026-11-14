/* ---- HW: CPU/GPU recognition, relative performance scores, requirement checks, local FPS model ----
   Scores are APPROXIMATE (PassMark-like values written down by hand). They are only used to
   compare two parts of the same table, never as absolute numbers. */
var HW = (function () {
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[™®©]/g, "").replace(/\((?:r|tm)\)/g, "")
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
    return String(val || "").split(/\s+(?:or|и|или)\s+|\s*[\/;|,]\s*/i).map(function (x) { return x.trim(); })
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
    var s = String(raw || "").replace(/[™®©]/g, "").replace(/\((?:R|TM)\)/gi, "").replace(/\s+/g, " ");
    var m;
    if ((m = /AMD\s+Ryzen\s+[3579]\s+(?:PRO\s+)?\d{4}\w*/i.exec(s))) return m[0];
    if ((m = /Intel\s+Core\s+(?:i[3579]-\d{3,5}\w*|Ultra\s+[579]\s+\d{3}\w*)/i.exec(s))) return m[0];
    if ((m = /Core\s+(i[3579]-\d{3,5}\w*|Ultra\s+[579]\s+\d{3}\w*)/i.exec(s))) return "Intel Core " + m[1];
    return null;
  }
  function gpuModel(raw) {
    var s = String(raw || "").replace(/[™®©]/g, "").replace(/\((?:R|TM)\)/gi, "").replace(/\s+/g, " ")
      .replace(/\s*\(?\d+(?:[.,]\d+)?\s?GB\)?\s*$/i, "").trim();
    var m;
    if ((m = /(NVIDIA\s+)?GeForce\s+(?:RTX|GTX|GT)\s?\d{3,4}(?:\s?(?:Ti\s?SUPER|SUPER|Ti))?/i.exec(s))) return "NVIDIA " + m[0].replace(/^NVIDIA\s+/i, "");
    if ((m = /(AMD\s+)?Radeon\s+RX\s?\d{3,4}(?:\s?(?:XTX|XT|GRE))?/i.exec(s))) return "AMD " + m[0].replace(/^AMD\s+/i, "");
    return null;
  }
  function slug(s) {
    return String(s || "").toLowerCase().replace(/[™®©]/g, "").replace(/&/g, " and ")
      .replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function gameSlugs(name) {
    var out = [], full = slug(name);
    if (full) out.push(full);
    var short = slug(String(name || "").replace(/\(.*?\)/g, " ").split(/\s*[:–—]\s*|\s+-\s+/)[0]);
    if (short && short !== full && short.length > 2) out.push(short);
    return out;
  }

  return {
    cpuScore: cpuScore, gpuScore: gpuScore, gpuKey: gpuKey, alts: alts, reqMin: reqMin, reqMean: reqMean,
    rate: rate, estimateFps: estimateFps, cpuModel: cpuModel, gpuModel: gpuModel, slug: slug, gameSlugs: gameSlugs
  };
})();
