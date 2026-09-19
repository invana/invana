---
"studio": minor
---

LLM Providers is a panel with a trail, not a tab with a button (docs/for-developers/modules/agents/features/providers-and-models.md).

**The header is the breadcrumb.** The section drew itself as a `TabbedPanel` holding one permanent tab labelled *LLMs* — a tab you cannot leave is not a tab. It is now a `ListPanelChrome` like every other left-rail panel, and its title carries where you are: `LLM Providers` on the list, `LLM Providers › Add` while adding one, `LLM Providers › Claude Agent SDK` on one. The root crumb is the way back out.

**Add moved into the header.** A full-size *Add provider* button sat above the list, competing with the rows it introduced. It is the header's `+` now, next to refresh, search and close — and the trail says where it lands.

**A row opens the provider.** Set-default and delete stay on the row and reveal on hover; the row itself is the click target, so *Edit* is no longer a word the list has to spend. The panel closes on a status line that counts the providers and says when none of them is the default.
