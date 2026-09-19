---
"invana": minor
---

A committed stitch writes its edges, and keeps writing them (stitch-models.md C10–C13, ST43–ST50).

A stitch was a rule nobody ran. Declaring wrote a row, committing flipped it to active, the
derived union counted it — and the graph itself never changed, so the traversal the whole
feature exists for returned nothing.

**Committing is what runs the stitch.** One MERGE per rule, joining the key on each side:

```
      44  Country.iso_code = country.code        -[SAME_AS]->
      63  City.code = airport.code               -[SERVED_BY]->
Committed 11 stitch(es) — they are in the union now, and wrote 352 edge(s).
```

A keyed relationship writes its own edge type; an **anchor writes `SAME_AS`**, because *both
nodes stay and queries traverse the link* is only true when there is a link to traverse. A
dataset-sourced relationship writes nothing: its rows are its own fact and arrive with the
dataset. One path, whether the press came from the Stitches drawer or `invana stitches
commit`, and the connection is resolved **before** anything is flipped — a commit that
cannot write fails before it has marked a single row active.

**Every stitch-made edge says so.** `_inv_origin = "stitch"`, the stitch's id, the rule
spelled out (`City.code = airport.code`) and when it was solved. A cross-model edge is
otherwise indistinguishable from a record somebody loaded, and these are not records —
nobody wrote them down, a rule derived them. It is also what makes the rest mechanical:
removing a stitch deletes exactly its own edges, and a re-solve recognises its own work.

**A stitch is standing, not a one-off.** The import run's third step was already called
`stitch`; it now also runs every **active** stitch over the records that import just wrote,
scoped by the job's provenance stamp. Data arriving after a stitch was committed is stitched
as it lands, with nobody re-running anything. Solving is a MERGE, so committing twice,
importing twice, or re-solving writes nothing twice.

**`invana stitches resolve`** counts what each declared stitch matches against the live
database — the question the declare card answers before a stitch exists, asked again after
it does — and reports the edges each one has written. A rule nobody can re-check is a rule
nobody trusts.

**A stitch says where it came from.** `invana stitches apply` writes *from the airways bundle
(R1)* into the row's description, and the Stitches drawer states it after the rule and the
status, so a stitch applied from a file on somebody's laptop is not an anonymous row in a
drawer three people share.
