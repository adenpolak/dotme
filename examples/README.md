# Example ~/.me

This is a fully filled-out `~/.me` for a fictional person — **Maya Chen**, an
indie developer building a plant-care app — so you can see what a good one
looks like before writing your own.

Browse the files in [.me/](.me/). Things worth noticing:

- **Context, not biography.** Every line earns its place by changing how an AI
  should respond: her stack means code answers come back in Swift, her
  preferences kill the "have you considered React Native?" conversation forever.
- **memory.md is a log, not an essay.** Short dated facts, appended over time —
  some by her, some by AI tools via the `remember` tool.
- **private.md exists and is boring to everyone but her.** Salary negotiations
  and runway numbers live there; no AI tool ever sees them unless she flips the
  flag in `manifest.json`.

To try it out without writing your own yet:

```bash
cp -r examples/.me ~/.me
npx dotme-ai connect all
```
