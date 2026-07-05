# dotme demo — render with:  vhs demo/demo.tape   (run from the repo root)
# Produces demo/demo.gif. Runs entirely in a sandbox HOME (see demo/prep.sh):
# your real ~/.me and real tool configs are never touched.

Output demo/demo.gif

Set Shell bash
Set FontSize 19
Set Width 1180
Set Height 720
Set Padding 22
Set Theme "Dracula"
Set TypingSpeed 40ms

# --- sandbox setup (hidden) ---
Hide
Type "source demo/prep.sh" Enter
Sleep 500ms
Show

# --- one-time setup: describe yourself ---
Type "dotme init" Sleep 800ms Enter
Sleep 1.2s
Type "Aden" Sleep 400ms Enter
Sleep 500ms
Type "indie dev building AI devtools" Sleep 400ms Enter
Sleep 500ms
Type "Answer first, then the why. No emojis." Sleep 400ms Enter
Sleep 500ms
Type "dotme" Sleep 300ms Enter
Sleep 400ms
Type "launching this week" Sleep 300ms Enter
Sleep 400ms
Type "one ~/.me folder every AI tool reads" Sleep 300ms Enter
Sleep 500ms
Enter
Sleep 400ms
Type "MacBook, Node 20, ships on Vercel" Sleep 400ms Enter
Sleep 500ms
Type "Terse. Code over prose." Sleep 400ms Enter
Sleep 500ms
Type "n" Sleep 300ms Enter
Sleep 1.8s

# --- hook up every AI tool on this machine, in one command ---
Type "dotme connect all" Sleep 800ms Enter
Sleep 3s

# --- it's just readable markdown you own ---
Type "dotme show preferences" Sleep 600ms Enter
Sleep 2.5s

Sleep 1.5s
