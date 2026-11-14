// Browser tests (Playwright + Chromium): the block on a fake store page with a fake Millennium backend.
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, DATA, CHECKFPS, PCGW_OK } = require("./helpers");

const text = (page, sel) => page.locator(sel).innerText();

test("block renders with a verdict and no page errors", async () => {
  const t = await open({ pages: { "checkfps.io": CHECKFPS } });
  try {
    await t.page.waitForSelector(".nn-verdict");
    assert.match(await text(t.page, ".nn-pc"), /Ryzen 7 5700X/);
    assert.match(await text(t.page, ".nn-verdict"), /meet|recommended/i);
    assert.deepEqual(t.errors, []);
  } finally { await t.close(); }
});

test("FPS table is filled from a site and says it is an estimate", async () => {
  const t = await open({ pages: { "checkfps.io": CHECKFPS } });
  try {
    await t.page.waitForSelector(".nn-fps table");
    await t.page.waitForFunction(() => /checkfps\.io/.test(document.querySelector(".nn-fps").innerText));
    assert.match(await text(t.page, ".nn-fps"), /not measure|estimate/i);
  } finally { await t.close(); }
});

test("memory: shows type/speed and warns about XMP and a single module", async () => {
  const t = await open({ pages: {} });
  try {
    const all = await text(t.page, ".nn-pc");
    assert.match(all, /DDR4-2133/);
    assert.match(all, /XMP\/EXPO/);
    assert.match(all, /one memory module|single-channel/i);
  } finally { await t.close(); }
});

test("memory: no warning when the memory runs at its rated speed in two modules", async () => {
  const t = await open({ pages: {}, data: { ...DATA, mem: { type: "DDR5", rated: 6000, conf: 6000, count: 2 } } });
  try {
    const all = await text(t.page, ".nn-pc");
    assert.match(all, /DDR5-6000/);
    assert.doesNotMatch(all, /XMP\/EXPO|single-channel/i);
  } finally { await t.close(); }
});

test("PCGamingWiki: one line with features and a link", async () => {
  const t = await open({ pages: { "pcgamingwiki.com": PCGW_OK } });
  try {
    await t.page.waitForSelector(".nn-pcgw");
    const line = await text(t.page, ".nn-pcgw");
    assert.match(line, /ultrawide/i);
    assert.match(line, /120\+ FPS/);
    assert.match(line, /via mod/);
    assert.match(await t.page.locator(".nn-pcgw a").getAttribute("href"), /appid=227300/);
  } finally { await t.close(); }
});

test("PCGamingWiki: a failing answer hides the line, nothing breaks", async () => {
  const t = await open({ pages: { "pcgamingwiki.com": '{"error":{"code":"internal_api_error_MWException"}}' } });
  try {
    await t.page.waitForTimeout(800);
    assert.equal(await t.page.locator(".nn-pcgw").count(), 0);
    assert.deepEqual(t.errors, []);
  } finally { await t.close(); }
});

test("profiles: verdict-only, minimal and neon", async () => {
  const t = await open({ pages: { "checkfps.io": CHECKFPS } });
  try {
    await t.page.evaluate(() => window.__pcInfo.applyProfile("verdict"));
    assert.equal(await t.page.locator(".nn-compact").count(), 1);
    assert.equal(await t.page.locator(".nn-fps").count(), 0);
    await t.page.evaluate(() => window.__pcInfo.applyProfile("minimal"));
    assert.equal(await t.page.locator(".nn-compact").count(), 0);
    assert.equal(await t.page.locator(".nn-fps").count(), 0);
    assert.doesNotMatch(await text(t.page, ".nn-pc ul"), /Motherboard|Audio/i);
    await t.page.evaluate(() => window.__pcInfo.applyProfile("neon"));
    await t.page.waitForSelector(".nn-fps");
  } finally { await t.close(); }
});

test("profiles can be switched from the settings panel", async () => {
  const t = await open({ pages: {} });
  try {
    await t.page.click(".nn-gear");
    await t.page.click('[data-prof="verdict"]');
    assert.equal(await t.page.locator(".nn-compact").count(), 1);
  } finally { await t.close(); }
});

test("hotkeys: Alt+Shift+C collapses/expands, Alt+Shift+P cycles profiles", async () => {
  const t = await open({ pages: {} });
  try {
    await t.page.keyboard.press("Alt+Shift+KeyC");
    assert.equal(await t.page.locator(".nn-compact").count(), 1);
    await t.page.keyboard.press("Alt+Shift+KeyC");
    assert.equal(await t.page.locator(".nn-compact").count(), 0);
    await t.page.keyboard.press("Alt+Shift+KeyP");           // neon -> minimal
    assert.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem("nnPcInfoSettings")).profile), "minimal");
    await t.page.keyboard.press("Alt+Shift+KeyP");           // -> verdict
    assert.equal(await t.page.locator(".nn-compact").count(), 1);
  } finally { await t.close(); }
});

test("hotkeys are ignored while typing in a field", async () => {
  const t = await open({ pages: {} });
  try {
    await t.page.click(".nn-gear");
    await t.page.focus('input[data-k="title"]');
    await t.page.keyboard.press("Alt+Shift+KeyC");
    assert.equal(await t.page.locator(".nn-compact").count(), 0);
  } finally { await t.close(); }
});

test("export: the block becomes a real PNG", async () => {
  const t = await open({ pages: { "checkfps.io": CHECKFPS } });
  try {
    await t.page.waitForSelector(".nn-fps table");
    const head = await t.page.evaluate(async () => {
      const b = await window.__pcInfo.exportPng();
      if (!b) return null;
      const u = new Uint8Array(await b.arrayBuffer());
      return { size: b.size, magic: Array.from(u.slice(0, 4)) };
    });
    assert.ok(head, "exportPng returned null");
    assert.deepEqual(head.magic, [0x89, 0x50, 0x4e, 0x47]);
    assert.ok(head.size > 3000);
  } finally { await t.close(); }
});

test("settings are saved: reset restores the defaults", async () => {
  const t = await open({ pages: {}, settings: { title: "My PC" } });
  try {
    assert.match(await text(t.page, ".nn-pc h3"), /My PC/);
    await t.page.click(".nn-gear");
    await t.page.click('[data-pact="reset"]');
    assert.doesNotMatch(await text(t.page, ".nn-pc h3"), /My PC/);
  } finally { await t.close(); }
});
