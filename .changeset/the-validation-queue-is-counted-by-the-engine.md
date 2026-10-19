---
"invana": patch
---

The Datasets product's counts are the engine's.

- **Validation** reads one queue, `GET /api/v1/datasets/validation`, instead of asking every dataset for its standards. *N to review* is now every violation on every readable dataset's current version — a claim with more than 50 violations counts them all, where it used to count only the 50 it lists.
- **Provenance** counts the records whose origin differs from the dataset over the whole version (`?provenance=true` on a version's records), instead of the first 1,000 records; the first 100 are listed.
- **A dataset's Overview** shows its lowest conformance score from `lowest_score` on its standards list.
- **The catalogue's standard filter, the standards library's *N datasets claim it* and a standard's *Used by*** read one install-wide list, `GET /api/v1/datasets/claims` (`?standard=` narrows it), with `total` and the claims per standard.
