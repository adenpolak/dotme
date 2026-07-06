#!/usr/bin/env node
/**
 * Append a dated metrics row to METRICS.md (gitignored) — a lightweight launch
 * dashboard. Pulls GitHub stars/forks/open-issues via the `gh` CLI and npm
 * weekly downloads from the public registry API. Zero external dependencies.
 *
 * Usage:  node scripts/snapshot.mjs
 * Cron:   run it daily during launch week to watch the curve.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "adenpolak/dotme";
const PKG = "dotme-ai";
const METRICS = path.join(fileURLToPath(new URL("..", import.meta.url)), "METRICS.md");

/** GitHub repo stats via `gh api` (returns null if gh is missing/unauthed). */
function github() {
  try {
    const out = execFileSync(
      "gh",
      ["api", `repos/${REPO}`, "--jq", "{stars: .stargazers_count, forks: .forks_count, issues: .open_issues_count}"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/** npm weekly downloads from the public downloads API (null on failure). */
async function npmWeekly() {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${PKG}`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.downloads === "number" ? data.downloads : null;
  } catch {
    return null;
  }
}

/** Total published versions, as a proxy for release cadence (null on failure). */
async function npmVersions() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PKG}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { latest: data["dist-tags"]?.latest ?? "?", count: Object.keys(data.versions ?? {}).length };
  } catch {
    return null;
  }
}

const HEADER =
  "# dotme metrics\n\n" +
  "Dated snapshots (appended by `scripts/snapshot.mjs`). Gitignored — local only.\n\n" +
  "| Date (UTC) | Stars | Forks | Open issues | npm/week | Latest | Versions |\n" +
  "|---|---|---|---|---|---|---|\n";

function cell(v) {
  return v === null || v === undefined ? "n/a" : String(v);
}

async function main() {
  const gh = github();
  const weekly = await npmWeekly();
  const versions = await npmVersions();
  const date = new Date().toISOString().slice(0, 10);

  const row =
    `| ${date} | ${cell(gh?.stars)} | ${cell(gh?.forks)} | ${cell(gh?.issues)} | ` +
    `${cell(weekly)} | ${cell(versions?.latest)} | ${cell(versions?.count)} |\n`;

  if (!fs.existsSync(METRICS)) fs.writeFileSync(METRICS, HEADER);
  fs.appendFileSync(METRICS, row);

  process.stdout.write(row);
  if (!gh) console.error("(note: `gh` unavailable or unauthed — GitHub columns are n/a)");
  if (weekly === null) console.error("(note: npm downloads API unreachable — npm/week is n/a)");
}

main();
