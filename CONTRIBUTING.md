# Contributing to dotme

Thanks for helping make personal AI context a standard.

## Ground rules

1. **Local only, forever.** PRs that add network calls, telemetry, accounts, or "anonymous usage stats" will be closed. The entire trust model is that this package cannot phone home.
2. **The format stays boring.** `~/.me` is plain markdown plus one JSON manifest. Changes to the format need a strong case and must stay hand-editable.
3. **Every write is audited.** Any code path that modifies `~/.me` must go through `appendChangelog()`.
4. **Private means private.** `private.md` (and anything the manifest doesn't expose) must never be readable through any tool or resource. Treat a leak here as a security bug.

## Setup

```bash
npm install
npm run build          # tsc → dist/
DOTME_DIR=/tmp/me-test node dist/cli/index.js init --sample   # never test against your real ~/.me
```

`DOTME_DIR` overrides the `~/.me` location — use it for all testing.

## Layout

```
src/core/      file operations, manifest/permissions, changelog, search (shared)
src/server/    MCP server (stdio) — tools + resources
src/cli/       init wizard, connect, status/show/changelog
```

## Reporting security issues

If you find a way to read non-exposed files through the server, please report it privately via GitHub security advisories rather than a public issue.

## Roadmap

Permissions UI · more tool integrations · sync across machines. Issues and PRs welcome.
