---
"invana": minor
---

Datasets: install-wide records with an origin, a licence and immutable, hashed versions.

- `POST /api/v1/datasets` creates `publisher/name` with its origin (`official · collected · generated · observed · derived`) and key column. It starts private, with no version.
- `POST …/datasets/{publisher}/{name}/versions` mints the next version from the records in the body, with its licence and author chain. The version is hashed (`sha256:`), and an identical one is refused as `unchanged`. A record's own `_provenance` is kept only where it differs from the dataset.
- `GET …/versions/{v}/records`, `GET …/records/{key}` and `GET …/records/{key}/history` read a version's records and every version that changed one of them.
- `PATCH …/datasets/{publisher}/{name}` shares a dataset with the install, labels its sensitivity (`public · internal · confidential · personal`; a column may be tighter, never looser) and sets a refresh schedule. None of these is a version.
- A private dataset is absent to everyone but its owner. Only the owner, or an install Admin, writes.
- `GET …/datasets/{publisher}/{name}/history` and `…/history/compare?a=&b=` read the dataset in the change log: who, when and why for each version, its licence, author chain and columns compared, and a records summary (`added · removed · changed`). Its effect after is the loads that bound the version (`basis: "bound"`).
- `POST …/versions/{v}/retract` (install Admin, with a reason) marks a version withdrawn; it stays readable. `GET …/versions/{v}/used` lists the bindings and derived versions that cite it, and every version read names its retracted inputs.
- `POST /api/v1/u/{username}/{graphSlug}/dataset-bindings` binds one version into a model as a node type and opens an ordinary import run over it; `GET` lists the Graph's bindings, each flagged when its version is retracted or a newer one exists. Bound records are written under `INVANA_DATASET_DIR` (default `.invana/datasets`).
- `invana datasets list · show · import · versions · diff · history · share · retract · refresh · bind` does the same from a terminal; `import` and `refresh --now` read a CSV or JSON file.
