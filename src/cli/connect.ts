/**
 * `dotme connect <tool>` — write MCP config for every supported AI tool.
 * Existing config files are always backed up first, and other servers in a
 * config are never touched (merge, don't overwrite).
 *
 * Config methods (verified against official docs, July 2026):
 *  - Claude Desktop (macOS): ~/Library/Application Support/Claude/claude_desktop_config.json,
 *    servers under the "mcpServers" key.
 *  - Claude Code: `claude mcp add --scope user dotme -- <command>`.
 *  - Cursor (global): ~/.cursor/mcp.json, "mcpServers" key with "type": "stdio".
 *  - Windsurf: ~/.codeium/windsurf/mcp_config.json, "mcpServers" key.
 *  - Zed: ~/.config/zed/settings.json, "context_servers" key with "source": "custom".
 *    Zed settings allow JSONC comments; if we can't parse the file as strict
 *    JSON we print a paste-ready snippet instead of destroying comments.
 *  - VS Code (Copilot): ~/Library/Application Support/Code/User/mcp.json
 *    (Linux: ~/.config/Code/User/mcp.json), "servers" key with "type": "stdio".
 *  - Codex CLI: `codex mcp add dotme -- <command>`, falling back to
 *    [mcp_servers.dotme] in ~/.codex/config.toml.
 *  - Gemini CLI: ~/.gemini/settings.json, "mcpServers" key.
 *  - OpenClaw: `openclaw mcp add`, falling back to ~/.openclaw/openclaw.json,
 *    servers under the nested "mcp" → "servers" key.
 *  - ChatGPT Desktop: NOT supported — its developer-mode connectors only
 *    accept remote MCP servers (SSE / streaming HTTP), never local stdio.
 *    `dotme connect chatgpt` explains this instead of faking an integration.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { bold, dim, info, ok, warn } from "./ui.js";

export const TOOLS = [
  "claude-desktop",
  "claude-code",
  "cursor",
  "windsurf",
  "zed",
  "vscode",
  "codex",
  "gemini",
  "openclaw",
] as const;
export type Tool = (typeof TOOLS)[number];

/** True if a path lives inside npx's throwaway package cache. */
function isEphemeralInstall(p: string): boolean {
  return p.includes(`${path.sep}_npx${path.sep}`);
}

/** Path to a globally-installed dotme-ai server entry, if one exists. */
function globalServerPath(): string | null {
  try {
    const root = execFileSync("npm", ["root", "-g"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!root) return null;
    const candidate = path.join(root, "dotme-ai", "dist", "server", "index.js");
    return fs.existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the server entry to write into client configs, preferring a location
 * that will still exist tomorrow. Running via `npx dotme-ai connect` lands us
 * in an `_npx` cache dir that npm garbage-collects — baking that path into a
 * client config is a silent time bomb. So if we're ephemeral, we fall back to a
 * durable global install when one is present, and otherwise flag it so the
 * caller can warn.
 */
function resolveServerPath(): { path: string; ephemeral: boolean } {
  const local = fileURLToPath(new URL("../server/index.js", import.meta.url));
  if (!isEphemeralInstall(local)) return { path: local, ephemeral: false };
  const global = globalServerPath();
  if (global) return { path: global, ephemeral: false };
  return { path: local, ephemeral: true };
}

/**
 * The stdio command clients should run. We point at the built server entry
 * with the current node binary — works for local checkouts and global installs
 * alike, and avoids ephemeral npx paths where possible (see resolveServerPath).
 */
function serverCommand(): { command: string; args: string[] } {
  const { path: serverPath } = resolveServerPath();
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

/**
 * Warn once, up front, if we're about to write configs that point at an
 * ephemeral npx cache. Everything still works today; this tells the user how to
 * make it permanent before npm cleans the cache out from under them.
 */
function warnIfEphemeral(): void {
  if (resolveServerPath().ephemeral) {
    warn(
      "You're running dotme via npx, so this points clients at a temporary cache " +
        "that npm may later delete. It works now, but for a durable setup run:",
    );
    console.log(`  ${bold("npm install -g dotme-ai")}  &&  ${bold("dotme connect all")}`);
    console.log();
  }
}

/** Back up a config file next to itself; returns the backup path. */
function backup(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = `${file}.backup-${stamp}`;
  fs.copyFileSync(file, backupPath);
  return backupPath;
}

function home(...segments: string[]): string {
  return path.join(os.homedir(), ...segments);
}

/** Windows %APPDATA% (Roaming), with a sane fallback. */
function winAppData(): string {
  return process.env.APPDATA ?? home("AppData", "Roaming");
}

/* ------------------------------------------------------------------ */
/* Per-OS config locations (verified against each tool's docs, 2026)    */
/*                                                                      */
/* CLI tools (Claude Code, Codex, Gemini, OpenClaw) and the editors     */
/* that key off the home dir (Cursor ~/.cursor, Windsurf ~/.codeium)    */
/* are already cross-platform via os.homedir(). Only the GUI apps that  */
/* use an OS-specific application-data directory need per-OS handling.   */
/* ------------------------------------------------------------------ */

/** Claude Desktop config path, or null on Linux (no Linux build exists). */
export function claudeDesktopConfig(): string | null {
  if (process.platform === "darwin") {
    return home("Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    return path.join(winAppData(), "Claude", "claude_desktop_config.json");
  }
  return null;
}

/** VS Code user-level MCP config path (mcp.json) for the current OS. */
export function vscodeConfig(): string {
  if (process.platform === "darwin") {
    return home("Library", "Application Support", "Code", "User", "mcp.json");
  }
  if (process.platform === "win32") {
    return path.join(winAppData(), "Code", "User", "mcp.json");
  }
  return home(".config", "Code", "User", "mcp.json");
}

/** Zed settings.json path for the current OS (mac/Linux use ~/.config/zed). */
export function zedConfig(): string {
  if (process.platform === "win32") {
    return path.join(winAppData(), "Zed", "settings.json");
  }
  return home(".config", "zed", "settings.json");
}

/** True if `bin` is executable somewhere on PATH. */
function commandExists(bin: string): boolean {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      try {
        fs.accessSync(path.join(dir, bin + ext), fs.constants.X_OK);
        return true;
      } catch {
        /* keep looking */
      }
    }
  }
  return false;
}

/** Print the entry a user should paste when we refuse to rewrite a file. */
function printPasteSnippet(rootKeys: string[], entry: Record<string, unknown>): void {
  let obj: Record<string, unknown> = { dotme: entry };
  for (const key of [...rootKeys].reverse()) obj = { [key]: obj };
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * Merge our server entry into a JSON config file under a (possibly nested)
 * root key, e.g. ["mcpServers"] or ["mcp", "servers"]. Anything else in the
 * file is preserved. If the file exists but isn't strict JSON we refuse to
 * touch it and print a paste-ready snippet instead.
 */
function mergeJsonConfig(
  file: string,
  rootKeys: string[],
  entry: Record<string, unknown>,
  label: string,
): boolean {
  let config: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      warn(
        `${label}: existing config at ${file} isn't strict JSON (comments?) — refusing to rewrite it. Paste this in yourself:`,
      );
      printPasteSnippet(rootKeys, entry);
      return false;
    }
    const backupPath = backup(file);
    info(`${label}: backed up existing config to ${dim(backupPath!)}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  let node = config;
  for (const key of rootKeys) {
    const next = node[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node.dotme = entry;
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  ok(`${label}: added "dotme" to ${bold(file)}`);
  return true;
}

/* ------------------------------------------------------------------ */
/* Per-tool connectors                                                  */
/* ------------------------------------------------------------------ */

function connectClaudeDesktop(): void {
  const file = claudeDesktopConfig();
  if (!file) {
    warn(
      "Claude Desktop isn't available on Linux (it ships for macOS and Windows only). " +
        "Use Claude Code, or `dotme connect manual` for another client.",
    );
    return;
  }
  const { command, args } = serverCommand();
  if (mergeJsonConfig(file, ["mcpServers"], { command, args }, "Claude Desktop")) {
    info("Claude Desktop: restart the app to pick up the new server.");
  }
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

function connectCursor(): void {
  const { command, args } = serverCommand();
  mergeJsonConfig(home(".cursor", "mcp.json"), ["mcpServers"], { type: "stdio", command, args }, "Cursor");
}

function connectWindsurf(): void {
  const file = home(".codeium", "windsurf", "mcp_config.json");
  const { command, args } = serverCommand();
  if (mergeJsonConfig(file, ["mcpServers"], { command, args }, "Windsurf")) {
    info("Windsurf: refresh the plugins list in Cascade (or restart Windsurf) to pick it up.");
  }
}

function connectZed(): void {
  const file = zedConfig();
  const { command, args } = serverCommand();
  const entry = { source: "custom", command, args, env: {} };
  if (mergeJsonConfig(file, ["context_servers"], entry, "Zed")) {
    info("Zed: reloads context servers on save — no restart needed.");
  }
}

function connectVSCode(): void {
  const file = vscodeConfig();
  const { command, args } = serverCommand();
  if (mergeJsonConfig(file, ["servers"], { type: "stdio", command, args }, "VS Code")) {
    info('VS Code: run "MCP: List Servers" and start dotme, or just reload the window.');
  }
}

function connectCodex(): void {
  const { command, args } = serverCommand();
  const file = home(".codex", "config.toml");
  if (commandExists("codex")) {
    const addArgs = ["mcp", "add", "dotme", "--", command, ...args];
    try {
      execFileSync("codex", addArgs, { stdio: "pipe" });
      ok(`Codex CLI: added "dotme" to ${bold(file)}.`);
      return;
    } catch {
      try {
        execFileSync("codex", ["mcp", "remove", "dotme"], { stdio: "pipe" });
        execFileSync("codex", addArgs, { stdio: "pipe" });
        ok('Codex CLI: refreshed existing "dotme" entry.');
        return;
      } catch {
        /* fall through to writing the TOML ourselves */
      }
    }
  }
  // No usable `codex` CLI — edit config.toml directly. TOML tables can be
  // appended, but a duplicate [mcp_servers.dotme] would be invalid, so strip
  // any previous dotme section (and its subtables) first.
  const section = `[mcp_servers.dotme]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`;
  let existing = "";
  if (fs.existsSync(file)) {
    existing = fs.readFileSync(file, "utf-8");
    const backupPath = backup(file);
    info(`Codex CLI: backed up existing config to ${dim(backupPath!)}`);
    // Drop any previous [mcp_servers.dotme] table (and subtables) line by
    // line: a skip starts at its header and ends at the next table header.
    const kept: string[] = [];
    let skipping = false;
    for (const line of existing.split("\n")) {
      const header = line.match(/^\s*\[\s*([A-Za-z0-9_."'-]+)\s*\]/);
      if (header) {
        const name = header[1].trim();
        skipping = name === "mcp_servers.dotme" || name.startsWith("mcp_servers.dotme.");
      }
      if (!skipping) kept.push(line);
    }
    existing = kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
    if (existing.length > 0) existing += "\n\n";
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  fs.writeFileSync(file, existing + section);
  ok(`Codex CLI: added "dotme" to ${bold(file)}.`);
}

function connectGemini(): void {
  const file = home(".gemini", "settings.json");
  const { command, args } = serverCommand();
  if (mergeJsonConfig(file, ["mcpServers"], { command, args }, "Gemini CLI")) {
    info("Gemini CLI: takes effect on the next run (`/mcp` lists connected servers).");
  }
}

function connectOpenClaw(): void {
  const { command, args } = serverCommand();
  const file = home(".openclaw", "openclaw.json");
  if (commandExists("openclaw")) {
    const addArgs = ["mcp", "add", "dotme", "--command", command];
    for (const a of args) addArgs.push("--arg", a);
    try {
      execFileSync("openclaw", addArgs, { stdio: "pipe" });
      ok('OpenClaw: added "dotme" via the openclaw CLI.');
      info("OpenClaw: run `openclaw mcp reload` (or restart the gateway) to pick it up.");
      return;
    } catch {
      /* fall through to editing openclaw.json directly */
    }
  }
  if (mergeJsonConfig(file, ["mcp", "servers"], { command, args }, "OpenClaw")) {
    info("OpenClaw: restart the gateway (or `openclaw mcp reload`) to pick it up.");
  }
}

/** ChatGPT gets an honest explanation, not a fake integration. */
function explainChatGPT(): void {
  warn("ChatGPT can't connect to dotme directly.");
  console.log(
    `  ChatGPT's developer-mode MCP connectors only accept ${bold("remote")} servers\n` +
      "  (SSE / streaming HTTP over HTTPS) — it cannot launch local stdio servers.\n" +
      "  dotme is local-only by design (zero network code), so there is nothing\n" +
      "  honest to configure here. Your options:\n" +
      `    · paste context in manually — ${bold("dotme show profile")} is made for it\n` +
      "    · bridge dotme yourself with a tool like mcp-remote plus a tunnel\n" +
      "      (this puts your context on the network — read the security notes first)",
  );
}

/* ------------------------------------------------------------------ */
/* Registry, detection, `all`, and `manual`                             */
/* ------------------------------------------------------------------ */

interface ToolDef {
  label: string;
  detect: () => boolean;
  connect: () => void;
}

const REGISTRY: Record<Tool, ToolDef> = {
  "claude-desktop": {
    label: "Claude Desktop",
    detect: () => {
      const cfg = claudeDesktopConfig();
      return (
        (cfg !== null && fs.existsSync(path.dirname(cfg))) ||
        fs.existsSync("/Applications/Claude.app")
      );
    },
    connect: connectClaudeDesktop,
  },
  "claude-code": {
    label: "Claude Code",
    detect: () => commandExists("claude"),
    connect: connectClaudeCode,
  },
  cursor: {
    label: "Cursor",
    detect: () => fs.existsSync(home(".cursor")) || fs.existsSync("/Applications/Cursor.app"),
    connect: connectCursor,
  },
  windsurf: {
    label: "Windsurf",
    detect: () =>
      fs.existsSync(home(".codeium", "windsurf")) || fs.existsSync("/Applications/Windsurf.app"),
    connect: connectWindsurf,
  },
  zed: {
    label: "Zed",
    detect: () =>
      fs.existsSync(path.dirname(zedConfig())) ||
      fs.existsSync("/Applications/Zed.app") ||
      commandExists("zed"),
    connect: connectZed,
  },
  vscode: {
    label: "VS Code",
    detect: () =>
      fs.existsSync(path.dirname(path.dirname(vscodeConfig()))) ||
      commandExists("code"),
    connect: connectVSCode,
  },
  codex: {
    label: "Codex CLI",
    detect: () => commandExists("codex") || fs.existsSync(home(".codex")),
    connect: connectCodex,
  },
  gemini: {
    label: "Gemini CLI",
    detect: () => commandExists("gemini") || fs.existsSync(home(".gemini")),
    connect: connectGemini,
  },
  openclaw: {
    label: "OpenClaw",
    detect: () => commandExists("openclaw") || fs.existsSync(home(".openclaw")),
    connect: connectOpenClaw,
  },
};

/** `connect all`: configure every tool detected on this machine. */
function connectAll(): void {
  warnIfEphemeral();
  const found: Tool[] = [];
  const skipped: string[] = [];
  for (const t of TOOLS) {
    if (REGISTRY[t].detect()) found.push(t);
    else skipped.push(REGISTRY[t].label);
  }
  if (found.length === 0) {
    warn("No supported AI tools detected on this machine.");
    info(`Looked for: ${TOOLS.map((t) => REGISTRY[t].label).join(", ")}.`);
    info(`Once you've installed one, rerun ${bold("dotme connect all")} — or use ${bold("dotme connect manual")} for any other MCP client.`);
    return;
  }
  info(`Detected: ${found.map((t) => bold(REGISTRY[t].label)).join(", ")}`);
  for (const t of found) REGISTRY[t].connect();
  if (skipped.length > 0) {
    console.log();
    info(`Skipped (not detected on this machine): ${skipped.join(", ")}.`);
    info(`Install one later? Rerun ${bold("dotme connect <tool>")}.`);
  }
  console.log();
  info("ChatGPT Desktop is not on the list: it only supports remote MCP servers — see `dotme connect chatgpt`.");
}

/** `connect manual`: catch-all snippet for any current or future MCP client. */
function connectManual(): void {
  warnIfEphemeral();
  const { command, args } = serverCommand();
  console.log(`${bold("dotme works with any MCP client.")} Point it at this local stdio command:

  command: ${command}
  args:    ${JSON.stringify(args)}

JSON config (most tools — the key is usually ${bold("mcpServers")}, but VS Code calls it ${bold("servers")} and Zed ${bold("context_servers")}):

${JSON.stringify({ mcpServers: { dotme: { command, args } } }, null, 2)}

TOML config (Codex CLI and friends):

[mcp_servers.dotme]
command = ${JSON.stringify(command)}
args = ${JSON.stringify(args)}

Paste the block into your client's MCP config file (back it up first), restart the client, and ask it: "what do you know about me?"`);
}

export function connect(args: string[]): void {
  const target = args[0];
  const usage = `Usage: dotme connect <${TOOLS.join(" | ")} | chatgpt | manual | all>`;
  if (!target) {
    warn(usage);
    process.exitCode = 1;
    return;
  }
  if (target === "--help" || target === "-h" || target === "help") {
    console.log(usage.slice(usage.indexOf("Usage:")));
    info(`${bold("all")} auto-detects installed tools; ${bold("manual")} prints a snippet for any other MCP client.`);
    return;
  }
  if (target === "all") return connectAll();
  if (target === "manual") return connectManual();
  if (target === "chatgpt" || target === "chatgpt-desktop") return explainChatGPT();
  if (!TOOLS.includes(target as Tool)) {
    warn(`Unknown tool "${target}".`);
    warn(usage);
    info(`Tool not listed? ${bold("dotme connect manual")} works with any MCP client.`);
    process.exitCode = 1;
    return;
  }
  warnIfEphemeral();
  REGISTRY[target as Tool].connect();
}
