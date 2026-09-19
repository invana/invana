---
"studio": minor
---

Every model draws on one canvas (docs/for-developers/modules/connect-and-model/features/stitch-models.md, ST14–ST20).

**A model is a group frame, not a drawing convention.** Every published model in a Graph now draws on one canvas as `@invana/graph`'s own group — a node carrying `style.group`, with its node types pointing at it through `parentId`. The frame is a `tabbed-rect`, so the model's name rides the tab *on* its boundary instead of floating over the types inside it. A **stitch is the only edge allowed to cross a frame**, and nothing marks one as such: an edge whose endpoints sit in two different groups is a crossing by construction, and one inside a frame is that model's own edge type.

**Altitude is collapse.** Below the zoom threshold every frame carries the `collapsed` state — a `tabbed-rect` closes to its own tab, so each model reads as one named folder, and the layer re-routes every stitch onto it. Zoom in and the frames open onto the types the same edges always named. There is no second canvas, no second data build, and nothing hidden from the reader: the constellation and the detail are one dataset at two altitudes. A neighbour that stays closed while the model you are in is open is what a *port on the rim* turned out to be.

**It needs no engine change.** *All models* fans out over the models list, each model's **active version** and `…/model-links` — an edge type already names its source and target types, and a link already names both versions and both types. It never calls `…/global-model`, whose `GlobalType` carries no endpoints, so the global-model page stays **stated, not drawn** (ST6). Two surfaces, two questions, two payloads.

**ELK lays the frames out, not d3-force.** Compound-group mode packs a group's members inside its box and lays a collapsed group out as the single node the renderer draws. A `cluster` force only pulls members toward each other; frames that overlap are frames that lie.

One hue per model from the data palette, shared by the frame, every type inside it and its legend row. A model with nothing published still draws — as an empty frame that says so, because a model you cannot see is a model nobody remembers to publish. A stitch that binds a version this canvas is not drawing is counted and named, not silently dropped.

**The surface formerly called Links is called Stitches** (ST13). A person stitches two models together; `model_links` is what the engine stores once they have. The drawer, the crumb and the status line follow; the word *link* keeps its place in `model_links`, `…/model-links` and `model_link.declared`.
