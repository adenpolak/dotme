# dotme

[![npm version](https://img.shields.io/npm/v/dotme-ai.svg)](https://www.npmjs.com/package/dotme-ai)
[![CI](https://github.com/adenpolak/dotme/actions/workflows/ci.yml/badge.svg)](https://github.com/adenpolak/dotme/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/dotme-ai.svg)](https://github.com/adenpolak/dotme/blob/main/LICENSE)
[![node: >=20](https://img.shields.io/node/v/dotme-ai.svg)](https://nodejs.org)

**Website: [adenpolak.github.io/dotme](https://adenpolak.github.io/dotme/)**

```bash
npx dotme-ai init          # describe yourself once (~3 min, every question skippable)
npx dotme-ai connect all   # auto-detects your AI tools and hooks up every one
# done — restart your AI tools and ask one: "what do you know about me?"
```

![dotme in action: describe yourself once, then connect every AI tool on your machine in one command](https://raw.githubusercontent.com/adenpolak/dotme/main/demo/demo.gif)

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
| Cline | ✅ | VS Code `globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` → `mcpServers` |
| Roo Code | ✅ | VS Code `globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json` → `mcpServers` |
| Codex CLI | ✅ | `codex mcp add`, or `[mcp_servers.dotme]` in `~/.codex/config.toml` |
| Gemini CLI | ✅ | `~/.gemini/settings.json` → `mcpServers` |
| OpenClaw | ✅ | `openclaw mcp add`, or `mcp.servers` in `~/.openclaw/openclaw.json` |
| Continue.dev | ⚠️ manual | Uses YAML (`~/.continue/config.yaml`) which we won't rewrite blindly — see [manual clients](#manual-clients-continue-jetbrains-warp) |
| JetBrains AI Assistant | ⚠️ manual | Configured in the IDE UI (Settings → Tools → AI Assistant → MCP) — see [manual clients](#manual-clients-continue-jetbrains-warp) |
| Warp | ⚠️ manual | Configured in Warp Drive → MCP Servers → + Add — see [manual clients](#manual-clients-continue-jetbrains-warp) |
| ChatGPT | ⚠️ paste | Connectors are **remote-only** (SSE/HTTP) — can't launch a local stdio server. Use `dotme export --copy` and paste (see [ChatGPT & no-MCP tools](#chatgpt--tools-without-mcp)). |
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
dotme export [section...] # print exposed context as one paste-ready block
                          #   --copy to clipboard, --compact to save tokens
dotme changelog           # audit log (last 20; -n 100 or --all for more)
dotme serve               # run the MCP server (your AI tools call this)
```

### ChatGPT & tools without MCP

Some tools can't run a local MCP server — ChatGPT's connectors are remote-only, and web chats have no MCP at all. For those, skip the server and just paste your context:

```bash
dotme export --copy            # copies your exposed context to the clipboard
dotme export --copy --compact  # same, but strips headers/blank lines to save tokens
dotme export profile stack     # only specific sections
```

`export` follows the exact same rules as the server: `private.md` is never included. Paste the block into ChatGPT, Gemini web, or anywhere else and it's treated as ground truth about you.

> **Advanced (at your own risk):** you *can* bridge dotme to ChatGPT's remote connectors by wrapping the stdio server as HTTP with [supergateway](https://github.com/supercorp-ai/supergateway) and exposing it through a tunnel (ngrok / Cloudflare / OpenAI's Secure MCP Tunnel). But that publishes your personal context to the internet, and dotme has no auth — anyone with the URL can read it. `export` is the recommended path; only bridge if you fully understand the tradeoff. Run `dotme connect chatgpt` for the exact command.

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

### Manual clients (Continue, JetBrains, Warp)

These support local stdio MCP servers but don't expose a config file dotme can safely write (YAML we won't merge blindly, or UI-only setup), so add dotme by hand once. Get your exact command + args from `dotme connect manual`, then:

- **Continue.dev** — add a global server to `~/.continue/config.yaml`:

  ```yaml
  mcpServers:
    - name: dotme
      type: stdio
      command: node
      args:
        - /path/to/dotme-ai/dist/server/index.js
  ```

- **JetBrains AI Assistant** — Settings → Tools → AI Assistant → Model Context Protocol (MCP) → add a server, paste the command and args (or use the IDE's "Copy Stdio Config").

- **Warp** — Warp Drive → MCP Servers → + Add, paste the `{ "dotme": { "command": …, "args": [ … ] } }` block, then Start.

## Sync between machines

`~/.me` is just a folder, so syncing it is whatever you already trust: git, iCloud Drive, Dropbox, or Syncthing. Git is the nicest because it gives you the same audit trail you already get from `.changelog`, plus history and rollback.

**On your first machine — put `~/.me` under git and push it:**

```bash
cd ~/.me
git init && git branch -M main
printf 'private.md\n.changelog\n' > .gitignore   # keep secrets + local log off the remote
git add -A && git commit -m "my ~/.me"
git remote add origin <your-private-repo-url>     # a PRIVATE repo
git push -u origin main
```

(`dotme init` can do the `git init` + `.gitignore` for you if you answer yes to the git prompt.)

**On your second machine — clone it into place, and dotme just works:**

```bash
git clone <your-private-repo-url> ~/.me
dotme connect all      # hook up that machine's AI tools
```

There's no second `dotme init` — dotme sees the cloned `manifest.json` and treats the folder as already set up (this is the fix in 0.2.1 that also makes a symlinked `~/.me` work). If `~/.me` is a symlink to a Dropbox/iCloud folder, that works the same way.

**Day to day:** `git -C ~/.me pull` to get changes, `git -C ~/.me commit -am … && git push` to send them.

Two deliberate properties:

- **`private.md` and `.changelog` never sync.** They're gitignored, so each machine keeps its own private notes and its own local audit log. Your secrets don't ride along to the remote.
- **Use a private repo.** Your exposed context is still personal. dotme keeps it in files you control precisely so *you* decide where they go — don't push them somewhere public.

> First-class built-in sync (no git required) is on the roadmap; today it's deliberately "bring your own sync" because a folder you own shouldn't need our servers.

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
Any tool that speaks MCP over local stdio can connect — use `dotme connect manual` if it's not in the table. ChatGPT is the exception: its connectors only accept remote servers, so there's no native hookup. Use `dotme export --copy` and paste — see [ChatGPT & tools without MCP](#chatgpt--tools-without-mcp).

**Several machines?**
`~/.me` is just a folder — sync it with git, iCloud, Dropbox, or Syncthing. See [Sync between machines](#sync-between-machines) for the exact git commands; `private.md` and `.changelog` stay local. (First-class sync is on the roadmap.)

**Roadmap:** permissions UI · sync across machines · remote-server bridge (for ChatGPT-style clients).

## Troubleshooting

A connected tool doesn't see dotme? Run:

```bash
dotme doctor
```

It prints a diagnostic block — dotme/node/OS versions, whether `~/.me` and its manifest are healthy, which tools are detected, whether each tool's config points at a server file that **actually exists** (this catches the most common failure, a config left pointing at a deleted `npx` cache path), and a live check that the MCP server starts and responds. It contains only file names and booleans — **never the contents of your `~/.me` files** — so it's safe to paste.

If `doctor` flags a stale or fragile path, the usual fix is:

```bash
npm install -g dotme-ai && dotme connect all
```

Still stuck? [Open an issue](https://github.com/adenpolak/dotme/issues/new/choose) and paste your `dotme doctor` output.

## Development

```bash
git clone https://github.com/adenpolak/dotme && cd dotme
npm install && npm run build
node dist/cli/index.js --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md). A fully filled-out example persona lives in [examples/](examples/).

MIT licensed. Your context belongs to you.
