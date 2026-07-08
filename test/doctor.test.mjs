/**
 * Tests for the `dotme doctor` diagnostics. The pure extraction helpers are
 * tested directly (cross-platform, no filesystem coupling); the command itself
 * is smoke-tested as a subprocess with DOTME_DIR pointing at a seeded ~/.me to
 * prove it never leaks file *contents* — only names and booleans.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import {
  extractDotmeEntry,
  isEphemeralInstall,
  serverPathFromArgs,
} from "../dist/cli/connect.js";

const CLI = fileURLToPath(new URL("../dist/cli/index.js", import.meta.url));

test("serverPathFromArgs picks the .js entry", () => {
  assert.equal(serverPathFromArgs(["/x/dist/server/index.js"]), "/x/dist/server/index.js");
  assert.equal(serverPathFromArgs(["-y", "dotme-ai", "/x/index.js"]), "/x/index.js");
  assert.equal(serverPathFromArgs(["last-arg"]), "last-arg");
  assert.equal(serverPathFromArgs("not-an-array"), null);
});

test("isEphemeralInstall flags npx cache paths only (any separator)", () => {
  // POSIX-style npx cache path
  assert.equal(isEphemeralInstall("/Users/x/.npm/_npx/abc/node_modules/dotme-ai/dist/server/index.js"), true);
  // Windows-style npx cache path (backslashes) — must also be detected
  assert.equal(isEphemeralInstall("C:\\Users\\x\\AppData\\Roaming\\npm-cache\\_npx\\abc\\node_modules\\dotme-ai\\dist\\server\\index.js"), true);
  // stable installs — never flagged
  assert.equal(isEphemeralInstall("/opt/homebrew/lib/node_modules/dotme-ai/dist/server/index.js"), false);
  assert.equal(isEphemeralInstall("C:\\Program Files\\nodejs\\node_modules\\dotme-ai\\dist\\server\\index.js"), false);
  assert.equal(isEphemeralInstall("/Users/x/dev/dotme/dist/server/index.js"), false);
});

test("extractDotmeEntry reads a plain mcpServers JSON config", () => {
  const raw = JSON.stringify({
    mcpServers: { other: { command: "x" }, dotme: { command: "node", args: ["/p/index.js"] } },
  });
  assert.deepEqual(extractDotmeEntry(raw, "json", ["mcpServers"]), {
    hasDotme: true,
    serverPath: "/p/index.js",
  });
});

test("extractDotmeEntry reads a nested key (OpenClaw mcp.servers)", () => {
  const raw = JSON.stringify({ mcp: { servers: { dotme: { command: "node", args: ["/p/s.js"] } } } });
  assert.deepEqual(extractDotmeEntry(raw, "json", ["mcp", "servers"]), {
    hasDotme: true,
    serverPath: "/p/s.js",
  });
});

test("extractDotmeEntry deep-searches Claude Code config", () => {
  const raw = JSON.stringify({
    projects: { "/some/dir": { mcpServers: { dotme: { command: "node", args: ["/deep/index.js"] } } } },
  });
  assert.deepEqual(extractDotmeEntry(raw, "deep-json", []), {
    hasDotme: true,
    serverPath: "/deep/index.js",
  });
});

test("extractDotmeEntry parses a Codex TOML table", () => {
  const raw = `model = "gpt-5"\n\n[mcp_servers.dotme]\ncommand = "node"\nargs = ["/toml/index.js"]\n`;
  assert.deepEqual(extractDotmeEntry(raw, "toml", []), {
    hasDotme: true,
    serverPath: "/toml/index.js",
  });
});

test("extractDotmeEntry reports absence cleanly", () => {
  assert.deepEqual(extractDotmeEntry(JSON.stringify({ mcpServers: { other: {} } }), "json", ["mcpServers"]), {
    hasDotme: false,
    serverPath: null,
  });
  assert.deepEqual(extractDotmeEntry("not json", "json", ["mcpServers"]), {
    hasDotme: false,
    serverPath: null,
  });
});

// --- integration: doctor never leaks file contents ---

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dotme-doctor-"));

before(() => {
  for (const f of ["profile.md", "projects.md", "stack.md", "preferences.md", "memory.md", "private.md"]) {
    fs.writeFileSync(path.join(tmp, f), `# ${f}\n\nSUPERSECRET_${f}_CONTENT\n`);
  }
  fs.writeFileSync(
    path.join(tmp, "manifest.json"),
    JSON.stringify({ version: 1, created: "x", permissions: { "profile.md": true, "private.md": false } }),
  );
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("doctor runs, shows structure, and leaks no file contents", () => {
  const out = execFileSync(process.execPath, [CLI, "doctor"], {
    env: { ...process.env, DOTME_DIR: tmp },
    encoding: "utf-8",
  });
  assert.ok(out.includes("dotme doctor"), "has header");
  assert.ok(/manifest\s+valid/.test(out), "reports manifest validity");
  assert.ok(out.includes("profile"), "lists section names");
  assert.ok(out.includes("Paste this into your bug report"), "has footer");
  assert.ok(!out.includes("SUPERSECRET"), "MUST NOT leak any file contents");
});
