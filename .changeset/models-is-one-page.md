---
"invana": minor
---

Models is one page. Switching the `leftNav` to Models opens the `models` board: **Overview · Model
· Database · Usage · Performance · Growth**, with a `7 · 30 · 90 days` window on the tab strip,
read at All models or at one model (1.8, MP1–MP5).

**The panel lists; the page acts.**
- A click on a model in the panel scopes the page and keeps its tab.
- `Open` drills into its Node types, Edge types and Stitches, and turns the page to the Model tab.
- `Edit`, `Publish`, `Discard draft`, `Rename`, `Export`, `Archive` and `Introspect` are on the
  page header.
- The staged set is a bar under the header, and `⌘↵` opens the Publish confirm.
- The panel's Staged, Global model and Stitches-at-the-list drawers are gone, and so are the
  separate *All models* and *Global model* pages. The Model tab at All models draws every frame,
  with the union listed beside it.
- The scope, the tab, the window and the drilled panel are in the URL, so a reload lands on the
  same reading.

**Publishing asks first.** The confirm lists the staged changes and each index and constraint the
projection would create, read against the live database. `GET …/models/{id}/draft/projection`
serves it, and it writes nothing (MP20).

**A published model is archived, never deleted (MP7).**
- `PATCH …/models/{id}` with `status: archived` archives it.
- That is refused with `archive_has_active_stitches` while an active stitch binds the model, and
  the refusal names each stitch.
- `DELETE` is refused with `delete_has_published_version` once any version was published.
- An archived model leaves the list and the global model, and its versions still resolve.
  `Show archived` lists it with `Restore`.
- Archiving and restoring emit `model.archived` and `model.restored`.

**Every modeller canvas opens on circles, laid out by ELK (GM3, GM4).** The d3-force layout and the
Layout switch are gone.

Database, Usage, Performance and Growth say *Not measured yet* until the index readers, the query
log and the count snapshots land (MP22).
