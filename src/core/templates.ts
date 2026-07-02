/**
 * Generators for the initial ~/.me files. Kept separate from me.ts so the
 * format of a fresh ~/.me lives in one place.
 */

export interface InitAnswers {
  name?: string;
  role?: string;
  communication?: string;
  projects?: Array<{ name: string; status?: string; context?: string }>;
  stack?: string;
  preferences?: string;
}

const OMITTED = "_Not filled in yet — edit this file any time._";

export function profileMd(a: InitAnswers): string {
  return `# Profile

## Who I am

- **Name:** ${a.name?.trim() || "(add your name)"}
- **What I do:** ${a.role?.trim() || "(add your role / what you work on)"}

## How I communicate

${a.communication?.trim() || OMITTED}
`;
}

export function projectsMd(a: InitAnswers): string {
  const projects = a.projects?.filter((p) => p.name.trim()) ?? [];
  const body =
    projects.length > 0
      ? projects
          .map(
            (p) =>
              `## ${p.name.trim()}\n\n- **Status:** ${p.status?.trim() || "active"}\n- **Context:** ${p.context?.trim() || "(add context)"}`,
          )
          .join("\n\n")
      : OMITTED;
  return `# Projects

Active work, with enough context that an AI tool can pick up mid-conversation.

${body}
`;
}

export function stackMd(a: InitAnswers): string {
  return `# Stack

Machines, tools, infrastructure, and key paths.

${a.stack?.trim() || OMITTED}
`;
}

export function preferencesMd(a: InitAnswers): string {
  return `# Preferences

How I want AI tools to behave with me.

${a.preferences?.trim() || OMITTED}
`;
}

export function memoryMd(): string {
  return `# Memory

Append-only dated log of notable facts. AI tools add entries here via the
\`remember\` tool; you can add or prune entries by hand.
`;
}

export function privateMd(): string {
  return `# Private

Notes that are **never exposed to AI tools by default**. To change that,
set \`"private.md": true\` under \`permissions\` in ~/.me/manifest.json.
`;
}

export const GITIGNORE = `# Never commit sensitive notes or the local audit log.
private.md
.changelog
`;
