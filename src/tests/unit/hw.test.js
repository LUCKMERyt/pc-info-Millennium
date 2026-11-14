// Unit tests for the hardware table / scoring module (pure logic, no browser).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HW = vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../pcinfo-hw.js"), "utf8") + ";HW");
const g = HW.gpuScore, c = HW.cpuScore;

test("GPU scores are ordered sensibly", () => {
  assert.ok(g("NVIDIA GeForce RTX 4090") > g("NVIDIA GeForce RTX 3060"));
  assert.ok(g("NVIDIA GeForce RTX 3060") > g("GTX 1060"));
  assert.ok(g("GTX 660") < g("GTX 1060"));
});

test("CPU scores are ordered sensibly", () => {
  assert.ok(c("AMD Ryzen 7 5700X 8-Core Processor (8C/16T)") > c("Intel Core i5-6400"));
  assert.ok(c("Intel Core i7-12700") > c("Intel Core i5-6400"));
});

test("laptop variants are slower than desktop parts", () => {
  assert.ok(g("NVIDIA GeForce RTX 3060 Laptop GPU") < g("NVIDIA GeForce RTX 3060"));
  assert.ok(c("Intel Core i7-12700H") < c("Intel Core i7-12700"));
});

test("unknown hardware returns null, not a guess", () => {
  assert.equal(g("Totally Unknown Card 9000"), null);
});

test("requirement alternatives are split on 'or'", () => {
  const a = HW.alts("Intel Core i5-6400 or AMD Ryzen 3 1200 or similar");
  assert.ok(a.includes("Intel Core i5-6400"));
  assert.ok(a.includes("AMD Ryzen 3 1200"));
});

test("reqMin takes the weakest sensible alternative and drops absurd outliers", () => {
  const alts = HW.alts("NVIDIA GeForce GTX 660 or AMD Radeon RX 460 or Intel HD 630");
  const m = HW.reqMin(alts, g);
  assert.equal(m, g("GTX 660"));          // not the integrated Intel HD 630
});

test("rate(): ok / mid / bad thresholds", () => {
  assert.equal(HW.rate(100, 100).cls, "ok");
  assert.equal(HW.rate(90, 100).cls, "mid");
  assert.equal(HW.rate(50, 100).cls, "bad");
  assert.equal(HW.rate(1, null), null);
});

test("model names are cleaned for the FPS sites", () => {
  assert.equal(HW.cpuModel("AMD Ryzen 7 5700X 8-Core Processor (8C/16T)"), "AMD Ryzen 7 5700X");
  assert.equal(HW.gpuModel("NVIDIA GeForce RTX 5060 8 GB"), "NVIDIA GeForce RTX 5060");
});
