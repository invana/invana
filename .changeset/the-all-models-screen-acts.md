---
"studio": minor
---

The All-models screen acts, not just reads (docs/for-developers/modules/connect-and-model/features/stitch-models.md, ST19 · ST22 · ST23).

**The panel is the Model panel, not a second one (ST22).** Its list view stops being a flat list and becomes the three drawers the screen reads from: **Models**, **Stitches** — every stitch in the Graph, because the staged set is the Graph's and no model is selected here — and **Global model**, collapsed, stating the derived counts with `staged` named beside them rather than inside them. `useStitchesSection` takes a `scope`, so one hook serves both the model's view of its stitches and the Graph's. A second panel that listed models would be a second place that can disagree about them.

**Drag a type onto a type in another model to declare one (ST19).** A palette toggles between *Select* (drag a frame) and *Declare a stitch* (drag a crossing) — they cannot both be live, because both behaviours start on node pointer-down. The drag names both ends, so the dialog opens with the source **and** the target filled in; re-asking for one of them from an empty dropdown is the same sin as re-asking for the source. It is the same dialog the drawer opens (ST11) — the gesture is a second affordance onto one path, never a second path. Nothing is inserted into the store: a stitch is a declared row, not a drawing, so `createEdge` always vetoes.

Two drags that are not stitches say why rather than failing quietly: two types in **one** model ("an edge inside a frame is that model's own edge type, authored on its draft"), and a model with **nothing published** (ST8).

**Altitude is a control (ST23).** The bottom-right track is a `Slider` you drag, and it sets the camera zoom — so it both reports where you are and takes you there, and the frames open and close through the same path the wheel uses. The track is linear in log-zoom, because zoom is multiplicative: half the travel between 0.25× and 4× has to be 1×.

**Removing a stitch asks first**, and the confirm states the consequence: the union stops spanning that pair and a question that crossed it will say so rather than answering from one side — while both node types, both models and every record stay, because an anchor links and never merged anything.

**And the ways in say what they are.** Stitching was reachable before this and unreadable: an unlabelled grid glyph in the Model panel header, two unlabelled glyphs on the canvas, and a Stitches drawer whose only offer — with nothing selected — was a link to a different page. So: the Models drawer carries a labelled *Open all models on one canvas — and stitch between them*; the canvas palette reads across the top with the active tool named beside it (a toolbar toggle is icon-only by contract, so the caption is what makes the gesture an affordance); and the Stitches drawer offers **Declare a stitch** whether or not a type is selected. A selection was never what made declaring possible — it prefills the source (ST11), and the dialog asks for both ends either way.
