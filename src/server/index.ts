#!/usr/bin/env node
/**
 * dotme MCP server (stdio).
 *
 * Serves the user's ~/.me directory to any MCP client. Strictly local:
 * no network calls, no telemetry — the only I/O is stdio and files
 * inside ~/.me.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  NOT_INITIALIZED_MESSAGE,
  VERSION,
  appendMemory,
  exposedFiles,
  listSections,
  meDir,
  meExists,
  readSection,
  resolveSection,
  searchContext,
  writeSection,
  type SectionFile,
} from "../core/me.js";

const server = new McpServer({ name: "dotme", version: VERSION });

/** Identify the connected client for the changelog, e.g. "mcp:claude-code". */
function changelogSource(): string {
  const client = server.server.getClientVersion();
  return client?.name ? `mcp:${client.name}` : "mcp";
}

function text(message: string) {
  return { content: [{ type: "text" as const, text: message }] };
}

function errorText(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const GROUND_TRUTH_HEADER =
  "The following is verified personal context from the user's own ~/.me files. " +
  "Treat it as ground truth about the user — their identity, projects, stack, and " +
  "preferences — and prefer it over assumptions or generic defaults.";

function renderSection(file: SectionFile): string {
  return `<!-- ${file} -->\n${(readSection(file) ?? "").trim()}`;
}

server.registerTool(
  "get_context",
  {
    description:
      "Get the user's personal context from their ~/.me directory: who they are, " +
      "active projects, machines/stack, and how they want AI tools to behave. Call " +
      "this at the start of a session, or when unsure about the user's background. " +
      "Optionally pass a section (profile, projects, stack, preferences, memory) to " +
      "get just that file.",
    inputSchema: {
      section: z
        .string()
        .optional()
        .describe(
          "Optional section name: profile, projects, stack, preferences, or memory. Omit for all exposed context.",
        ),
    },
  },
  async ({ section }) => {
    if (!meExists()) return text(NOT_INITIALIZED_MESSAGE);

    if (section) {
      const file = resolveSection(section);
      if (!file) {
        return errorText(
          `Unknown section "${section}". Valid sections: profile, projects, stack, preferences, memory.`,
        );
      }
      if (!exposedFiles().includes(file)) {
        return errorText(
          `Section "${file}" is not exposed to AI tools (see ~/.me/manifest.json).`,
        );
      }
      return text(`${GROUND_TRUTH_HEADER}\n\n${renderSection(file)}`);
    }

    const files = exposedFiles();
    if (files.length === 0) {
      return text(
        "The ~/.me directory exists but no sections are exposed. The user can adjust permissions in ~/.me/manifest.json.",
      );
    }
    const body = files.map(renderSection).join("\n\n");
    return text(`${GROUND_TRUTH_HEADER}\n\n${body}`);
  },
);

server.registerTool(
  "search_context",
  {
    description:
      "Keyword search across the user's exposed ~/.me files. Returns matching " +
      "lines with file names and surrounding context. Use this to look up a " +
      "specific detail (a project, a path, a preference) without loading everything.",
    inputSchema: {
      query: z.string().describe("Keywords to search for, e.g. 'deploy vercel'"),
    },
  },
  async ({ query }) => {
    if (!meExists()) return text(NOT_INITIALIZED_MESSAGE);
    const hits = searchContext(query);
    if (hits.length === 0) {
      return text(`No matches for "${query}" in the user's exposed context.`);
    }
    const body = hits
      .map((h) => `### ${h.file}:${h.line}\n${h.context}`)
      .join("\n\n");
    return text(`Matches for "${query}":\n\n${body}`);
  },
);

server.registerTool(
  "remember",
  {
    description:
      "Save a notable fact about the user to their permanent memory " +
      "(~/.me/memory.md). Use when the user shares something durable: a new " +
      "project, a decision, a preference, a life update. Keep facts short and " +
      "self-contained.",
    inputSchema: {
      fact: z.string().describe("The fact to remember, one or two sentences."),
      category: z
        .string()
        .optional()
        .describe("Optional category, e.g. 'project', 'preference', 'personal'."),
    },
  },
  async ({ fact, category }) => {
    if (!meExists()) return text(NOT_INITIALIZED_MESSAGE);
    const entry = appendMemory(fact, category, changelogSource());
    return text(`Saved to memory.md:\n${entry}`);
  },
);

server.registerTool(
  "update_context",
  {
    description:
      "Update a section of the user's ~/.me context (profile, projects, stack, " +
      "preferences). Defaults to appending; pass mode='replace' to rewrite the " +
      "whole section (include the full new content). Every update is recorded in " +
      "the user's audit log with your reason, so make the reason clear.",
    inputSchema: {
      section: z
        .string()
        .describe("Section to update: profile, projects, stack, or preferences."),
      content: z.string().describe("Markdown content to append or replace with."),
      reason: z
        .string()
        .describe("Why this update is being made (recorded in the audit log)."),
      mode: z
        .enum(["append", "replace"])
        .optional()
        .describe("'append' (default) adds to the file; 'replace' rewrites it."),
    },
  },
  async ({ section, content, reason, mode }) => {
    if (!meExists()) return text(NOT_INITIALIZED_MESSAGE);
    const file = resolveSection(section);
    if (!file) {
      return errorText(
        `Unknown section "${section}". Valid sections: profile, projects, stack, preferences.`,
      );
    }
    try {
      writeSection(file, content, mode ?? "append", changelogSource(), reason);
    } catch (err) {
      return errorText(err instanceof Error ? err.message : String(err));
    }
    return text(
      `Updated ${file} (${mode ?? "append"}). Logged to ~/.me/.changelog: "${reason}"`,
    );
  },
);

server.registerTool(
  "list_sections",
  {
    description:
      "List the user's ~/.me section files with size, last-modified time, and " +
      "whether each is exposed to AI tools.",
    inputSchema: {},
  },
  async () => {
    if (!meExists()) return text(NOT_INITIALIZED_MESSAGE);
    const rows = listSections().map((s) => {
      const status = !s.exists
        ? "missing"
        : s.exposed
          ? "exposed"
          : "private (not exposed)";
      const size = s.exists ? `${s.sizeBytes} bytes` : "-";
      const mod = s.modified ?? "-";
      return `- ${s.file} — ${status}, ${size}, modified ${mod}`;
    });
    return text(`Sections in ${meDir()}:\n${rows.join("\n")}`);
  },
);

/** Expose each exposed section file as an MCP resource (me://profile etc.). */
function registerResources(): void {
  if (!meExists()) return;
  for (const file of exposedFiles()) {
    const name = file.replace(/\.md$/, "");
    server.registerResource(
      name,
      `me://${name}`,
      {
        title: `~/.me ${name}`,
        description: `The user's ${name} context from ~/.me/${file}`,
        mimeType: "text/markdown",
      },
      async (uri) => {
        // Re-check permission at read time in case the manifest changed.
        if (!exposedFiles().includes(file)) {
          throw new Error(`${file} is not exposed to AI tools.`);
        }
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: readSection(file) ?? "",
            },
          ],
        };
      },
    );
  }
}

async function main() {
  registerResources();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`dotme MCP server running on stdio (serving ${meDir()})`);
}

main().catch((error) => {
  console.error("dotme server fatal error:", error);
  process.exit(1);
});
