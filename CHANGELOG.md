# Changelog

All notable changes to dotme are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and dotme adheres to
[Semantic Versioning](https://semver.org/).

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
