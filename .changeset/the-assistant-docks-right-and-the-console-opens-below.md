---
"invana": patch
---

The Assistant docks on the right, and a Console opens under the canvas.

On an empty Graph the Assistant starts in the middle of the board. Once a conversation starts,
it docks on the right; ✕ closes it, and the header's `Assistant` toggle or the pill over the
canvas reopens it. The composer's one switch now reads Ask · Cypher · Gremlin, and in a query
`⌘↵` runs. The new Console sits under the canvas with Records, Query and Log tabs, Table or JSON,
Re-run and Collapse; a failed query opens its Log, and the reply's card offers *Open the log*.
Both the dock and the Console survive a reload (`?right=`, `?console=`). The docked Assistant
opens at 440px, and the first screen names the agent that will answer and the world it asks in.
