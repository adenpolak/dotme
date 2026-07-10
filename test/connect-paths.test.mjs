/**
 * Per-OS config path resolution for the GUI tools whose locations differ by
 * platform. We fake `process.platform` to exercise every branch on any host;
 * CI on windows-latest / ubuntu-latest / macos-latest then confirms the real
 * separators and env vars. Paths verified against each tool's official docs
 * (2026): Claude Desktop and Zed use %APPDATA% on Windows; Claude Desktop has
 * no Linux build; VS Code uses ~/.config on Linux.
 *
 * Assertions compare against path.join() of the same parts so they're
 * separator-agnostic — they pass identically on Windows and POSIX hosts.
 */

import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";
import {
  claudeDesktopConfig,
  clineConfig,
  rooConfig,
  vscodeConfig,
  vscodeUserDir,
  zedConfig,
} from "../dist/cli/connect.js";

const realPlatform = process.platform;
const realAppData = process.env.APPDATA;

function withPlatform(platform, appData, fn) {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  if (appData !== undefined) process.env.APPDATA = appData;
  try {
    fn();
  } finally {
    Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
    if (realAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = realAppData;
  }
}

after(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

const H = os.homedir();

test("macOS paths use ~/Library/Application Support", () => {
  withPlatform("darwin", undefined, () => {
    assert.equal(
      claudeDesktopConfig(),
      path.join(H, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    );
    assert.equal(
      vscodeConfig(),
      path.join(H, "Library", "Application Support", "Code", "User", "mcp.json"),
    );
    assert.equal(zedConfig(), path.join(H, ".config", "zed", "settings.json"));
  });
});

test("Windows paths use %APPDATA%", () => {
  const appData = path.join(H, "AppData", "Roaming");
  withPlatform("win32", appData, () => {
    assert.equal(
      claudeDesktopConfig(),
      path.join(appData, "Claude", "claude_desktop_config.json"),
    );
    assert.equal(vscodeConfig(), path.join(appData, "Code", "User", "mcp.json"));
    assert.equal(zedConfig(), path.join(appData, "Zed", "settings.json"));
  });
});

test("Linux: VS Code + Zed under ~/.config; Claude Desktop unavailable", () => {
  withPlatform("linux", undefined, () => {
    assert.equal(claudeDesktopConfig(), null, "Claude Desktop has no Linux build");
    assert.equal(vscodeConfig(), path.join(H, ".config", "Code", "User", "mcp.json"));
    assert.equal(zedConfig(), path.join(H, ".config", "zed", "settings.json"));
  });
});

test("Cline + Roo live under VS Code globalStorage on every OS", () => {
  const cline = (base) =>
    path.join(base, "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
  const roo = (base) =>
    path.join(base, "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");

  withPlatform("darwin", undefined, () => {
    assert.equal(clineConfig(), cline(vscodeUserDir()));
    assert.equal(rooConfig(), roo(vscodeUserDir()));
    assert.ok(vscodeUserDir().endsWith(path.join("Code", "User")));
  });
  withPlatform("win32", path.join(H, "AppData", "Roaming"), () => {
    assert.equal(clineConfig(), cline(vscodeUserDir()));
    assert.equal(rooConfig(), roo(vscodeUserDir()));
    assert.ok(vscodeUserDir().startsWith(path.join(H, "AppData", "Roaming")));
  });
  withPlatform("linux", undefined, () => {
    assert.equal(clineConfig(), cline(vscodeUserDir()));
    assert.equal(rooConfig(), roo(vscodeUserDir()));
    assert.equal(vscodeUserDir(), path.join(H, ".config", "Code", "User"));
  });
});
