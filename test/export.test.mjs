/**
 * Tests for `exportContext` — the no-MCP paste/clipboard escape hatch. The
 * critical property is the same as the server's: private.md is never included,
 * by any path or flag.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dotme-export-"));
process.env.DOTME_DIR = tmp;
const me = await import("../dist/core/me.js");

before(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of me.SECTION_FILES) {
    fs.writeFileSync(path.join(tmp, f), `# ${f}\n\nSECRET_${f}_MARKER value here\n`);
  }
  me.saveManifest({
    version: 1,
    created: new Date().toISOString(),
    permissions: me.defaultPermissions(),
  });
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("export includes the ground-truth preamble", () => {
  const { text } = me.exportContext();
  assert.ok(text.startsWith(me.EXPORT_PREAMBLE));
});

test("export includes exposed sections but never private.md", () => {
  const { text, files } = me.exportContext();
  assert.ok(text.includes("SECRET_profile.md_MARKER"));
  assert.ok(!text.includes("SECRET_private.md_MARKER"), "private.md must never appear");
  assert.ok(!files.includes("private.md"));
});

test("explicitly requesting private is refused, not leaked", () => {
  const { text, files, excluded } = me.exportContext(["private"]);
  assert.ok(!text.includes("SECRET_private.md_MARKER"));
  assert.equal(files.length, 0);
  assert.deepEqual(excluded, ["private.md"]);
});

test("a subset of sections filters correctly", () => {
  const { text, files } = me.exportContext(["profile", "stack"]);
  assert.deepEqual(files, ["profile.md", "stack.md"]);
  assert.ok(text.includes("SECRET_profile.md_MARKER"));
  assert.ok(text.includes("SECRET_stack.md_MARKER"));
  assert.ok(!text.includes("SECRET_projects.md_MARKER"));
});

test("unknown section names are reported, not fatal", () => {
  const { unknown, files } = me.exportContext(["profile", "nope"]);
  assert.deepEqual(unknown, ["nope"]);
  assert.deepEqual(files, ["profile.md"]);
});

test("--compact strips markdown headers and blank lines", () => {
  const { text } = me.exportContext(["profile"], true);
  const body = text.slice(me.EXPORT_PREAMBLE.length);
  assert.ok(!/^#{1,6}\s/m.test(body), "no header lines remain");
  assert.ok(!/\n\s*\n/.test(body.trim()), "no blank lines remain");
  assert.ok(text.includes("SECRET_profile.md_MARKER"));
});

test("even a manifest that flips private on is honored by export", () => {
  // The documented opt-in: export is not a privacy backdoor, it mirrors the
  // manifest exactly — so if the user exposes private, export shows it.
  me.saveManifest({
    version: 1,
    created: new Date().toISOString(),
    permissions: { ...me.defaultPermissions(), "private.md": true },
  });
  const { text } = me.exportContext();
  assert.ok(text.includes("SECRET_private.md_MARKER"));
  // restore default for any later tests
  me.saveManifest({
    version: 1,
    created: new Date().toISOString(),
    permissions: me.defaultPermissions(),
  });
});
