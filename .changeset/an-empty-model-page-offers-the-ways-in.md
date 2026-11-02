---
"invana": patch
---

An empty Models page offers the ways a model actually starts, and experimental acts say so.

**Models, no model published yet.** The empty state's acts are now **From an ontology**, which opens
the ontology import dialog directly, and **New model**, which holds blank, import and the starter
models. Before, *Import* and *Starter models* were separate buttons that both opened the New model
dialog, and the ontology import could only be reached from `⋯`. A draft, when there is one, still
leads with *Open the draft*.

**Experimental is a tag, not a gap.** `@invana-studio/ui` gains `ExperimentalBadge`, the one tag
for anything shown but not yet launched. The Datasets catalogue's *Collect with an agent* carries
it; the act stays drawn and disabled while the install has no collector agent.
