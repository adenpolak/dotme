#!/usr/bin/env node
/** dotme CLI — your personal context layer for AI tools. */

import { copyToClipboard, clipboardHint } from "./clipboard.js";
import { connect } from "./connect.js";
import { doctor } from "./doctor.js";
import { init } from "./init.js";
import {
  VERSION,
  exportContext,
  listSections,
  meDir,
  meExists,
  readChangelog,
  readSection,
  resolveSection,
} from "../core/me.js";
import { bold, dim, info, ok, warn } from "./ui.js";

const HELP = `${bold("dotme")} — your personal context layer for AI tools

Usage:
  dotme init [--sample] [--force]   Create ~/.me (interactive wizard, ~3 min)
  dotme connect <tool>              Hook dotme into an AI tool (claude-desktop |
                                    claude-code | cursor | windsurf | zed | vscode |
                                    cline | roo | codex | gemini | openclaw | all)
  dotme connect all                 Auto-detect installed tools and configure them
  dotme connect manual              Paste-ready config for any other MCP client
  dotme status                      Files, sizes, exposure, recent changes
  dotme show <section>              Print one section (e.g. dotme show profile)
  dotme export [section...]         Print exposed context as one paste-ready block
                                    (--copy to clipboard, --compact to save tokens)
  dotme changelog [-n N]            Audit log of every write (default last 20)
  dotme doctor                      Diagnostics for bug reports (no personal content)
  dotme serve                       Run the MCP server on stdio (used by AI tools)
  dotme help                        This help

Your context lives in plain markdown at ${meDir()} — edit it any time.`;

function requireMe(): boolean {
  if (meExists()) return true;
  warn(`No ${meDir()} yet. Run ${bold("dotme init")} first.`);
  process.exitCode = 1;
  return false;
}

function status(): void {
  if (!requireMe()) return;
  console.log(bold(`\n${meDir()}\n`));
  for (const s of listSections()) {
    const state = !s.exists
      ? dim("missing")
      : s.exposed
        ? "exposed"
        : "private (not exposed to AI)";
    const size = s.exists ? `${(s.sizeBytes / 1024).toFixed(1)} KB` : "";
    const mod = s.modified ? dim(`modified ${s.modified.slice(0, 16).replace("T", " ")}`) : "";
    console.log(`  ${s.file.padEnd(16)} ${state.padEnd(28)} ${size.padEnd(8)} ${mod}`);
  }
  const recent = readChangelog().slice(-3);
  if (recent.length > 0) {
    console.log(bold("\nRecent changes:"));
    for (const line of recent) console.log(`  ${dim(line)}`);
  }
  console.log();
}

function show(args: string[]): void {
  if (!requireMe()) return;
  const name = args[0];
  if (!name) {
    warn("Usage: dotme show <profile | projects | stack | preferences | memory | private>");
    process.exitCode = 1;
    return;
  }
  const file = resolveSection(name);
  const content = file ? readSection(file) : null;
  if (!file || content === null) {
    warn(`No section "${name}" found in ${meDir()}.`);
    process.exitCode = 1;
    return;
  }
  console.log(content.trimEnd());
}

function exportCmd(args: string[]): void {
  if (!requireMe()) return;
  const copy = args.includes("--copy");
  const compact = args.includes("--compact");
  const sections = args.filter((a) => !a.startsWith("--"));

  const result = exportContext(sections.length > 0 ? sections : undefined, compact);

  for (const name of result.unknown) {
    warn(`No section "${name}" — skipping. Valid: profile, projects, stack, preferences, memory.`);
  }
  for (const file of result.excluded) {
    warn(`"${file}" is not exposed (private or turned off in manifest.json) — excluded.`);
  }
  if (result.files.length === 0) {
    warn("Nothing to export — no requested sections are exposed.");
    process.exitCode = 1;
    return;
  }

  if (copy) {
    const tool = copyToClipboard(result.text);
    if (tool) {
      const which = result.files.map((f) => f.replace(/\.md$/, "")).join(", ");
      ok(`Copied your context (${which}) to the clipboard via ${tool}. Paste it into any AI tool.`);
    } else {
      // No clipboard tool — fall back to printing so the command still works.
      warn(clipboardHint() + " Printing instead:");
      console.log();
      console.log(result.text);
    }
    return;
  }

  console.log(result.text);
}

function changelog(args: string[]): void {
  if (!requireMe()) return;
  const nFlag = args.indexOf("-n");
  const n = nFlag >= 0 ? parseInt(args[nFlag + 1] ?? "20", 10) || 20 : 20;
  const lines = args.includes("--all") ? readChangelog() : readChangelog().slice(-n);
  if (lines.length === 0) {
    info("No changes logged yet.");
    return;
  }
  for (const line of lines) console.log(line);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "init":
      await init(args);
      break;
    case "connect":
      connect(args);
      break;
    case "status":
      status();
      break;
    case "show":
      show(args);
      break;
    case "export":
      exportCmd(args);
      break;
    case "doctor":
      doctor();
      break;
    case "changelog":
      changelog(args);
      break;
    case "serve":
      // The server module starts itself on import (stdio transport).
      await import("../server/index.js");
      break;
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;
    default:
      warn(`Unknown command "${command}".`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
