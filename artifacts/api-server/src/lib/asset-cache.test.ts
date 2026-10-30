import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { retainAppAssets } from "./asset-cache";
test("hashed app assets survive upgrades without overwriting existing releases", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gahez-assets-"));
  try {
    const release = path.join(root, "release"), cache = path.join(root, "cache"); mkdirSync(release);
    writeFileSync(path.join(release, "old-hash.js"), "old"); retainAppAssets(release, cache);
    writeFileSync(path.join(release, "old-hash.js"), "unexpected-overwrite"); writeFileSync(path.join(release, "new-hash.js"), "new"); mkdirSync(path.join(release, "nested"));
    retainAppAssets(release, cache);
    assert.equal(readFileSync(path.join(cache, "old-hash.js"), "utf8"), "old"); assert.equal(readFileSync(path.join(cache, "new-hash.js"), "utf8"), "new"); assert.equal(existsSync(path.join(cache, "nested")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
