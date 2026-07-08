/**
 * `dotme doctor` — a copy-pasteable diagnostic block for bug reports.
 *
 * Prints environment, ~/.me health, tool detection, per-tool connection status
 * (crucially: whether each config's dotme entry points at a path that actually
 * exists — this catches the stale-npx-path class of bug at a glance), and a
 * live MCP server dry run. Output is file names and booleans only: it never
 * reads or prints the contents of any ~/.me file.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { diagnoseConnections } from "./connect.js";
import {
  MANIFEST_FILE,
  VERSION,
  listSections,
  meDir,
  meExists,
} from "../core/me.js";
import { bold, dim, warn } from "./ui.js";

const YES = "yes";
const NO = "no";

/** Read manifest.json and classify it without exposing its contents. */
function manifestState(): "valid" | "invalid" | "missing" {
  const file = path.join(meDir(), MANIFEST_FILE);
  if (!fs.existsSync(file)) return "missing";
  try {
    JSON.parse(fs.readFileSync(file, "utf-8"));
    return "valid";
  } catch {
    return "invalid";
  }
}

/**
 * Start the MCP server, send initialize + list_sections, and report whether it
 * responded. Times out so a hung server can't hang doctor. Never prints the
 * response body.
 */
function serverDryRun(): { ok: boolean; detail: string } {
  const serverPath = fileURLToPath(new URL("../server/index.js", import.meta.url));
  if (!fs.existsSync(serverPath)) {
    return { ok: false, detail: `server entry missing at ${serverPath}` };
  }
  const requests =
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "dotme-doctor", version: VERSION } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_sections", arguments: {} } },
    ]
      .map((r) => JSON.stringify(r))
      .join("\n") + "\n";

  const res = spawnSync(process.execPath, [serverPath], {
    input: requests,
    encoding: "utf-8",
    timeout: 10000,
  });
  if (res.error) return { ok: false, detail: String(res.error.message ?? res.error) };

  for (const line of (res.stdout ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id === 2 && msg.result) return { ok: true, detail: "responded to list_sections" };
    } catch {
      /* not a JSON line */
    }
  }
  return { ok: false, detail: "no list_sections response" };
}

export function doctor(): void {
  const line = (label: string, value: string) => console.log(`  ${label.padEnd(16)}${value}`);

  console.log(bold("dotme doctor"));
  console.log(dim("─".repeat(52)));

  // Environment
  line("dotme", VERSION);
  line("node", process.version);
  line("os", `${process.platform} ${process.arch} (${os.release()})`);
  console.log();

  // ~/.me health
  if (!meExists()) {
    line("~/.me", `${meDir()}  (${bold("not set up")} — run \`dotme init\`)`);
  } else {
    line("~/.me", `${meDir()}  (exists)`);
    const mstate = manifestState();
    line("manifest", mstate === "valid" ? "valid" : `${bold(mstate)}${mstate === "invalid" ? " — fails closed, private stays hidden" : ""}`);
    const sections = listSections();
    const present = sections
      .filter((s) => s.exists)
      .map((s) => `${s.file.replace(/\.md$/, "")}${s.exposed ? "" : dim("(private)")}`);
    const missing = sections.filter((s) => !s.exists).map((s) => s.file.replace(/\.md$/, ""));
    line("sections", present.length ? present.join("  ") : dim("none"));
    if (missing.length) line("missing", dim(missing.join("  ")));
  }
  console.log();

  // Tool detection + connections
  const diags = diagnoseConnections();
  const detected = diags.filter((d) => d.detected).map((d) => d.label);
  line("detected", detected.length ? detected.join(", ") : dim("none"));
  console.log();
  console.log(`  ${bold("connections")}`);

  let staleFound = false;
  let fragileFound = false;
  const connected = diags.filter((d) => d.hasDotme || d.detected);
  if (connected.length === 0) {
    console.log(`    ${dim("no tools detected and no dotme entries found")}`);
  }
  for (const d of connected) {
    let status: string;
    if (!d.hasDotme) {
      status = dim(d.configExists ? "no dotme entry" : "not configured");
    } else if (d.serverPathExists === false) {
      staleFound = true;
      status = `dotme entry, ${bold("STALE PATH")} → server file missing`;
    } else if (d.serverPathEphemeral) {
      fragileFound = true;
      status = `dotme entry ${ok0()}, ${bold("FRAGILE PATH")} → npx cache (npm may delete)`;
    } else if (d.serverPathExists === true) {
      status = `dotme entry ${ok0()} → path exists`;
    } else {
      status = "dotme entry (path unknown)";
    }
    console.log(`    ${d.label.padEnd(16)}${status}`);
  }
  console.log();

  // Live server dry run
  const dry = serverDryRun();
  line("mcp server", dry.ok ? `starts + responds (${YES})` : `${bold("not responding")} (${NO}) — ${dry.detail}`);
  console.log();

  if (staleFound) {
    warn("A connection points at a missing server file (a stale path). Re-run `dotme connect all` to fix it.");
  }
  if (fragileFound) {
    warn("A connection points into an npx cache that npm can delete. For a durable setup: `npm i -g dotme-ai && dotme connect all`.");
  }
  console.log(dim("Paste this into your bug report."));
}

/** Small green check that survives no-color environments. */
function ok0(): string {
  return process.stdout.isTTY && !process.env.NO_COLOR ? "\x1b[32m✓\x1b[0m" : "OK";
}
