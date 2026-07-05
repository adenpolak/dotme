# Security

## The local-only promise

dotme is designed so that the interesting security questions mostly don't apply:

- **No network code.** The package makes zero network calls — no telemetry, no
  accounts, no cloud, no auto-update. You can verify this yourself:

  ```bash
  npm view dotme-ai dist.tarball        # download exactly what npm serves
  grep -rnE 'fetch\(|https?\.|net\.|createConnection|WebSocket' node_modules/dotme-ai/dist
  # → no matches
  ```

- **Your files, your machine.** Context lives in plain markdown under `~/.me`.
  The MCP server talks to clients over local stdio and only ever reads/writes
  inside `~/.me`.

- **Private by default.** `private.md` is never exposed to AI tools unless you
  explicitly set `"private.md": true` in `~/.me/manifest.json`. A corrupted or
  hand-broken manifest **fails closed** — it falls back to defaults, so a parse
  error can never accidentally expose a private file.

- **Section names can't escape `~/.me`.** Tool parameters are resolved against a
  fixed allowlist of section names, so `../`, absolute paths, and null bytes are
  rejected rather than followed.

- **Every AI write is audited.** Appends and updates are recorded in
  `~/.me/.changelog` with the client's name and its stated reason. Make `~/.me`
  a git repo (`dotme init` offers this) to diff and revert anything.

## Threat model, briefly

The main thing dotme hands to an AI client is your *exposed* context, and the
main thing it accepts back is appended memory / section updates — always inside
`~/.me`, always logged. dotme does not sandbox the AI client itself: if you
connect a malicious MCP client, it can read your exposed sections (that's the
point) and append log-visible junk. Keep genuinely sensitive material in
`private.md` (unexposed) and review `dotme changelog` / your git history.

## Reporting a vulnerability

Please report privately via
[GitHub Security Advisories](https://github.com/adenpolak/dotme/security/advisories/new)
rather than a public issue. I aim to acknowledge within a few days. Good-faith
reports are welcome and credited.

Supported: fixes land on the latest published `dotme-ai` release.
