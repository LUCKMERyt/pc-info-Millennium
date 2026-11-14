// Shared helpers for the browser tests: a fake Steam store page + a fake Millennium backend.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const WEBKIT = fs.readFileSync(path.resolve(__dirname, "../../../.millennium/Dist/webkit.js"), "utf8");

const REQS = `<div class="game_area_sys_req sysreq_content active" data-os="win">
<div class="game_area_sys_req_leftCol"><ul class="bb_ul"><li><strong>Minimum:</strong><br></li>
<li><strong>OS:</strong> Windows 10 64-bit<br></li>
<li><strong>Processor:</strong> Intel Core i5-6400 or AMD Ryzen 3 1200 or similar<br></li>
<li><strong>Memory:</strong> 8 GB RAM<br></li>
<li><strong>Graphics:</strong> NVIDIA GeForce GTX 660 or AMD Radeon RX 460 (2GB VRAM)<br></li>
<li><strong>Hard Drive:</strong> 25 GB available space<br></li></ul></div>
<div class="game_area_sys_req_rightCol"><ul class="bb_ul"><li><strong>Recommended:</strong><br></li>
<li><strong>Processor:</strong> Intel Core i5-9600 or AMD Ryzen 5 3600 or similar<br></li>
<li><strong>Memory:</strong> 12 GB RAM<br></li>
<li><strong>Graphics:</strong> NVIDIA GeForce GTX 1660 or AMD Radeon RX 590 (2GB VRAM)<br></li></ul></div></div>`;

const GAME_URL = "https://store.steampowered.com/app/227300/Euro_Truck/";
const LIST_URL = "https://store.steampowered.com/search/?term=truck";

function gamePage(lang = "en") {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>body{background:#0b0d12;color:#c6d4df;font:13px Arial;margin:0;padding:20px;width:900px}</style></head>
<body><div id="appHubAppName">Example Game</div>${REQS}</body></html>`;
}
// two cards: 111 = easy game, 222 = needs a monster PC
function listPage() {
  const card = (id) => `<a class="search_result_row" href="https://store.steampowered.com/app/${id}/x/" data-ds-appid="${id}" style="display:block;height:70px"><img width="120" height="45" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><span class="title">Game ${id}</span><div class="search_price">$10</div></a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="background:#0b0d12;color:#ccc">${card(111)}${card(222)}</body></html>`;
}

const DATA = {
  os: "Windows 10 Pro 64-bit", cpu: "AMD Ryzen 7 5700X 8-Core Processor (8C/16T)", ramGB: 32,
  gpu: "NVIDIA GeForce RTX 5060 8 GB", gpus: [], directx: "12", board: "MSI MPG B550", display: "2560x1440 @ 144 Hz",
  disks: [{ id: "C:", free: 72, total: 238, model: "SPCC M.2 PCIe SSD", type: "NVMe" }],
  mem: { type: "DDR4", rated: 3200, conf: 2133, count: 1 }, audio: "n/a", updated: "2026-01-01 00:00:00",
};
const CHECKFPS = "Ultra 96FPS min 69 Good 61FPS min 44 Acceptable 30FPS min 21 High 120FPS min 90 Excellent 80FPS min 60 Good 40FPS min 30 Medium 150FPS min 110 100FPS min 80 55FPS min 40 Low 190FPS min 140 130FPS min 100 70FPS min 50";
const PCGW_OK = JSON.stringify({ cargoquery: [{ title: { Page: "Example Game", Ultrawidescreen: "true", "4K Ultra HD": "true", "120 FPS": "false", HDR: "hackable" } }] });

// pages: { urlSubstring: text } answered by the fake FetchPage; details: { appid: pc_requirements } for /api/appdetails
async function open({ url = GAME_URL, html, pages = {}, details = {}, settings = null, data = DATA, waitFor = ".nn-pc" } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 960, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await ctx.route(url, (r) => r.fulfill({ status: 200, contentType: "text/html", body: html || gamePage() }));
  await ctx.route("**/api/appdetails**", (r) => {
    const id = new URL(r.request().url()).searchParams.get("appids");
    const d = details[id];
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ [id]: d ? { success: true, data: { pc_requirements: d } } : { success: false } }) });
  });
  await ctx.addInitScript(`window.Millennium={callServerMethod:function(){var a=[].slice.call(arguments);if(a.length===3)return Promise.reject('x');
    var pages=${JSON.stringify(pages)};if(a[0]==='FetchPage'){for(var k in pages){if(a[1].url.indexOf(k)>=0)return Promise.resolve(pages[k]);}return Promise.resolve('ERR HTTP 404');}return Promise.resolve('');}};`);
  if (settings) await ctx.addInitScript(`localStorage.setItem('nnPcInfoSettings', ${JSON.stringify(JSON.stringify(settings))});`);
  await ctx.addInitScript(WEBKIT);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 8000 });
  if (data) await page.evaluate((d) => window.__pcInfo.setData(d), data);
  return { browser, page, errors, close: () => browser.close() };
}

module.exports = { open, gamePage, listPage, DATA, CHECKFPS, PCGW_OK, GAME_URL, LIST_URL };
