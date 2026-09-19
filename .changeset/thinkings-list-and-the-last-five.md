---
"invana": minor
"studio": minor
---

The five features the work surfaces were missing — and one endpoint that unlocks three of them.

**`GET …/thinkings`** lists runs as rows: the plan, where it came from, how far it got, and Verify's verdict — without the steps. It is one endpoint with filters (`agent_id` · `task_id` · `candidates`) rather than `/agents/{id}/plans` and `/workflows/candidates`, because both are the question "which runs match this?", and two endpoints would have given *served* two definitions to drift apart.

**Recent plans** on an agent now says what it has actually run: `template nl-single@1 · 7 steps · 1 replan`, with the verdict beside it. A run that never reached Verify shows its status rather than a verdict — "nobody asked" and "asked and failed" are different facts, the same rule the library's served-rate already follows.

**Promote a plan…** is built, and it is the library's only write. The picker offers candidates and nothing else: a plan the engine *generated* (a run off a template is already an entry), that served, that carries a plan document, and that no entry already claims. That narrowness is the safety argument — the shape already executed inside an envelope, so promotion makes nothing new executable; a free-text id or a looser list would quietly turn this into the authoring surface MVP deliberately does not have.

**A task row carries its run's position** — `Execute 5/7`. A position, never a percentage: a plan can replan, and a bar that goes backwards is worse than no bar.

**`edit spec`** opens an agent's raw envelope for the parts the chips do not cover — pins, `require`, templates. It parses on every keystroke and commits only a valid document, so the structured fields above never desync from the text, and Save is blocked while it is invalid. It edits JSON rather than YAML: YAML is the *workflow library's* surface form, the envelope is stored as JSON, and round-tripping one through the other would buy a label and cost a dependency, a lossy conversion, and a class of "it reformatted my envelope" bug.

**A policy flag has three states.** `agent.policy` is sparse — an absent key means the Atlas default applies, which is not the same fact as denied. Every seeded agent was rendering `spawn ✗ assignable ✗ unattended ✗`, asserting denials nobody had decided, and a Save would have written that invention back as real. The flag now reads `✓` / `✗` / `—` and cycles through all three, so "let the Atlas decide" stays reachable.

**Two canvas fixes.** Work-canvas node labels are a fixed two lines (a clamped title plus its sub-line) rather than wrapping to a variable height the layout cannot reserve room for. And ELK's spacing is configured once, through the typed fields only — passing the same numbers again as raw `elk.*` keys made the solver return nothing, which had been rendering every workflow DAG as an empty canvas.
