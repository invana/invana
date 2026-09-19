---
"studio": patch
---

Stitching moves into the Model panel, and the global model becomes a page.

`Links` had a `leftNav` icon and a panel with three sections. Opening it showed nothing — and
nothing was its correct state: every section is empty until a Graph holds **two published
models**, which most do not. An icon that permanently advertises an inert surface is a cost paid
on every screen, by everyone.

The verbs pull in different directions, so they split:

- **Declaring** a link now starts from the node type you already have selected, in the Model
  panel, and `DeclareLinkDialog` arrives with that type pre-filled as the source. Before this it
  opened from exactly one place with both dropdowns empty — so declaring meant leaving the model
  you were looking at and re-picking the type you had just selected. `add` names **both kinds**,
  anchor and relationship, so neither loses its way in.
- **A model's links** list in the Model panel, from **either** side. `Article ≡ Stock` is the
  same fact whichever of the two models is on screen, so both show it.
- **The global model** is a page in `mainSection`. It spans every model, so no model's panel can
  own it.

It also fixes a defect that hid a failed request: the old section rendered
`isLoading || !derived` as one spinner, so a `GET /global-model` that errored span forever with
nothing to act on. The page distinguishes the two and states the error.

The union is **not drawn**. `GlobalType` carries `name`, `models` and `anchored` and no
endpoints, so an edge type in the union does not say what it connects — there is no graph to lay
out. The page states the union instead of inventing a shape for it. Drawing it needs
`source`/`target` on the engine's payload.

Nothing changes in the engine: `/model-links` and `/global-model` are untouched. A stale
`?settings=links` aliases onto `model`, so a bookmark lands on the panel that now holds it.
