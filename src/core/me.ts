/**
 * Core operations on the ~/.me directory.
 *
 * Everything here is strictly local: plain file reads and writes, no network,
 * no telemetry. This module is shared by the MCP server and the CLI so both
 * go through the same permission checks and changelog auditing.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** The canonical section files of a ~/.me directory. */
export const SECTION_FILES = [
  "profile.md",
  "projects.md",
  "stack.md",
  "preferences.md",
  "memory.md",
  "private.md",
] as const;

export type SectionFile = (typeof SECTION_FILES)[number];

export const MANIFEST_FILE = "manifest.json";
export const CHANGELOG_FILE = ".changelog";

export interface Manifest {
  version: number;
  created: string;
  permissions: Record<string, boolean>;
}

/** Default permissions: everything exposed except private.md. */
export function defaultPermissions(): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  for (const f of SECTION_FILES) perms[f] = f !== "private.md";
  return perms;
}

/**
 * Resolve the ~/.me directory. DOTME_DIR overrides for tests and unusual
 * setups; it is read from the local environment only.
 */
export function meDir(): string {
  return process.env.DOTME_DIR ?? path.join(os.homedir(), ".me");
}

export function meExists(): boolean {
  return fs.existsSync(meDir());
}

/** Message shown by every tool when ~/.me has not been set up yet. */
export const NOT_INITIALIZED_MESSAGE =
  "No ~/.me directory found. dotme is installed but hasn't been set up yet. " +
  "Ask the user to run `npx dotme-ai init` in a terminal (takes under 3 minutes), " +
  "then try again.";

/**
 * Normalize a section name: accepts "profile", "profile.md", "Profile", etc.
 * Returns the canonical file name, or null if it isn't a known section.
 */
export function resolveSection(name: string): SectionFile | null {
  const clean = name.trim().toLowerCase().replace(/\.md$/, "") + ".md";
  return (SECTION_FILES as readonly string[]).includes(clean)
    ? (clean as SectionFile)
    : null;
}

export function loadManifest(): Manifest {
  const file = path.join(meDir(), MANIFEST_FILE);
  const fallback: Manifest = {
    version: 1,
    created: new Date().toISOString(),
    permissions: defaultPermissions(),
  };
  if (!fs.existsSync(file)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return {
      version: parsed.version ?? 1,
      created: parsed.created ?? fallback.created,
      // Merge so a hand-edited manifest missing a key still gets safe defaults.
      permissions: { ...defaultPermissions(), ...(parsed.permissions ?? {}) },
    };
  } catch {
    // A corrupted manifest must fail closed, not open.
    return fallback;
  }
}

export function saveManifest(manifest: Manifest): void {
  fs.writeFileSync(
    path.join(meDir(), MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}

/** Is this file allowed to be shown to AI tools? */
export function isExposed(file: SectionFile): boolean {
  return loadManifest().permissions[file] === true;
}

/** All section files that exist on disk and are exposed by the manifest. */
export function exposedFiles(): SectionFile[] {
  const manifest = loadManifest();
  return SECTION_FILES.filter(
    (f) =>
      manifest.permissions[f] === true && fs.existsSync(path.join(meDir(), f)),
  );
}

export function readSection(file: SectionFile): string | null {
  const p = path.join(meDir(), file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null;
}

/**
 * Append an audit line to ~/.me/.changelog.
 * Format: ISO timestamp | source | file | summary
 */
export function appendChangelog(
  source: string,
  file: string,
  summary: string,
): void {
  const line = [
    new Date().toISOString(),
    source.replace(/\|/g, "/"),
    file,
    summary.replace(/\s+/g, " ").trim(),
  ].join(" | ");
  fs.appendFileSync(path.join(meDir(), CHANGELOG_FILE), line + "\n");
}

export function readChangelog(): string[] {
  const p = path.join(meDir(), CHANGELOG_FILE);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf-8").split("\n").filter(Boolean);
}

/** Append a dated fact to memory.md and log it. */
export function appendMemory(
  fact: string,
  category: string | undefined,
  source: string,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const tag = category ? ` *(${category.trim()})*` : "";
  const entry = `- **${date}**${tag} ${fact.trim()}`;
  const p = path.join(meDir(), "memory.md");
  const existing = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "# Memory\n";
  fs.writeFileSync(p, existing.replace(/\n*$/, "\n") + entry + "\n");
  appendChangelog(source, "memory.md", `remembered: ${fact.slice(0, 120)}`);
  return entry;
}

/**
 * Replace or append content in a section file. memory.md is append-only by
 * design, and no writes are allowed to files the manifest doesn't expose.
 */
export function writeSection(
  file: SectionFile,
  content: string,
  mode: "replace" | "append",
  source: string,
  reason: string,
): void {
  if (!isExposed(file)) {
    throw new Error(
      `${file} is not exposed to AI tools (see ~/.me/manifest.json). Refusing to write.`,
    );
  }
  if (file === "memory.md" && mode === "replace") {
    throw new Error(
      "memory.md is append-only. Use the remember tool, or append mode.",
    );
  }
  const p = path.join(meDir(), file);
  if (mode === "append") {
    const existing = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
    fs.writeFileSync(p, existing.replace(/\n*$/, "\n\n") + content.trim() + "\n");
  } else {
    fs.writeFileSync(p, content.trim() + "\n");
  }
  appendChangelog(source, file, `${mode}: ${reason}`);
}

export interface SectionInfo {
  file: SectionFile;
  exists: boolean;
  exposed: boolean;
  sizeBytes: number;
  modified: string | null;
}

export function listSections(): SectionInfo[] {
  const manifest = loadManifest();
  return SECTION_FILES.map((file) => {
    const p = path.join(meDir(), file);
    const exists = fs.existsSync(p);
    const stat = exists ? fs.statSync(p) : null;
    return {
      file,
      exists,
      exposed: manifest.permissions[file] === true,
      sizeBytes: stat?.size ?? 0,
      modified: stat ? stat.mtime.toISOString() : null,
    };
  });
}

export interface SearchHit {
  file: SectionFile;
  line: number;
  text: string;
  context: string;
}

/**
 * Keyword search across exposed files. A line matches if it contains at
 * least one query term (case-insensitive); hits matching more terms rank
 * higher. Each hit carries two lines of surrounding context.
 */
export function searchContext(query: string, maxHits = 20): SearchHit[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return [];

  const scored: Array<SearchHit & { score: number }> = [];
  for (const file of exposedFiles()) {
    const lines = (readSection(file) ?? "").split("\n");
    lines.forEach((text, i) => {
      const lower = text.toLowerCase();
      const score = terms.filter((t) => lower.includes(t)).length;
      if (score > 0 && text.trim().length > 0) {
        const context = lines
          .slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
          .join("\n");
        scored.push({ file, line: i + 1, text, context, score });
      }
    });
  }
  scored.sort((a, b) => b.score - a.score || a.line - b.line);
  return scored.slice(0, maxHits).map(({ score: _score, ...hit }) => hit);
}
