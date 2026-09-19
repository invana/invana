---
"invana": patch
---

Info leads the left rail

The graph info panel is the first icon of the rail's top group, above Explorer,
instead of the first of the settings group at the bottom. It is the graph
itself — name, readiness, what has been happening — and everything after it is
something in the graph. It still renders through `SettingsPanel`; where a
panel's code lives says nothing about where its icon belongs.
