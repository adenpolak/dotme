# dotme

```bash
npx dotme-ai init          # describe yourself once (~3 min, every question skippable)
npx dotme-ai connect all   # auto-detects your AI tools and hooks up every one
# done — restart your AI tools and ask one: "what do you know about me?"
```

**Set up once. Every AI knows you.**

Every AI tool you use — Claude, Claude Code, Cursor, ChatGPT — has amnesia about *you*. You've explained who you are, what you're building, and how you like answers formatted hundreds of times, and you'll do it again tomorrow. dotme fixes this with one folder, `~/.me`, that you own: plain markdown files describing you, served to every AI tool through a single local server.

> **npm note:** the package is `dotme-ai` (the name `dotme` was taken), but the command is still `dotme`. Prefer a permanent install? `npm install -g dotme-ai`, then use `dotme` directly.

## What's in ~/.me

| File | What it holds |
|---|---|
| `profile.md` | Who you are, what you do, how you communicate |
| `projects.md` | Active projects with status and context |
| `stack.md` | Machines, tools, infrastructure, key paths |
| `preferences.md` | How you want AI tools to behave — tone, format, rules |
| `memory.md` | Append-only dated log of notable facts (AI tools add here) |
| `private.md` | Sensitive notes. **Never exposed to AI unless you opt in** |
| `manifest.json` | Permissions map — which files AI tools may see |
| `.changelog` | Audit log: every write, with timestamp, source, and reason |

Everything is plain markdown. Open it in any editor, change anything, and every AI tool sees the update immediately. No database, no export format, no lock-in — deleting dotme leaves you with a folder of readable notes.

## What AI tools can do with it

Connected tools get five capabilities:

- **get_context** — read your exposed context (this is how they "know you")
- **search_context** — look up a specific detail without loading everything
- **remember** — append a dated fact to `memory.md`
- **update_context** — update a section, with a required reason
- **list_sections** — see what files exist and what's exposed

Each exposed file is also available as a browsable MCP resource (`me://profile`, `me://projects`, …).

## The security promise

- **Your files.** Plain markdown in your home directory. Edit, version, or delete them any time.
- **Your machine.** The server runs locally over stdio. Zero network calls, zero telemetry, no accounts, no cloud.
- **Private by default where it matters.** `private.md` is never served unless you flip its flag in `manifest.json`.
- **Full audit log.** Every write an AI makes lands in `~/.me/.changelog` with a timestamp, which tool did it, and why. `dotme changelog` shows you the history.
- **Git-friendly.** `dotme init` can make `~/.me` a git repo with `private.md` and `.changelog` ignored, so you can diff and revert what AIs change.

## Supported tools

`dotme connect all` detects which of these are installed and configures only those, telling you what it skipped and why. All config methods verified against each tool's official docs, July 2026.

| Tool | Supported | Config method |
|---|---|---|
| Claude Desktop | ✅ | `~/Library/Application Support/Claude/claude_desktop_config.json` → `mcpServers` |
| Claude Code | ✅ | `claude mcp add --scope user dotme -- …` |
| Cursor | ✅ | `~/.cursor/mcp.json` → `mcpServers` |
| Windsurf | ✅ | `~/.codeium/windsurf/mcp_config.json` → `mcpServers` |
| Zed | ✅ | `~/.config/zed/settings.json` → `context_servers` (with `"source": "custom"`) |
| VS Code (Copilot) | ✅ | `~/Library/Application Support/Code/User/mcp.json` → `servers` (with `"type": "stdio"`) |
| Codex CLI | ✅ | `codex mcp add`, or `[mcp_servers.dotme]` in `~/.codex/config.toml` |
| Gemini CLI | ✅ | `~/.gemini/settings.json` → `mcpServers` |
| OpenClaw | ✅ | `openclaw mcp add`, or `mcp.servers` in `~/.openclaw/openclaw.json` |
| ChatGPT Desktop | ❌ | Developer-mode connectors are **remote-only** (SSE/HTTP) — no local stdio servers. `dotme connect chatgpt` explains your options. |
| Anything else that speaks MCP | ✅ | `dotme connect manual` prints a paste-ready snippet |

Two safety rules apply to every integration: an existing config file is **always backed up** next to itself first (e.g. `mcp.json.backup-2026-07-05T19-14-05`), and other servers already in the file are **merged around, never overwritten**. If a config can't be safely rewritten (e.g. Zed settings with comments), dotme refuses and prints the exact snippet to paste instead.

## Commands

```bash
dotme init                # interactive setup (use --sample for placeholder data)
dotme connect <tool>      # any tool from the table above, or:
dotme connect all         #   auto-detect installed tools and configure them
dotme connect manual      #   paste-ready config for any other MCP client
dotme status              # files, sizes, exposure, recent changes
dotme show <section>      # print one section
dotme changelog           # audit log (last 20; -n 100 or --all for more)
dotme serve               # run the MCP server (your AI tools call this)
```

### Connecting a tool manually

Run `dotme connect manual` for a snippet with your machine's real paths filled in. The shape is:

```json
{
  "mcpServers": {
    "dotme": {
      "command": "node",
      "args": ["/path/to/dotme-ai/dist/server/index.js"]
    }
  }
}
```

The top-level key varies by client (`mcpServers` for most, `servers` in VS Code, `context_servers` in Zed); TOML-based clients like Codex CLI use `[mcp_servers.dotme]`.

## Why this should be a standard

Developers solved this problem for machines decades ago: dotfiles. Your `.zshrc`, `.gitconfig`, and `.vimrc` mean any new machine can be *yours* in minutes — because your configuration lives in files you own, not inside any one program.

AI tools need the same thing for *people*. Today your context is scattered across a dozen proprietary memory systems — each tool builds its own silo, none of them portable, none of them auditable, all of them lost when you switch tools. `~/.me` is the dotfiles idea applied to identity: a boring, human-readable folder that any AI tool can read through one open protocol (MCP). The format is deliberately unexciting — markdown files and one JSON manifest — because standards win by being easy to adopt, easy to inspect, and impossible to be held hostage by.

If you build an AI tool: supporting `~/.me` is one MCP client config away.

## FAQ

**Does my data leave my machine?**
No. The server is local-only stdio. There is no network code in this package at all — grep it.

**What if I don't want an AI to see something?**
Put it in `private.md` (never exposed by default), or flip any file's flag to `false` in `manifest.json`.

**Can an AI silently rewrite my files?**
Every write goes through the changelog with the tool's name and its stated reason. Make `~/.me` a git repo (init offers this) and you can diff and revert anything.

**What about ChatGPT and other tools?**
Any tool that speaks MCP over local stdio can connect — use `dotme connect manual` if it's not in the table. ChatGPT is the exception: its connectors only accept remote servers, and dotme deliberately has zero network code, so there's no native hookup. `dotme show profile` pastes cleanly.

**Several machines?**
`~/.me` is just a folder — sync it with git, iCloud, Dropbox, or Syncthing. (First-class sync is on the roadmap.)

**Roadmap:** permissions UI · sync across machines · remote-server bridge (for ChatGPT-style clients).

## Development

```bash
git clone https://github.com/adenpolak/dotme && cd dotme
npm install && npm run build
node dist/cli/index.js --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md). A fully filled-out example persona lives in [examples/](examples/).

MIT licensed. Your context belongs to you.
