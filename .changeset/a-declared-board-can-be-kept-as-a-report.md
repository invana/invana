---
"invana": minor
---

A declared board can be kept as a report, and a report reopens without reading its subject
(boards-migration.md B6 · B13 · B16 · B18 · B19 · B20 · B12).

**The engine half of B6 landed and the Studio half did not.** `POST …/boards/{kind}/{subjectId}/versions`
and its create-or-get have existed since the routes were written; nothing called them, no surface
offered *Save report*, and `BoardPageId.versionId` was parsed and never read. Every declared board —
`run` · `task_run` · `skill` · `skill_usage` · `rule` — opened live and could never be kept.

- **`services/api/boardReports.ts`**, beside `boardVersions.ts` rather than folded into it: that one
  takes a `board_id`, this one a `(kind, subject_id)` pair, because a live dashboard has no row
  until the first report creates it (B18). What it sends is the **resolved document** — the spec
  with the numbers in it, never the spec plus a subject to re-read (B13).
- **`Save report`** on every declared board's header. The host says which board a page is through
  `DeclaredBoardContext`, so a page gains the act by calling `useReport(spec)` and a composer stays
  the pure function of one read it has to be (B20). The button is appended by the hook and is not
  part of what it saves.
- **`FrozenBoardPage`** — one body for every report, because a frozen reading has no kind to branch
  on: the stored blob is the document (B19). It re-fetches nothing and says which reading you are
  looking at, because a frozen board that did not would be a live one that had quietly stopped
  updating. Every registered panel renderer is handed to it from one map, `DECLARED_PANELS`;
  without that a saved run report drew *No renderer for panel kind `flow`* where its Gantt had been.
- **`?page=`** carries the focused declared board, so `kind:id@version` is a link (B12). B6's own
  criterion is *reopening it an hour later*, and an hour is longer than a tab lives.

**`board_versions` is keyed on `cause`, and Studio was still sending `kind`.** The B7 rename landed
on the engine and not on the client, so every drawn board's autosave posted a body with no `cause`
and the `report` value was missing from the union. A canvas's History has been failing on the wire
since; it posts `cause` now.
