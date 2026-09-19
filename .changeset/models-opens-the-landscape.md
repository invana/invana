---
"studio": minor
---

Models opens the landscape (stitch-models.md ST24).

**Switching the `leftNav` to Models draws every model at once.** *All models* was reachable only by pressing "Open all models on one canvas" in the panel's list, which meant the one screen that shows the whole landscape — every published model as a frame, every stitch that crosses one — was the screen most people never saw. It now follows the rule the work panels already follow: the main area belongs to the open panel, and the Models panel's two views each own a canvas. The **list** view's is *All models*; the **detail** view's is that model.

So picking a model replaces the landscape with it, and the breadcrumb back to *Models* returns to the landscape. Closing the page with its X leaves it closed while the list stays open — the list header's icon is how you get it back, and the row that used to ask for it is gone.

**And a solve no longer takes the camera** (ST25). `<ElkLayout>`'s own `end → fitContent` ran on every run, and an altitude flip *is* a run: zooming past the threshold re-fit the view, which dropped the zoom back under the threshold, which flipped the altitude again — the landscape fought every zoom. The canvas owns the camera now: it fits once on open (at the landscape altitude, which is what makes the first sight the whole constellation), re-fits on a new model or stitch only while you are still reading the whole landscape, and on an altitude flip it keeps your zoom and only re-centres — on the map going out, on the frame you were in coming back.

**The layouts themselves are fixed too.** The model canvas laid its types out for the circles rather than for the labels — 90px between joined types, so every name landed on its neighbour — and then a plain fit scaled a four-type model up to 3× to fill the viewport, which is what made the labels collide and pushed the last type off the edge. Types are now separated by the label's footprint, the edge type's name is set smaller than the type names it runs between, and no fit ever zooms past 1:1.

On *All models*, frames no longer overlap: a `shape` size on a group was a floor the renderer applied and the solver never saw, and a model with nothing published was an empty group ELK reserved no space for at all. A frame is now drawn at the size the solver reserved for it, and the fit frames the graph layer rather than the union that included the dot pattern behind it — so the landscape opens centred.

Behind both: the camera follows the **settled** solve. A run the engine stops — a re-registration, a topology change landing mid-solve — resolves like any other with every node still on the origin, and fitting that framed a single point. Registering a layout also stops whatever that id was running, so the run is now started from the registration itself, which is the trigger that cannot be missed.

**The constellation is back.** Below the altitude threshold every frame is supposed to close to its own named tab — it was not closing at all, because collapse is store state and `<GraphLayer data>` *replaces* the drawing rather than patching it, taking that state with it. The drawing was being rebuilt dozens of times a second (`useQueries` hands back a new results array every render), so the altitude was wiped as fast as it was set: the zoom said models, the canvas drew types. The versions are read through `combine` now, the altitude is re-applied whenever the drawing is rebuilt, and a closed frame carries its own look — the model's hue, its name and version legible on the tab, and its own edge types unlabelled, since only a stitch still goes anywhere up there. The threshold moved to 1× so the landscape is read at about 1:1.

**And the models have their names back.** A frame's title was painted in a hardcoded colour, so in the dark theme it was dark on dark — no model was named, open or closed. `<ThemeBridge>` could not reach it: it retints the layer template, and a frame's own style replaces that template. The title reads the theme's text colour live now, and the open frame's wash is strong enough to carry one.
