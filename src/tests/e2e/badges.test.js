// Browser tests for the badges in store lists (search results, capsules, wishlist).
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, listPage, LIST_URL } = require("./helpers");

const li = (label, v) => `<li><strong>${label}:</strong> ${v}<br></li>`;
const reqs = (cpu, ram, gpu) => ({ minimum: "<strong>Minimum:</strong><br><ul class=\"bb_ul\">" + li("Processor", cpu) + li("Memory", ram) + li("Graphics", gpu) + "</ul>" });
const DETAILS = {
  111: reqs("Intel Core i5-6400", "8 GB RAM", "NVIDIA GeForce GTX 660"),
  222: reqs("Intel Core i9-13900K", "64 GB RAM", "NVIDIA GeForce RTX 4090"),
};

test("badges: green for an easy game, red for a demanding one, with a tooltip", async () => {
  const t = await open({ url: LIST_URL, html: listPage(), details: DETAILS, waitFor: ".search_result_row" });
  try {
    await t.page.waitForSelector('a[data-nn-b="111"] .nn-badge', { timeout: 8000 });
    await t.page.waitForSelector('a[data-nn-b="222"] .nn-badge', { timeout: 8000 });
    assert.equal(await t.page.locator('a[data-nn-b="111"] .nn-badge').getAttribute("class").then((c) => /nn-b-ok/.test(c)), true);
    assert.equal(await t.page.locator('a[data-nn-b="222"] .nn-badge').getAttribute("class").then((c) => /nn-b-bad/.test(c)), true);
    assert.match(await t.page.locator('a[data-nn-b="222"] .nn-badge').getAttribute("title"), /./);
    assert.deepEqual(t.errors, []);
  } finally { await t.close(); }
});

test("badges: can be turned off in the settings", async () => {
  const t = await open({ url: LIST_URL, html: listPage(), details: DETAILS, settings: { badges: false }, waitFor: ".search_result_row" });
  try {
    await t.page.waitForTimeout(2500);
    assert.equal(await t.page.locator(".nn-badge").count(), 0);
  } finally { await t.close(); }
});

test("badges: a game without requirements gets no badge", async () => {
  const t = await open({ url: LIST_URL, html: listPage(), details: { 111: DETAILS[111] }, waitFor: ".search_result_row" });
  try {
    await t.page.waitForSelector('a[data-nn-b="111"] .nn-badge', { timeout: 8000 });
    await t.page.waitForTimeout(2500);
    assert.equal(await t.page.locator('a[data-nn-b="222"] .nn-badge').count(), 0);
  } finally { await t.close(); }
});
