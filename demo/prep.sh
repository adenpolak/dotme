#!/usr/bin/env bash
# Sandbox prep for the demo recording. Points HOME at a throwaway directory so
# the recording NEVER touches your real ~/.me or your real tool configs, and
# seeds a realistic set of "installed tool" markers so `connect all` has
# something to detect on camera. Nothing here is faked at runtime — connect
# writes real (sandboxed) config files with real backups.
set -e

export DEMO_HOME="${DEMO_HOME:-/tmp/dotme-demo-home}"
rm -rf "$DEMO_HOME"
mkdir -p "$DEMO_HOME"
export HOME="$DEMO_HOME"

# Make the locally-built dotme runnable as `dotme` inside the sandbox.
mkdir -p "$HOME/bin"
DOTME_REPO="${DOTME_REPO:-$PWD}"
cat > "$HOME/bin/dotme" <<EOF
#!/usr/bin/env bash
exec node "$DOTME_REPO/dist/cli/index.js" "\$@"
EOF
chmod +x "$HOME/bin/dotme"
export PATH="$HOME/bin:$PATH"

# Seed a believable footprint: a few tools this machine "has installed".
mkdir -p "$HOME/Library/Application Support/Claude"
mkdir -p "$HOME/.cursor"
mkdir -p "$HOME/Library/Application Support/Code/User"
mkdir -p "$HOME/.codex"

clear
