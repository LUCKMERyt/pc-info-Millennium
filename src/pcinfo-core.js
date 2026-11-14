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
  var IS_APP = /steampowered\.com\/app\//.test(location.href);
  var IS_STORE = /^https?:\/\/store\.steampowered\.com\//.test(location.href);
  if (!IS_APP && !IS_STORE) return;

  // ---- built-in specs, used until the backend delivers the real ones ----
  var DEFAULT_DATA = {
    os: "Windows 10 Pro 64-bit",
    cpu: "AMD Ryzen 7 5700X (8C/16T, 3.4–4.6 GHz)",
    ramGB: 32,
    gpu: "NVIDIA GeForce RTX 5060 8 GB",
    gpus: [],
    mem: null,
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

  /*__HW__*/

  // ================================================================ texts (ru / en)
  var I18N = {
    ru: {
      title: "🖥️ Конфигурация ПК",
      r_cpu: "Процессор", r_gpu: "Видеокарта", r_ram: "Оперативная память", r_board: "Материнская плата",
      r_os: "ОС", r_directx: "DirectX", r_disks: "Диски", r_audio: "Звук", r_display: "Монитор",
      src_auto: "✓ характеристики определены автоматически", src_wait: "пока показаны сохранённые данные — идёт автоопределение…",
      gb: "ГБ", min: "Мин", rec: "Рек",
      chk_tip: "ваш компонент ≈ ×{0} от требуемого (оценка по условным баллам)", na_tip: "нет данных для сравнения",
      unk: "⚠ не распознан — ввести баллы", vram_tip: "видеопамять: у вас {0} ГБ, нужно {1} ГБ",
      n_cpu: "процессор", n_gpu: "видеокарта", n_ram: "оперативная память", n_vram: "видеопамять", and: " и ",
      v_rec_ok: "Ваш {0} — на уровне рекомендуемых требований или выше.",
      v_rec_mid: "Почти на уровне рекомендуемых требований ({0}) — игра должна идти нормально.",
      v_between: "Выше минимальных, но ниже рекомендуемых требований (слабее всего: {0}).",
      v_bad: "Ниже требований игры (слабее всего: {0}) — возможны сильные тормоза.",
      v_min_ok: "Соответствует минимальным требованиям ({0}).", v_min_mid: "Почти на уровне минимальных требований ({0}).",
      v_min_bad: "Ниже минимальных требований (слабее всего: {0}).",
      s_ok: "Подходит", s_mid: "Почти на уровне", s_bad: "Слабовато",
      bn: "Узкое место: {0} (у {1} запас ×{2}).", balanced: "Связка процессор + видеокарта сбалансирована.",
      ssd_ok: "Игре нужен SSD — ставьте на {0} ({1}, свободно {2} ГБ).",
      ssd_rec_ok: "SSD рекомендуется — ставьте на {0} ({1}, свободно {2} ГБ).",
      ssd_hdd: "Игре нужен SSD, а свободного места хватает только на HDD ({0}). Освободите место на SSD.",
      ssd_rec_hdd: "SSD рекомендуется, но сейчас места хватает только на HDD ({0}).",
      dlc_note: "У этого DLC нет своих требований — взяты требования основной игры: {0}.",
      fps_title: "Примерный FPS на вашем ПК", pr_low: "Низкие", pr_medium: "Средние", pr_high: "Высокие", pr_ultra: "Ультра",
      at_monitor: " ◂ ваш монитор", at_res: " ◂ ваше разрешение", fps_min: "мин. {0}",
      fps_avg: "Среднее по {0} сайтам: {1}.", fps_one: "Источник: {0}.", fps_not_measure: "Это оценки сайтов, а не замеры на вашем ПК.",
      fps_local: "Локальная оценка по системным требованиям игры (≈ ±30 %).", fps_more: "Ищу ещё на других сайтах…",
      fps_loading: "Ищу данные на сайтах…", fps_none: "Данных на сайтах для этой игры не нашлось.",
      fps_norpc: "Не удалось связаться с бэкендом плагина — сайты не опрошены.", fps_off: "Поиск на сайтах выключен в настройках.",
      fps_nodata: "Нет данных: в требованиях игры нет известных процессора/видеокарты, а на сайтах игра не найдена.",
      hz_legend: "Подчёркнуто — достигает частоты {0} Гц.", cpu_adj_yes: "checkfps.io: пересчитано с Core i5-13400 под ваш процессор",
      cpu_adj_no: "checkfps.io считает для Core i5-13400 (ваш процессор не слабее)", detail_tip: "по сайтам",
      up_head: "Апскейл ({0}, {1}; оценка, если игра поддерживает):", fg: "+ генерация кадров",
      fold: "Свернуть", unfold: "Развернуть", settings: "Настройки",
      p_view: "Вид", p_title: "Заголовок", p_lang: "Язык", p_lang_auto: "Авто (как в Steam)",
      p_accent: "Акцент", p_border: "Рамка", p_bg: "Фон", p_text: "Текст", p_label: "Названия строк",
      p_alpha: "Непрозрачность фона, %", p_font: "Размер шрифта, px", p_width: "Ширина, %", p_radius: "Скругление, px", p_lw: "Ширина названий, px",
      p_compare: "Проверка по требованиям (✓/≈/✗)", p_fps: "Показывать примерный FPS", p_online: "Искать FPS на сайтах",
      p_upscale: "Строка про DLSS / FSR", p_collapsed: "Свёрнутый (компактный) вид",
      p_play: "Игровое разрешение и частота", p_playres: "Разрешение, на котором вы играете", p_auto_monitor: "Авто (по монитору)",
      p_hz: "Целевая частота, Гц (0 = как у монитора)",
      p_sources: "Источники FPS (берётся среднее по включённым)", p_scores: "Свои баллы (0 = авто)",
      p_score_cpu: "Баллы процессора", p_score_gpu: "Баллы видеокарты",
      p_score_hint: "Шкала условная (как PassMark): RTX 3060 ≈ 17000, RTX 4070 ≈ 27000, Ryzen 5 5600X ≈ 21800, Core i5-12400 ≈ 19000. Распознано: процессор {0}, видеокарта {1}.",
      p_rows: "Строки: показывать / своё значение (пусто = авто)", p_extra: "Дополнительные строки", p_ph_name: "Название", p_ph_value: "Значение",
      p_refresh: "Обновить FPS", p_reset: "Сбросить",
      mem_xmp: "Память работает на {0} МГц при заявленных {1} — возможно, не включён XMP/EXPO (в BIOS).",
      mem_single: "Установлен один модуль памяти — одноканальный режим снижает FPS.",
      mem_ryzen: "У Ryzen скорость памяти заметно влияет на FPS (ориентир: DDR4-3600, DDR5-6000).",
      pcgw: "PCGamingWiki", pcgw_link: "проблемы и фиксы ↗", pcgw_mod: "через мод",
      pg_uw: "ультраширокий экран", pg_4k: "4K", pg_120: "120+ FPS", pg_hdr: "HDR", pg_rt: "трассировка лучей", pg_up: "апскейл", pg_bl: "окно без рамки",
      shot: "Сохранить картинку", toast_copied: "Картинка скопирована в буфер обмена", toast_saved: "Картинка сохранена файлом pc-info.png", toast_fail: "Не удалось сделать картинку",
      p_profiles: "Профили", prof_neon: "Неон", prof_minimal: "Минимализм", prof_verdict: "Только вердикт",
      p_badges: "Значки ✓/≈/✗ в списках магазина", p_pcgw: "Особенности игры с PCGamingWiki",
      p_keys: "Горячие клавиши: Alt+Shift+C — свернуть/развернуть, Alt+Shift+P — следующий профиль, Alt+Shift+S — картинка.",
      badge_tip: "Ваш ПК: {0}"
    },
    en: {
      title: "🖥️ PC configuration",
      r_cpu: "Processor", r_gpu: "Graphics card", r_ram: "Memory", r_board: "Motherboard",
      r_os: "OS", r_directx: "DirectX", r_disks: "Disks", r_audio: "Audio", r_display: "Display",
      src_auto: "✓ specs detected automatically", src_wait: "showing saved data — auto-detection in progress…",
      gb: "GB", min: "Min", rec: "Rec",
      chk_tip: "your part ≈ ×{0} of the required one (rough score-based estimate)", na_tip: "no data to compare",
      unk: "⚠ not recognised — enter score", vram_tip: "video memory: you have {0} GB, needed {1} GB",
      n_cpu: "CPU", n_gpu: "GPU", n_ram: "RAM", n_vram: "VRAM", and: " and ",
      v_rec_ok: "Your {0} meet the recommended requirements or better.",
      v_rec_mid: "Close to the recommended requirements ({0}) — the game should run fine.",
      v_between: "Above minimum but below recommended requirements (weakest: {0}).",
      v_bad: "Below the game's requirements (weakest: {0}) — expect heavy slowdowns.",
      v_min_ok: "Meets the minimum requirements ({0}).", v_min_mid: "Close to the minimum requirements ({0}).",
      v_min_bad: "Below the minimum requirements (weakest: {0}).",
      s_ok: "Runs well", s_mid: "Borderline", s_bad: "Below spec",
      bn: "Bottleneck: {0} ({1} has ×{2} headroom).", balanced: "CPU and GPU are well balanced.",
      ssd_ok: "The game wants an SSD — install it on {0} ({1}, {2} GB free).",
      ssd_rec_ok: "An SSD is recommended — install it on {0} ({1}, {2} GB free).",
      ssd_hdd: "The game wants an SSD, but only an HDD ({0}) has enough free space. Free up space on an SSD.",
      ssd_rec_hdd: "An SSD is recommended, but only an HDD ({0}) has enough free space now.",
      dlc_note: "This DLC has no requirements of its own — using the base game's: {0}.",
      fps_title: "Estimated FPS on your PC", pr_low: "Low", pr_medium: "Medium", pr_high: "High", pr_ultra: "Ultra",
      at_monitor: " ◂ your display", at_res: " ◂ your resolution", fps_min: "min {0}",
      fps_avg: "Average of {0} sites: {1}.", fps_one: "Source: {0}.", fps_not_measure: "These are the sites' estimates, not measurements of your PC.",
      fps_local: "Local estimate from the game's own requirements (≈ ±30%).", fps_more: "Looking at more sites…",
      fps_loading: "Looking for data on the sites…", fps_none: "No data found on the sites for this game.",
      fps_norpc: "Could not reach the plugin backend — the sites were not queried.", fps_off: "Site lookup is turned off in the settings.",
      fps_nodata: "No data: the requirements list no known CPU/GPU and the game was not found on the sites.",
      hz_legend: "Underlined — reaches {0} Hz.", cpu_adj_yes: "checkfps.io: rescaled from Core i5-13400 to your CPU",
      cpu_adj_no: "checkfps.io assumes a Core i5-13400 (your CPU is not slower)", detail_tip: "per site",
      up_head: "Upscaling ({0}, {1}; estimate, if the game supports it):", fg: "+ frame generation",
      fold: "Collapse", unfold: "Expand", settings: "Settings",
      p_view: "Look", p_title: "Title", p_lang: "Language", p_lang_auto: "Auto (as in Steam)",
      p_accent: "Accent", p_border: "Border", p_bg: "Background", p_text: "Text", p_label: "Row names",
      p_alpha: "Background opacity, %", p_font: "Font size, px", p_width: "Width, %", p_radius: "Corner radius, px", p_lw: "Name column width, px",
      p_compare: "Check against requirements (✓/≈/✗)", p_fps: "Show estimated FPS", p_online: "Look up FPS on the sites",
      p_upscale: "DLSS / FSR line", p_collapsed: "Collapsed (compact) view",
      p_play: "Play resolution and refresh rate", p_playres: "Resolution you play at", p_auto_monitor: "Auto (from the monitor)",
      p_hz: "Target refresh rate, Hz (0 = same as monitor)",
      p_sources: "FPS sources (the average of the enabled ones is used)", p_scores: "Own scores (0 = auto)",
      p_score_cpu: "CPU score", p_score_gpu: "GPU score",
      p_score_hint: "Rough PassMark-like scale: RTX 3060 ≈ 17000, RTX 4070 ≈ 27000, Ryzen 5 5600X ≈ 21800, Core i5-12400 ≈ 19000. Recognised: CPU {0}, GPU {1}.",
      p_rows: "Rows: show / own value (empty = auto)", p_extra: "Extra rows", p_ph_name: "Name", p_ph_value: "Value",
      p_refresh: "Refresh FPS", p_reset: "Reset",
      mem_xmp: "Memory runs at {0} MHz while rated for {1} — XMP/EXPO may be off (enable it in the BIOS).",
      mem_single: "Only one memory module is installed — single-channel mode lowers FPS.",
      mem_ryzen: "Memory speed noticeably affects FPS on Ryzen (target: DDR4-3600, DDR5-6000).",
      pcgw: "PCGamingWiki", pcgw_link: "issues & fixes ↗", pcgw_mod: "via mod",
      pg_uw: "ultrawide", pg_4k: "4K", pg_120: "120+ FPS", pg_hdr: "HDR", pg_rt: "ray tracing", pg_up: "upscaling", pg_bl: "borderless window",
      shot: "Save as picture", toast_copied: "Picture copied to the clipboard", toast_saved: "Picture saved as pc-info.png", toast_fail: "Could not make the picture",
      p_profiles: "Profiles", prof_neon: "Neon", prof_minimal: "Minimal", prof_verdict: "Verdict only",
      p_badges: "✓/≈/✗ badges in store lists", p_pcgw: "Game features from PCGamingWiki",
      p_keys: "Hotkeys: Alt+Shift+C — collapse/expand, Alt+Shift+P — next profile, Alt+Shift+S — picture.",
      badge_tip: "Your PC: {0}"
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
    playRes: "auto", targetHz: 0, scoreCpu: 0, scoreGpu: 0, pcgw: true, badges: true, profile: "neon",
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
    if (s.title === "🖥️ Конфигурация ПК") o.title = "";      // old default title -> follow the language
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
    if (/^(mb|мб)/.test(unit)) return v / 1024;
    if (/^(tb|тб)/.test(unit)) return v * 1024;
    return v;
  }

  // ================================================================ requirements
  var SIZE = /(\d+(?:[.,]\d+)?)\s*(MB|GB|TB|МБ|ГБ|ТБ)/i;
  function colReqs(col) {
    var o = { cpu: [], gpu: [], ram: null, vram: null, disk: null, ssd: 0 };
    if (!col) return o;
    var li = col.querySelectorAll("li");
    for (var i = 0; i < li.length; i++) {
      var tx = li[i].textContent.replace(/\s+/g, " ").trim();
      var m = /^([^:：]{2,32})[:：]\s*(.+)$/.exec(tx);
      if (!m) continue;
      var lab = m[1].toLowerCase(), val = m[2], z;
      if (/processor|cpu|процессор/.test(lab)) o.cpu = o.cpu.concat(HW.alts(val));
      else if (/graphics|video|gpu|видео/.test(lab)) {
        o.gpu = o.gpu.concat(HW.alts(val));
        z = /(\d+(?:[.,]\d+)?)\s*(GB|ГБ|MB|МБ)\s*(?:of\s*)?(?:dedicated\s*)?(?:v?ram|video|видео)/i.exec(val);
        if (z && o.vram === null) o.vram = toGB(z[1], z[2]);
      } else if (/memory|ram|оператив|памят/.test(lab)) {
        z = SIZE.exec(val);
        if (z && o.ram === null) o.ram = toGB(z[1], z[2]);
      } else if (/storage|hard drive|disk|drive|место|накопител|диск/.test(lab)) {
        z = SIZE.exec(val);
        if (z && o.disk === null) o.disk = toGB(z[1], z[2]);
        if (/ssd|solid[- ]state/i.test(val)) {
          var strict = /(ssd|solid[- ]state)[^.;,]{0,25}(required|only|mandatory)|(required|only)[^.;,]{0,12}(ssd|solid)/i.test(val) ||
            !/recommend|prefer|ideal|желательно|рекоменд/i.test(val);
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
    var m = /(\d{3,4})\s*[x×]\s*(\d{3,4})/.exec(str), h = /(\d{2,3})\s*Hz/i.exec(str);
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
      var sign = x.cls === "ok" ? "✓" : (x.cls === "mid" ? "≈" : "✗");
      return '<span class="nn-' + x.cls + '"' + (plain ? "" : ' title="' + esc(t("chk_tip", x.r.toFixed(2))) + '"') + ">" + label + " " + sign + (plain ? "" : " ×" + x.r.toFixed(1)) + "</span>";
    }
    return '<span class="nn-chk">' + one(t("min"), r.min) + " · " + one(t("rec"), r.rec) + "</span>";
  }
  function vramChip(res) {
    var x = res.vram.rec || res.vram.min;
    if (!x) return "";
    return '<span class="nn-chk"><span class="nn-' + x.cls + '" title="' + esc(t("vram_tip", res.have.vram, res.need.vram)) + '">VRAM ' + (x.cls === "ok" ? "✓" : "✗") + "</span></span>";
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
  var RES_ROWS = [["1080p", "1920×1080"], ["1440p", "2560×1440"], ["4k", "3840×2160"]];
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
        (detail[res] = detail[res] || {})[p] = det.join(" · ");
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
        h += '<td class="' + cls + '"' + (tip ? ' title="' + esc(t("detail_tip") + ": " + tip) + '"' : "") + ">" + (v != null ? v : "—") +
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
    var parts = [fam + " Quality ≈ <b>" + q + "</b>", fam + " Performance ≈ <b>" + p + "</b>"];
    if ((fam === "DLSS" && num >= 4000) || (fam === "FSR" && /^rx[79]/.test(k))) parts.push(t("fg") + " ≈ <b>" + Math.round(q * 1.7) + "</b>");
    var label = (RES_ROWS.filter(function (r) { return r[0] === key; })[0] || ["", ""])[1];
    return '<div class="nn-up"><span>' + t("up_head", label, t("pr_high")) + "</span> " + parts.join(" · ") + "</div>";
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


  // ================================================================ memory: type, speed, XMP/EXPO
  function memSpeed(m) { return m ? (+m.conf || +m.rated || 0) : 0; }
  function memLabel(m) {
    if (!m || !memSpeed(m)) return m && m.type ? " " + m.type : "";
    return " " + (m.type ? m.type + "-" : "") + memSpeed(m);
  }
  // returns a list of HTML notes (max 2)
  function memNotes(m, cpuStr) {
    var out = [];
    if (!m) return out;
    var conf = +m.conf || 0, rated = +m.rated || 0, type = String(m.type || "");
    if (conf && rated && conf < rated * 0.9) out.push(t("mem_xmp", conf, rated));
    if ((+m.count || 0) === 1) out.push(t("mem_single"));
    var sp = conf || rated, ddr5 = /DDR5/i.test(type);
    if (/ryzen/i.test(cpuStr || "") && sp && sp < (ddr5 ? 5200 : 3200) && !out.length) out.push(t("mem_ryzen"));
    return out.slice(0, 2);
  }

  // ================================================================ PCGamingWiki: game features in one line
  var PCGW_KEY = "nnPcInfoPcgw1";
  var PCGW_FIELDS_FULL = ["Ultrawidescreen", "4K_Ultra_HD", "120_FPS", "HDR", "Ray_tracing", "Upscaling", "Borderless_fullscreen_windowed"];
  var PCGW_FIELDS_SAFE = ["Ultrawidescreen", "4K_Ultra_HD", "HDR"];
  var PCGW_SHOW = [["ultrawidescreen", "pg_uw"], ["4kultrahd", "pg_4k"], ["120fps", "pg_120"], ["hdr", "pg_hdr"], ["raytracing", "pg_rt"], ["upscaling", "pg_up"], ["borderlessfullscreenwindowed", "pg_bl"]];
  var pcgw = { id: "", status: "idle", data: null };
  function pcgwUrl(id, fields) {
    var f = ["Infobox_game._pageName%3DPage"].concat(fields.map(function (x) { return "Video." + x; })).join(",");
    return "https://www.pcgamingwiki.com/w/api.php?action=cargoquery&format=json&limit=1&tables=Infobox_game,Video&join_on=Infobox_game._pageID%3DVideo._pageID&fields=" + f +
      "&where=" + encodeURIComponent('Infobox_game.Steam_AppID HOLDS "' + id + '"');
  }
  // text of the API answer -> { page, flags: { ultrawidescreen: "true"|"false"|"hackable" ... } } or null
  function parsePcgw(text) {
    var j;
    try { j = JSON.parse(String(text)); } catch (e) { return null; }
    var rows = j && j.cargoquery;
    if (!rows || !rows.length) return null;
    var row = rows[0].title || rows[0], flags = {}, page = "";
    Object.keys(row).forEach(function (k) {
      var nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nk === "page") { page = String(row[k]); return; }
      var v = String(row[k] == null ? "" : row[k]).toLowerCase().trim();
      if (v === "true" || v === "false" || v === "hackable" || v === "limited") flags[nk] = v;
    });
    return { page: page, flags: flags };
  }
  function pcgwCacheGet(id) {
    try { var c = JSON.parse(localStorage.getItem(PCGW_KEY) || "{}")[id]; if (c && Date.now() - c.t < (c.d ? 14 : 1) * 86400000) return c; } catch (e) {}
    return null;
  }
  function pcgwCacheSet(id, d) {
    try {
      var all = JSON.parse(localStorage.getItem(PCGW_KEY) || "{}"), ks;
      all[id] = { t: Date.now(), d: d }; ks = Object.keys(all);
      if (ks.length > 150) ks.sort(function (a, b) { return all[a].t - all[b].t; }).slice(0, ks.length - 150).forEach(function (k) { delete all[k]; });
      localStorage.setItem(PCGW_KEY, JSON.stringify(all));
    } catch (e) {}
  }
  function pcgwFetch(id, fields) {
    return rpc("FetchPage", { url: pcgwUrl(id, fields) }).then(function (txt) {
      if (typeof txt !== "string" || /^ERR/.test(txt)) return { err: true };
      if (/"error"/.test(txt) && !/"cargoquery"/.test(txt)) return { err: true, bad: true };
      return { d: parsePcgw(txt) };
    });
  }
  function ensurePcgw(s) {
    var id = curApp().id;
    if (!s.pcgw || !s.online || !id) return;
    if (pcgw.id === id) return;
    pcgw = { id: id, status: "loading", data: null };
    var c = pcgwCacheGet(id);
    if (c) { pcgw.data = c.d; pcgw.status = c.d ? "done" : "none"; return; }
    pcgwFetch(id, PCGW_FIELDS_FULL).then(function (r) {
      if (r.bad) return pcgwFetch(id, PCGW_FIELDS_SAFE);   // an unknown field name fails the whole query
      return r;
    }).then(function (r) {
      if (pcgw.id !== id) return;
      if (r.err) { pcgw.status = "none"; return; }
      pcgw.data = r.d; pcgw.status = r.d ? "done" : "none";
      pcgwCacheSet(id, r.d);
      render();
    });
  }
  function pcgwHtml(d, id) {
    if (!d || !d.flags) return "";
    var items = [];
    PCGW_SHOW.forEach(function (x) {
      var v = d.flags[x[0]];
      if (v === "true") items.push('<span class="nn-ok">✓</span> ' + esc(t(x[1])));
      else if (v === "false") items.push('<span class="nn-bad">✗</span> ' + esc(t(x[1])));
      else if (v === "hackable") items.push('<span class="nn-mid">≈</span> ' + esc(t(x[1])) + " (" + esc(t("pcgw_mod")) + ")");
    });
    if (!items.length) return "";
    return '<div class="nn-pcgw">' + esc(t("pcgw")) + ": " + items.join(" · ") + ' · <a href="https://www.pcgamingwiki.com/api/appid.php?appid=' + esc(id) + '" target="_blank" rel="noopener">' + esc(t("pcgw_link")) + "</a></div>";
  }

  // ================================================================ profiles
  var PROFILE_IDS = ["neon", "minimal", "verdict"];
  var PROFILES = {
    neon: { accent: "#22d3ee", border: "#8b5cf6", bg: "#06080e", bgAlpha: 88, text: "#c9d1e0", label: "#8b95aa", radius: 12, compare: true, fps: true, online: true, upscale: true, pcgw: true, collapsed: false, hidden: {} },
    minimal: { accent: "#aab4c8", border: "#3a4256", bg: "#10141c", bgAlpha: 70, text: "#c9d1e0", label: "#7d8799", radius: 6, compare: true, fps: false, online: false, upscale: false, pcgw: false, collapsed: false, hidden: { board: true, os: true, directx: true, audio: true, display: true } },
    verdict: { compare: true, fps: false, online: false, upscale: false, pcgw: false, collapsed: true }
  };
  function applyProfile(id) {
    if (!PROFILES[id]) return false;
    var s = load(), p = PROFILES[id], k;
    for (k in p) s[k] = (p[k] && typeof p[k] === "object") ? JSON.parse(JSON.stringify(p[k])) : p[k];
    s.profile = id; save(s); render();
    return true;
  }
  function nextProfile() {
    var cur = PROFILE_IDS.indexOf(load().profile);
    return applyProfile(PROFILE_IDS[(cur + 1) % PROFILE_IDS.length]);
  }

  // ================================================================ PNG export of the block
  function toast(msg) {
    if (!box) return;
    var el = box.div.querySelector(".nn-toast");
    if (!el) { el = document.createElement("div"); el.className = "nn-toast"; box.div.appendChild(el); }
    el.textContent = msg;
    clearTimeout(toast.t); toast.t = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
  }
  function exportPng() {
    return new Promise(function (resolve) {
      try {
        if (!box) return resolve(null);
        var s = load(), div = box.div, w = Math.ceil(div.offsetWidth), h = Math.ceil(div.offsetHeight);
        if (!w || !h) return resolve(null);
        var clone = div.cloneNode(true);
        [].forEach.call(clone.querySelectorAll(".nn-btn,.nn-set,.nn-toast"), function (n) { n.parentNode.removeChild(n); });
        clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        clone.style.margin = "0"; clone.style.width = w + "px";
        var xml = new XMLSerializer().serializeToString(clone);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w + 24) + '" height="' + (h + 24) + '"><foreignObject x="12" y="12" width="' + w + '" height="' + h + '"><style xmlns="http://www.w3.org/1999/xhtml">' +
          css(s).replace(/</g, "&lt;") + "</style>" + xml + "</foreignObject></svg>";
        var img = new Image();
        img.onload = function () {
          try {
            var c = document.createElement("canvas"), k = 2;
            c.width = (w + 24) * k; c.height = (h + 24) * k;
            var cx = c.getContext("2d");
            cx.fillStyle = "#0b0e14"; cx.fillRect(0, 0, c.width, c.height);
            cx.scale(k, k); cx.drawImage(img, 0, 0);
            c.toBlob(function (b) { resolve(b || null); }, "image/png");
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      } catch (e) { resolve(null); }
    });
  }
  function shareImage() {
    return exportPng().then(function (b) {
      if (!b) { toast(t("toast_fail")); return false; }
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          return navigator.clipboard.write([new ClipboardItem({ "image/png": b })]).then(function () { toast(t("toast_copied")); return true; }, function () { return download(b); });
        }
      } catch (e) {}
      return download(b);
    });
  }
  function download(b) {
    try {
      var a = document.createElement("a"), u = URL.createObjectURL(b);
      a.href = u; a.download = "pc-info.png";
      (document.body || document.documentElement).appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
      toast(t("toast_saved")); return true;
    } catch (e) { toast(t("toast_fail")); return false; }
  }
  function toggleFold() { var x = load(); x.collapsed = !x.collapsed; save(x); render(); }
  function onKey(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
    var tg = e.target, tag = tg && tg.tagName ? tg.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select" || (tg && tg.isContentEditable)) return;
    var c = e.code;
    if (c === "KeyC") { if (box) { e.preventDefault(); toggleFold(); } }
    else if (c === "KeyP") { if (box) { e.preventDefault(); nextProfile(); } }
    else if (c === "KeyS") { if (box) { e.preventDefault(); shareImage(); } }
  }

  // ================================================================ badges in store lists (search, tabs, capsules, wishlist)
  var BADGE_KEY = "nnPcInfoBadges1";
  var badgeMem = null, badgeQueue = [], badgeBusy = false, badgePause = 0, badgeIO = null, badgeMO = null, badgeTimer = 0;
  function badgeStore() {
    if (badgeMem) return badgeMem;
    try { badgeMem = JSON.parse(localStorage.getItem(BADGE_KEY) || "{}") || {}; } catch (e) { badgeMem = {}; }
    return badgeMem;
  }
  function badgeSave() {
    try {
      var all = badgeStore(), ks = Object.keys(all);
      if (ks.length > 400) ks.sort(function (a, b) { return all[a].t - all[b].t; }).slice(0, ks.length - 400).forEach(function (k) { delete all[k]; });
      localStorage.setItem(BADGE_KEY, JSON.stringify(all));
    } catch (e) {}
  }
  function reqsFromDetails(det) {
    var pr = det && det.pc_requirements;
    if (!pr || Array.isArray(pr)) return null;
    function col(html) {
      if (!html) return null;
      var d = document.createElement("div");
      d.innerHTML = String(html);      // inert: not attached to the page
      return d;
    }
    var mn = col(pr.minimum), rc = col(pr.recommended);
    var r = { min: colReqs(mn), rec: colReqs(rc) };
    return r;
  }
  function badgeVerdict(reqs) {
    var s = load(), my = myParts(s), sc = myScores(s, my);
    return verdict(checkHw(reqs, s, my, sc));
  }
  function badgeFor(id) {
    var e = badgeStore()[id];
    if (!e || !e.r) return null;
    if (Date.now() - e.t > 14 * 86400000) return null;
    return badgeVerdict(e.r);
  }
  function cardAppId(a) {
    var id = a.getAttribute("data-ds-appid");
    if (id) return String(id).split(",")[0];
    var m = /\/app\/(\d+)/.exec(a.getAttribute("href") || "");
    return m ? m[1] : "";
  }
  function badgeEl(a) {
    var b = a.querySelector(":scope > .nn-badge, .nn-badge");
    return b;
  }
  function putBadge(a, v) {
    var b = badgeEl(a);
    if (!v) { if (b && b.parentNode) b.parentNode.removeChild(b); return; }
    if (!b) {
      b = document.createElement("span"); b.className = "nn-badge";
      var price = a.querySelector(".discount_final_price,.search_price,.game_purchase_price,.tab_item_discount,.price");
      if (price && price.parentNode) price.parentNode.insertBefore(b, price);
      else { b.className += " nn-badge-abs"; if (getComputedStyle(a).position === "static") a.style.position = "relative"; a.appendChild(b); }
    }
    b.className = b.className.replace(/\bnn-b-\w+/g, "").trim() + " nn-b-" + v[0];
    b.textContent = v[0] === "ok" ? "✓" : (v[0] === "mid" ? "≈" : "✗");
    b.title = t("badge_tip", v[1]);
  }
  function badgeStyle() {
    if (document.getElementById("nn-badge-css")) return;
    var st = document.createElement("style"); st.id = "nn-badge-css";
    st.textContent = ".nn-badge{display:inline-block;min-width:18px;padding:0 5px;margin-right:6px;border-radius:9px;font:700 12px/18px Arial,sans-serif;text-align:center;vertical-align:middle;border:1px solid currentColor;background:rgba(0,0,0,.55)}" +
      ".nn-badge-abs{position:absolute;right:6px;bottom:6px;margin:0;z-index:5}.nn-b-ok{color:#4ade80}.nn-b-mid{color:#fbbf24}.nn-b-bad{color:#f87171}";
    (document.head || document.documentElement).appendChild(st);
  }
  function badgeNext() {
    if (badgeBusy || !badgeQueue.length || state.source !== "auto") return;
    if (Date.now() < badgePause) { setTimeout(badgeNext, badgePause - Date.now() + 50); return; }
    var a = badgeQueue.shift(), id = cardAppId(a);
    if (!id || badgeFor(id)) { if (id) putBadge(a, badgeFor(id)); return badgeNext(); }
    badgeBusy = true;
    var done = function () { badgeBusy = false; setTimeout(badgeNext, 700); };
    try {
      fetch("/api/appdetails?appids=" + id + "&filters=pc_requirements&l=english").then(function (r) {
        if (r.status === 429 || r.status === 403) { badgePause = Date.now() + 90000; badgeQueue.unshift(a); throw new Error("rate"); }
        return r.json();
      }).then(function (j) {
        var e = j && j[id], reqs = e && e.success ? reqsFromDetails(e.data) : null;
        var ok = reqs && (reqs.min.cpu.length || reqs.min.gpu.length || reqs.min.ram || reqs.rec.cpu.length || reqs.rec.gpu.length || reqs.rec.ram);
        badgeStore()[id] = { t: Date.now(), r: ok ? reqs : null };
        badgeSave();
        document.querySelectorAll('a[data-nn-b="' + id + '"]').forEach(function (n) { putBadge(n, ok ? badgeFor(id) : null); });
        done();
      })["catch"](function () { done(); });
    } catch (e) { done(); }
  }
  function badgeSeen(a) {
    var id = a.getAttribute("data-nn-b");
    var c = badgeStore()[id];
    if (c && Date.now() - c.t < 14 * 86400000) { putBadge(a, c.r ? badgeFor(id) : null); return; }
    if (badgeQueue.indexOf(a) < 0) badgeQueue.push(a);
    badgeNext();
  }
  function badgeScan() {
    var s = load();
    if (!s.badges) {
      [].forEach.call(document.querySelectorAll(".nn-badge"), function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
      return;
    }
    if (state.source !== "auto") return;
    badgeStyle();
    var own = pageAppId();
    [].forEach.call(document.querySelectorAll('a[href*="/app/"],a[data-ds-appid]'), function (a) {
      if (a.hasAttribute("data-nn-b")) return;
      var id = cardAppId(a);
      if (!id || id === own) return;
      if (!(a.hasAttribute("data-ds-appid") || a.querySelector("img") || a.classList.contains("search_result_row"))) return;
      a.setAttribute("data-nn-b", id);
      if (window.IntersectionObserver) {
        if (!badgeIO) badgeIO = new IntersectionObserver(function (es) {
          es.forEach(function (en) { if (en.isIntersecting) { badgeIO.unobserve(en.target); badgeSeen(en.target); } });
        }, { rootMargin: "200px" });
        badgeIO.observe(a);
      } else badgeSeen(a);
    });
  }
  function badgesRefresh() {
    // hardware or settings changed: redraw every badge from the cache
    [].forEach.call(document.querySelectorAll("a[data-nn-b]"), function (a) {
      var id = a.getAttribute("data-nn-b"), c = badgeStore()[id];
      if (c && c.r) putBadge(a, badgeFor(id));
    });
    badgeScan();
  }
  function startBadges() {
    if (badgeMO || !window.MutationObserver) return;
    badgeMO = new MutationObserver(function () { clearTimeout(badgeTimer); badgeTimer = setTimeout(badgeScan, 600); });
    badgeMO.observe(document.documentElement, { childList: true, subtree: true });
    badgeScan();
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
      os: esc(d.os), cpu: esc(d.cpu), ram: d.ramGB ? d.ramGB + " " + t("gb") + esc(memLabel(d.mem)) : "", gpu: esc(d.gpu) + extra,
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
      ".nn-pcgw{margin-top:6px;font-size:" + Math.max(10, (+s.fontSize) - 1) + "px}.nn-pcgw a{color:" + s.accent + "}" +
      ".nn-shot{right:62px}.nn-toast{position:absolute;left:16px;bottom:8px;padding:3px 10px;border-radius:8px;background:rgba(0,0,0,.8);border:1px solid " + rgba(s.accent, .6) + ";color:" + s.text + "}" +
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
      if (row && row.high) fp = "~" + row.high + " FPS · " + (RES_ROWS.filter(function (r) { return r[0] === key; })[0] || ["", ""])[1] + " · " + t("pr_high").toLowerCase();
    }
    var chip = v ? '<span class="nn-chip nn-v-' + v[0] + '">' + (v[0] === "ok" ? "✓ " : (v[0] === "mid" ? "≈ " : "✗ ")) + t("s_" + v[0]) + "</span>" : "";
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

    var head = '<button class="nn-btn nn-gear" title="' + esc(t("settings")) + '">⚙</button>';
    if (s.collapsed) {
      html = head + compactHtml(s, v, local);
    } else {
      var src = state.source === "auto"
        ? t("src_auto") + (state.updated ? " (" + esc(state.updated) + ")" : "")
        : t("src_wait");
      html = head + '<button class="nn-btn nn-fold" title="' + esc(t("fold")) + '" data-act="fold">▴</button><button class="nn-btn nn-shot" title="' + esc(t("shot")) + '" data-act="shot">📷</button><h3>' + esc(s.title || t("title")) + '</h3><div class="nn-src">' + src + "</div><ul>";
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
        if (v) html += '<div class="nn-verdict nn-v-' + v[0] + '">' + (v[0] === "ok" ? "✓ " : (v[0] === "mid" ? "≈ " : "✗ ")) + v[1] + "</div>";
        var notes = [bottleneck(hw), ssdAdvice(reqs), box.base ? t("dlc_note", esc(box.base.name)) : ""].concat(memNotes(state.data.mem, my.cpu)).filter(Boolean);
        notes.forEach(function (n) { html += '<div class="nn-note">' + n + "</div>"; });
      }
      html += fpsBlock(s, local, my);
      ensurePcgw(s);
      if (s.pcgw && pcgw.id === curApp().id && pcgw.data) html += pcgwHtml(pcgw.data, pcgw.id);
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
      if (a === "shot") el.onclick = function () { shareImage(); };
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
    var h = '<div class="nn-set"><h4>' + t("p_profiles") + "</h4>" +
      PROFILE_IDS.map(function (id) { return '<button data-prof="' + id + '"' + (s.profile === id ? ' style="outline:1px solid ' + s.accent + '"' : "") + ">" + esc(t("prof_" + id)) + "</button>"; }).join("") +
      '<div class="nn-hint">' + esc(t("p_keys")) + "</div><h4>" + t("p_view") + "</h4>" +
      '<label><span>' + t("p_title") + '</span><input type="text" data-k="title" value="' + esc(s.title) + '" placeholder="' + esc(t("title")) + '"></label>' +
      sel("lang", t("p_lang"), s.lang, [["auto", t("p_lang_auto")], ["ru", "Русский"], ["en", "English"]]) +
      col("accent", t("p_accent"), s.accent) + col("border", t("p_border"), s.border) + col("bg", t("p_bg"), s.bg) +
      col("text", t("p_text"), s.text) + col("label", t("p_label"), s.label) +
      num("bgAlpha", t("p_alpha"), s.bgAlpha, 0, 100) + num("fontSize", t("p_font"), s.fontSize, 9, 24) +
      num("width", t("p_width"), s.width, 30, 100) + num("radius", t("p_radius"), s.radius, 0, 30) + num("labelWidth", t("p_lw"), s.labelWidth, 60, 300) +
      chk("compare", t("p_compare"), s.compare) + chk("fps", t("p_fps"), s.fps) + chk("online", t("p_online"), s.online) +
      chk("upscale", t("p_upscale"), s.upscale) + chk("pcgw", t("p_pcgw"), s.pcgw) + chk("badges", t("p_badges"), s.badges) + chk("collapsed", t("p_collapsed"), s.collapsed) +
      "<h4>" + t("p_play") + "</h4>" +
      sel("playRes", t("p_playres"), s.playRes, [["auto", t("p_auto_monitor")], ["1080p", "1920×1080"], ["1440p", "2560×1440"], ["4k", "3840×2160"]]) +
      num("targetHz", t("p_hz"), s.targetHz, 0, 540) +
      "<h4>" + t("p_sources") + "</h4>" +
      SOURCES.map(function (x) { return '<label><span>' + x.name + '</span><input type="checkbox" data-src="' + x.id + '"' + (s.sources[x.id] !== false ? " checked" : "") + "></label>"; }).join("") +
      "<h4>" + t("p_scores") + "</h4>" +
      num("scoreCpu", t("p_score_cpu"), s.scoreCpu, 0, 200000) + num("scoreGpu", t("p_score_gpu"), s.scoreGpu, 0, 200000) +
      '<div class="nn-hint">' + esc(t("p_score_hint", sc.cpuAuto || "—", sc.gpuAuto || "—")) + "</div>" +
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
    [].forEach.call(root.querySelectorAll("[data-prof]"), function (b) { b.onclick = function () { applyProfile(b.getAttribute("data-prof")); }; });
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
    if (IS_STORE) badgesRefresh();
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

  window.__pcInfo = {
    setData: setData, exportPng: exportPng, applyProfile: applyProfile, nextProfile: nextProfile, toggleFold: toggleFold,
    version: "2.3.0", _t: { memNotes: memNotes, memLabel: memLabel, parsePcgw: parsePcgw, pcgwHtml: pcgwHtml, pcgwUrl: pcgwUrl, PROFILES: PROFILES, reqsFromDetails: reqsFromDetails, badgeVerdict: badgeVerdict }
  };
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
    if (IS_APP) (function tick() { if (build() || ++tries > 40) return; setTimeout(tick, 500); })();
    document.addEventListener("keydown", onKey, true);
    if (IS_STORE) startBadges();
    // ask for real data now and retry while the backend is still collecting it
    requestData();
    [3000, 8000, 15000].forEach(function (ms) { setTimeout(function () { if (state.source !== "auto") requestData(); }, ms); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
