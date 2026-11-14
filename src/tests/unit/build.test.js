// Checks of the build output: the committed webkit.js must match the sources and stay ASCII-only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const os = require("os");

const root = path.resolve(__dirname, "../../..");
const built = fs.readFileSync(path.join(root, ".millennium/Dist/webkit.js"), "utf8");

test("webkit.js is ASCII-only", () => {
  assert.ok(!/[^\x00-\x7e\r\n\t]/.test(built));
});

test("webkit.js is syntactically valid JavaScript", () => {
  assert.doesNotThrow(() => new Function(built));
});

test("webkit.js still has the placeholder for the detected data", () => {
  assert.ok(built.includes("/*__DATA__*/null"));
});

test("webkit.js is up to date with src/ (run: python3 src/build.py .millennium/Dist/webkit.js)", () => {
  const out = path.join(os.tmpdir(), "pcinfo-webkit-check.js");
  cp.execFileSync("python3", [path.join(root, "src/build.py"), out], { cwd: root });
  assert.equal(fs.readFileSync(out, "utf8"), built);
});

test("PowerShell helper is ASCII-only (Windows PowerShell 5.1)", () => {
  const ps = fs.readFileSync(path.join(root, "backend/pc-info.ps1"), "utf8");
  assert.ok(!/[^\x00-\x7f]/.test(ps));
});

test("plugin.json and package.json agree on the version", () => {
  const a = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
  const b = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(a.version, b.version);
});

test("Lua backend only allows the known sites", () => {
  const lua = fs.readFileSync(path.join(root, "backend/main.lua"), "utf8");
  const hosts = [...lua.matchAll(/\["([a-z.]+)"\] = true/g)].map((m) => m[1]);
  const allowed = ["fpsbench.com", "chipversus.com", "checkfps.io", "pcgamingwiki.com"];
  hosts.forEach((h) => assert.ok(allowed.some((a) => h === a || h === "www." + a), h));
});
