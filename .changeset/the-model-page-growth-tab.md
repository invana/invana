---
"invana": patch
---

The model page's **Growth** tab draws records over time — stacked by model at All models, by type at
one — from **count snapshots** written by every act that writes data: introspection, the end of an
import run and a stitch commit (1.8 · MP14 · MP30). The line moves only on a day something wrote,
each write is a mark, and every row names the run that last wrote it and opens it. A model nothing
was counted for says so, with *Bring data in*, instead of drawing a chart of zeros.

A snapshot never fails the act it follows. Degree — max and median, for the supernode signal — is
read as a histogram at introspection and import time (MP31). The Overview's Records tile shows the
change over the window, a type's row its change, and the Database tab warns when data was imported
after the mirror was captured (MP34).

New table `type_count_snapshots` (migration 057). New read:
`GET /api/v1/u/{username}/{graphSlug}/models/insights?model=&window=` — its `growth` slice now;
a slice the engine does not measure is `null` (MP33).
