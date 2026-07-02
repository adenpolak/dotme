/**
 * `dotme connect <tool>` — write MCP config for Claude Desktop, Claude Code,
 * and Cursor. Existing config files are always backed up first.
 *
 * Config methods (verified against official docs, July 2026):
 *  - Claude Desktop (macOS): ~/Library/Application Support/Claude/claude_desktop_config.json,
 *    servers under the "mcpServers" key.
 *  - Claude Code: `claude mcp add --scope user dotme -- <command>`.
 *  - Cursor (global): ~/.cursor/mcp.json, "mcpServers" key with "type": "stdio".
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { bold, dim, info, ok, warn } from "./ui.js";

export const TOOLS = ["claude-desktop", "claude-code", "cursor"] as const;
export type Tool = (typeof TOOLS)[number];

/**
 * The stdio command clients should run. We point at the built server entry
 * inside this installed package with the current node binary — works for
 * local checkouts and global installs alike.
 */
function serverCommand(): { command: string; args: string[] } {
  const serverPath = fileURLToPath(new URL("../server/index.js", import.meta.url));
  // process.execPath on Homebrew resolves into a versioned Cellar directory
  // that dies on the next `brew upgrade node`; prefer the stable symlink.
  let command = process.execPath;
  if (command.includes("/Cellar/node")) {
    for (const stable of ["/opt/homebrew/bin/node", "/usr/local/bin/node"]) {
      if (fs.existsSync(stable)) {
        command = stable;
        break;
      }
    }
  }
  return { command, args: [serverPath] };
}

/** Back up a config file next to itself; returns the backup path. */
function backup(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = `${file}.backup-${stamp}`;
  fs.copyFileSync(file, backupPath);
  return backupPath;
}

/** Merge our server entry into an mcpServers-style JSON config file. */
function mergeJsonConfig(
  file: string,
  entry: Record<string, unknown>,
  label: string,
): void {
  let config: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      warn(`${label}: existing config at ${file} is not valid JSON — refusing to touch it.`);
      process.exitCode = 1;
      return;
    }
    const backupPath = backup(file);
    info(`${label}: backed up existing config to ${dim(backupPath!)}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  servers.dotme = entry;
  config.mcpServers = servers;
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  ok(`${label}: added "dotme" to ${bold(file)}`);
}

function connectClaudeDesktop(): void {
  if (process.platform !== "darwin") {
    warn(
      "Claude Desktop auto-connect currently supports macOS only. Add dotme to claude_desktop_config.json manually — see the README.",
    );
    return;
  }
  const file = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json",
  );
  const { command, args } = serverCommand();
  mergeJsonConfig(file, { command, args }, "Claude Desktop");
  info("Claude Desktop: restart the app to pick up the new server.");
}

function connectCursor(): void {
  const file = path.join(os.homedir(), ".cursor", "mcp.json");
  const { command, args } = serverCommand();
  mergeJsonConfig(file, { type: "stdio", command, args }, "Cursor");
}

function connectClaudeCode(): void {
  const { command, args } = serverCommand();
  const addArgs = ["mcp", "add", "--scope", "user", "dotme", "--", command, ...args];
  const manual = `claude ${addArgs.join(" ")}`;
  try {
    execFileSync("claude", addArgs, { stdio: "pipe" });
    ok('Claude Code: added "dotme" (user scope — available in every project).');
  } catch (err) {
    const stderr = String((err as { stderr?: Buffer }).stderr ?? "");
    if (stderr.includes("already exists")) {
      // Refresh our own entry so a moved install still points at the right path.
      try {
        execFileSync("claude", ["mcp", "remove", "--scope", "user", "dotme"], { stdio: "pipe" });
        execFileSync("claude", addArgs, { stdio: "pipe" });
        ok('Claude Code: refreshed existing "dotme" entry (user scope).');
        return;
      } catch {
        /* fall through to manual instructions */
      }
    }
    warn("Claude Code: couldn't run the `claude` CLI. Add it manually with:");
    console.log(`  ${manual}`);
  }
}

export function connect(args: string[]): void {
  const target = args[0];
  if (!target || (target !== "all" && !TOOLS.includes(target as Tool))) {
    warn(`Usage: dotme connect <${TOOLS.join(" | ")} | all>`);
    process.exitCode = 1;
    return;
  }
  const targets: Tool[] = target === "all" ? [...TOOLS] : [target as Tool];
  for (const t of targets) {
    if (t === "claude-desktop") connectClaudeDesktop();
    if (t === "claude-code") connectClaudeCode();
    if (t === "cursor") connectCursor();
  }
}
