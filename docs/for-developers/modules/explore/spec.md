# Explore — module spec

The working surface. A canvas draws what is there; the panel says what is selected; the assistant is
reachable from either with the selection already in hand. One page, one rail, one set of gestures —
whatever kind of thing is being drawn.

| | |
|---|---|
| Index | [§4 · Explore](../../README.md#4--explore) |
| Features | [graph-canvas](features/graph-canvas.md) · [canvases](features/boards.md) · [selection-and-the-panel](features/selection-and-the-panel.md) · [the-console](features/the-console.md) · [share-an-answer](features/share-an-answer.md) · [walkthrough](features/walkthrough.md) |
| Depends on | [Ask](../ask/spec.md) (answers land on a canvas) · [Connect and model](../connect-and-model/spec.md) (what the shapes mean) |
| Depended on by | [Work](../work/spec.md) (the Plan canvas) · [Agents](../agents/spec.md) (lineage, envelope) |

System design: [explore.md](../../../../specs/system-design/modules/explore.md) — the six board kinds, the one selection, and the seams (§§ 2 · 3 · 5). This file keeps the vocabulary, what the module owns, its decisions and the drawn states.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Canvas** | a named, saved, versioned drawing surface of a declared kind | a viewport |
| **Canvas kind** | `data · model · plan · workflow · envelope · lineage` | a mode toggle |
| **Selection** | what the canvas currently has picked | a filter |
| **Inspect** | the panel stating a fact about the selection | editing |
| **Assistant** | the one conversational surface, holding the right side with the selection attached | a chat page · a drawer |

## 4. What this module owns

| Owns | Shape |
|---|---|
| Element visibility | hidden is a flag on the node or edge, owned by the rendering package: an edge is effectively hidden when either endpoint is, and showing a node restores an edge only when that edge is not itself hidden and its other endpoint is visible. Studio sets it; it never filters the data to fake it |
| `canvases` | `graph_id` · `name` · `kind` · `settings` · created_by |
| `canvas_states` | autosaved history; restoring forks a new canvas, never an overwrite. *Version* is the user's word for a row, *state* the engine's ([canvases.md](features/boards.md) CV11) |
| Canvas elements | what is drawn and where, per canvas |
| Selection state | client-side, but one shape across kinds |
| Assistant state | which surface opened it, and with what attached |

## 6. Cross-feature decisions

| # | Decision |
|---|---|
| E1 | One page. The kind is a property of the board, not a mode in the header. |
| E2 | Three kinds write from a gesture — `model`, `plan`, and `data` in Edit mode, against the graph's model ([4.7](features/edit-the-graphs-data.md) DE1). `workflow` is read-only ([6.5](../skills/features/instructions-publish-rollback.md#decisions) IS3). Others select. |
| E5 | **The assistant is not an Explore feature.** It is one surface for the whole graph page, reachable from every left panel — Explorer, Model, Projects, Tasks, Agents, Workflows — so it belongs to [Ask](../ask/features/the-assistant.md), not here. Explore's stake in it is only where it sits (E7) and what it inherits (the selection, E3). |
| E7 | The assistant owns the **right side** whenever `?right=assistant`. Inspecting and asking stop competing for it: one param says which of them holds the region, and closing it closes the region rather than restoring the other ([the-assistant.md](../ask/features/the-assistant.md) AD11). |
| E8 | **Two axes, two params.** The left panel is `?panel=`, the right side is `?right=`. They move independently, which is the proof they were never peers — opening the assistant never costs the panel you had open. |
| E9 | **Three regions, three params.** The console is `?console=`, beside `?panel=` and `?right=`. Same reason as E8: regions that can be open at once were never peers. A region's param carries **which occupant** is in it, so a second occupant is a second value rather than a second flag. |
| E10 | **The page is the shell's regions, not a layout of its own.** The Explorer fills `AppLayoutV2`'s `leftSection` · `mainSection` · `rightSection` · `bottomSection` · `footer`; it builds no panel group of its own ([DS12](../platform/features/design-system.md)). A region the shell cannot hold is a gap in the shell. |

## 6a. The drawn states

Hi-fi, at 1440×900, on the *Agents at Work Wireframes* canvas —
`claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4`. The Explorer's own
screens sit on the **Hi-fi · finance** page; the assistant's four are on **Wireframes**,
where the decision was argued. The three `explore.canvas.third_party_node*` rows are on *The Assistant Speaks* canvas — `https://claude.ai/artifact/HdXWfPfwoES9CKTCpQtH5J`.

| Artboard | Feature | Shows |
|---|---|---|
| Explorer · the canvas | [graph-canvas](features/graph-canvas.md) · [canvases](features/boards.md) | the canvas with its tabs and layers, the status strip naming what is drawn |
| Canvas · layers | [graph-canvas](features/graph-canvas.md) | node and relationship types with counts and visibility |
| Assistant · the shell | [the-assistant](../ask/features/the-assistant.md) | the assistant *is* today's Sessions panel, moved; the trigger in the header's panel controls, after fullscreen; one stable label, and the agent stays named on the composer |
| Assistant · decided | [the-assistant](../ask/features/the-assistant.md) | the assistant taking the right side, and the selection riding above the composer as a chip |
| `explore.canvas.third_party_node` | [graph-canvas](features/graph-canvas.md) GC15 · [selection-and-the-panel](features/selection-and-the-panel.md) SP10 | a Source node, dashed and badged `third-party · internet`, linked `ABOUT` its airport; the Inspector showing its reference, what it says, and **Keep** |
| `explore.canvas.third_party_node.kept` | GC15 · SP10 | kept: still badged after reload, the Inspector naming who kept it and when |
| `explore.canvas.third_party_node.read_only` | GC15 · SP10 | **Keep** disabled for a member who may only read, with the reason under it |

The last artboard also names a cost, and it is worth stating rather than
discovering: the inspector's *editing* job would have to move into the left
panel, because the panel edits and the canvas selects (E3). Nothing moves today —
the inspector states properties and edits nothing — so the assistant takes the right
side without displacing any editing. The day the inspector grows an edit, it
grows it in the left panel.

## 7. Deliberately absent

In [Explore › Not building](../../../../specs/capabilities/explore/product.md).
