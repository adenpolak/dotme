# Changelog

All notable changes to dotme are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and dotme adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

_Next up (0.3.1 / 0.4): fixes and tool additions from launch feedback — see FEEDBACK.md._

## [0.3.0] — 2026-07-08

The "works everywhere, paste anywhere, debuggable" release. No breaking changes;
the `~/.me` format is unchanged.

### Added
- **`dotme export [section...]`** — print your exposed context as one paste-ready
  markdown block for tools without MCP (ChatGPT, Gemini web, anything). `--copy`
  puts it on the clipboard (pbcopy / clip / wl-copy / xclip / xsel, with a
  graceful fall back to printing), `--compact` strips headers and blank lines for
  token economy. Same privacy rules as the server: `private.md` is never included.
- **`dotme doctor`** — a copy-pasteable diagnostic block for bug reports:
  dotme/node/OS versions, `~/.me` health (exists, manifest validity, section file
  list), tool detection, and whether each tool's config points at a server file
  that actually exists — flagging **stale** paths (deleted) and **fragile** paths
  (npx cache npm may delete), then a live MCP server dry run. File names and
  booleans only — never the contents of any `~/.me` file.
- **Windows and Linux support.** Per-OS config paths for Claude Desktop
  (`%APPDATA%` on Windows; no Linux build exists), VS Code, and Zed (`%APPDATA%`
  on Windows); every other tool was already home-relative or CLI-based. Verified
  against each tool's official docs.
- **Continuous integration** on macOS, Ubuntu, and Windows across Node 20 and 22.

### Changed
- `dotme connect chatgpt` now leads with the safe workaround (`dotme export
  --copy`, then paste) and documents the advanced supergateway + tunnel bridge
  honestly, spelling out that it publishes unauthenticated personal context to
  the internet.

### Fixed
- `isEphemeralInstall` (fragile-path detection) now matches the `_npx` segment
  with either path separator, so it's correct on Windows regardless of slash
  style.

## [0.2.2] — 2026-07-05

### Fixed
- **`connect` no longer bakes an ephemeral npx path into client configs.**
  Running the documented quick start (`npx dotme-ai connect all`) used to point
  every tool at dotme's temporary `_npx` cache directory, which npm garbage-
  collects — so connections would silently break weeks later. `connect` now
  prefers a durable global install when one exists, and when it can't find one
  it warns clearly and tells you to `npm install -g dotme-ai` for a permanent
  setup (the connection still works immediately in the meantime).

## [0.2.1] — 2026-07-05

### Fixed
- **Symlinked `~/.me` can now be initialized.** `init` treated an existing
  empty directory as "already set up" and refused — which broke the common
  sync setup where `~/.me` is a symlink to a Dropbox/iCloud/git folder. The
  "already set up" check is now keyed on `manifest.json` (the marker `init`
  writes), so an empty synced folder initializes cleanly while a folder that
  already holds a real dotme is still protected without `--force`.
- **The MCP server now reports the real package version** in its handshake
  instead of a hardcoded `0.1.0`. CLI and server both read the version from
  `package.json`, so they can't drift again.
- Copy fix: `init`'s closing hint said "Claude Desktop, Claude Code, and
  Cursor"; it now points at `connect all`'s auto-detection of all nine tools.

### Added
- Dependency-free regression tests (`npm test`, via `node --test`) locking in
  the security promises: private.md is never exposed by any path or under a
  corrupt manifest, section names can't traverse out of `~/.me`, and
  memory.md stays append-only.

## [0.2.0] — 2026-07-05

### Added
- **Six new tool integrations** for `dotme connect`, each verified against the
  tool's official docs (July 2026): **Windsurf** (`~/.codeium/windsurf/mcp_config.json`),
  **Zed** (`context_servers` in `~/.config/zed/settings.json`), **VS Code /
  GitHub Copilot** (`servers` in the user-profile `mcp.json`), **Codex CLI**
  (`codex mcp add`, with a direct `~/.codex/config.toml` fallback), **Gemini
  CLI** (`~/.gemini/settings.json`), and **OpenClaw** (`openclaw mcp add`, with
  a direct `~/.openclaw/openclaw.json` fallback).
- `dotme connect all` now **detects which tools are actually installed** and
  configures only those, listing what it skipped and why.
- `dotme connect manual` — prints a paste-ready generic MCP config snippet
  (JSON and TOML, with your machine's real paths) so any current or future MCP
  client can connect even if dotme doesn't support it by name.
- `dotme connect chatgpt` — explains honestly why there's no native ChatGPT
  integration (its developer-mode connectors are remote-only; dotme is
  local-only by design) and what your options are.
- README compatibility table: every tool, whether it's supported, and how it's
  configured.

### Changed
- Configs that can't be parsed as strict JSON (e.g. Zed settings with
  comments) are no longer touched at all — dotme prints the exact snippet to
  paste instead of risking your file.

### Unchanged (the promises)
- Every config write is still preceded by a timestamped backup next to the file.
- Other MCP servers in a config are still merged around, never overwritten.
- Still zero network code, zero telemetry.

## [0.1.0] — 2026-07-03

### Added
- Initial release: `~/.me` context folder with `init` wizard, local stdio MCP
  server (`get_context`, `search_context`, `remember`, `update_context`,
  `list_sections`, plus `me://` resources), `connect` for Claude Desktop,
  Claude Code, and Cursor, `status`, `show`, `changelog`, and a full write
  audit log.
