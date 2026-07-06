---
"studio": minor
---

Show the canvas banner preview in the Sessions list (RFC-045).

Each session row now renders its 1:1 canvas's banner screenshot above the title
when one has been captured. The image is pulled lazily per row (the list summary
still omits the heavy blob) and cached by canvas id, so opening the canvas later
reuses it. Rows whose canvas has no banner are unchanged. Adds a reusable
`banner` slot to the shared `ListRow`.
