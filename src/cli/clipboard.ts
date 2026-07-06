/**
 * Cross-platform "copy to clipboard" with graceful fallback. Returns the name
 * of the tool used, or null if no clipboard tool is available (caller then just
 * prints the text). We never throw — a missing clipboard tool is not an error.
 */

import { spawnSync } from "node:child_process";

interface ClipTool {
  cmd: string;
  args: string[];
}

/** Ordered clipboard candidates for the current platform. */
function candidates(): ClipTool[] {
  if (process.platform === "darwin") {
    return [{ cmd: "pbcopy", args: [] }];
  }
  if (process.platform === "win32") {
    return [{ cmd: "clip", args: [] }];
  }
  // Linux / BSD: Wayland first, then X11 options.
  return [
    { cmd: "wl-copy", args: [] },
    { cmd: "xclip", args: ["-selection", "clipboard"] },
    { cmd: "xsel", args: ["--clipboard", "--input"] },
  ];
}

/**
 * Try to copy `text` to the system clipboard. Returns the tool name on success,
 * or null if nothing worked (no tool installed, or the tool errored).
 */
export function copyToClipboard(text: string): string | null {
  for (const { cmd, args } of candidates()) {
    try {
      const res = spawnSync(cmd, args, { input: text });
      // spawnSync sets .error (e.g. ENOENT) when the binary isn't found.
      if (!res.error && res.status === 0) return cmd;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Human-readable hint for installing a clipboard tool, per platform. */
export function clipboardHint(): string {
  if (process.platform === "linux") {
    return "No clipboard tool found. Install one of: wl-clipboard (Wayland), xclip, or xsel.";
  }
  return "No clipboard tool found on this system.";
}
