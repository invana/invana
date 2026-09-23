---
"invana": patch
---

Drilling into a run stops taking the Runs panel down with it.

`ListPanelChrome` renders `filterMenu` straight inside its own `<DropdownMenu>`, so the content
wrapper belongs to the caller — `ListFilterMenu`, its other caller, has always supplied one. The
Runs panel passed a bare fragment of `DropdownMenuLabel` and radio rows, and Radix threw
*`MenuItem` must be used within `MenuContent`*, which the panel's error boundary turned into *Oops!
something went wrong* in place of the run. Found while opening a run dashboard to check the Govern
bands on it.
