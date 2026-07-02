/** Tiny ANSI helpers. Colors off when not a TTY or NO_COLOR is set. */

const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;

const wrap = (code: number) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s;

export const bold = wrap(1);
export const dim = wrap(2);
export const green = wrap(32);
export const yellow = wrap(33);
export const cyan = wrap(36);

export const ok = (s: string) => console.log(`${green("✓")} ${s}`);
export const warn = (s: string) => console.log(`${yellow("!")} ${s}`);
export const info = (s: string) => console.log(`${dim("·")} ${s}`);
