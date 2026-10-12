---
"invana": minor
---

Studio's Datasets product reads and writes datasets and standards (datasets.md, standards.md).

- **Catalogue** — every readable dataset, filtered by origin, publisher, standard, licence and the
  Graph that binds it; a row opens the dataset.
- **A dataset** — Overview, Provenance, Records (and one record with its change log), Versions
  (compare, an Admin's retract), Conformance and Used by, each a path level. Its writer can share it
  with the install and add observations by form; anyone who can read it can bind its current version
  into a Graph's model.
- **Standards** — the library, *Write a standard*, one standard with its terms and the datasets that
  claim it, and *Attach a standard* from either side.
- **Validation** — the queue of standard violations on current versions; the dataset's writer fixes a
  value with a reason, published as the next version.

Not built: collecting with an agent, documents datasets and telling the assistant — the engine has
no run or tool for them. A dataset is still created with `invana datasets import`.
