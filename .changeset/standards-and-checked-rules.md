---
"invana": minor
---

Standards and conformance, and rules that are checked.

- `POST /api/v1/standards` creates an install-wide standard `publisher/name`; `POST …/standards/{publisher}/{name}/versions` publishes its next version — terms, each with a type and allowed values. Versions are hashed; every standard is readable install-wide.
- `POST /api/v1/datasets/{publisher}/{name}/standards` attaches a standard to a dataset, pinned to one standard version, with a mode: `block · warn · report`. `GET` lists them; `DELETE …/standards/{standard_publisher}/{standard_name}` detaches one.
- Each new dataset version is scored against its attached standards. `GET …/versions/{v}/conformance` reads the score and the violations. `block` refuses a non-conforming version, and refuses attaching `block` over a non-conforming current version; `warn` answers with `warnings` on the dataset, version and binding reads; `report` only records.
- `GET · POST /api/v1/rules` are the install's rules (install Admin writes). A Graph's rule list names them as inherited, and assembly offers them first.
- A rule may carry a check (`dataset.conforms` · `dataset.licence`) and a mode (`block · warn · report`); changing either publishes a new version. Checks run when a dataset is shared and when a version is bound. A blocked act writes nothing; `warn` and `report` record a `rule.check` event.
- `invana standards list · show · apply · attach · detach · check` and `invana rules list · show · apply` do the same from a terminal.
