---
"invana": minor
"studio": minor
---

One assistant, on the right, with the selection in hand (docs/for-developers/modules/explore/features/the-assistant-drawer.md).

**The drawer is the Sessions panel, moved.** Nothing inside it is redesigned — it already switched between the list and the open thread, and its composer already named the bound agent. What changes is where it lives and what it knows. It opens over the **right side**, so inspecting and asking stop competing for it: while the drawer is open it *is* the right panel, and the inspector comes back when it closes.

**Two axes, two params.** The left panel stays in `?settings=`; the thread gets `?ai=`. They move independently — which is the proof they were never peers — so opening the assistant never costs the panel you had open, and a thread is linkable: paste the URL and land in the same conversation, on the same panel, looking at the same canvas. The trigger sits in the header's panel controls, after fullscreen.

**The selection rides above the composer as a chip** — named, and removable. It goes into the ask *in words*, because what the thread records has to be what was asked; a hidden context field would make the transcript a partial account. Take the chip off and the line goes with it.

**A canvas that reopens says what it lost.** `POST …/explorer/resolve` answers which of a saved canvas's elements the graph still holds, in one request on hydrate. What is gone is **kept and marked missing** rather than dropped — a drawing that quietly loses a node is a drawing that lies about what was explored — and the inspector says so on the element itself.
