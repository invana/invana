# Migrations waiting to be done

Changes Ravi has agreed to that are not yet made. Each becomes a spec and goes through the spec flow — specified, designed, built, verified —
when it is picked up. Until then, specs and designs use the target words; code keeps the current ones.

| # | Migration | Target | Current | Scope | Status |
|---|---|---|---|---|---|
| M1 | Rename the `viewer` Graph role to **operator** | `GraphRole.operator`, the managed access rule `operator`, *Operator* on screen | `viewer` in code and stored data | Engine 17 files · engine tests 6 + the golden route table · Studio 17 · docs 25 · one migration rewriting stored member roles and the managed policy name · no aliases | Agreed — not started |
| M2 | Move every product doc into `specs/` | One folder per feature, one per story (`story.md` · `task.md`), in the standard format | Moved: 5 products and the 3 foundation parts · 41 features · 158 stories · journeys J01–J05 · `system-design/`. Left in `docs/for-developers/`, `docs/products/` and `docs/system-design*`: engine detail, plans, debate and retired rows, each listed with why and where it would go in [the review index](../docs/for-developers/README.md) | Ravi reviews the index — keep, move or delete each row; the EX-F05 and EX-F07 sources in `modules/ask` and `modules/memory` are moved but not cut | Moved — leftovers waiting for review |
| M3 | Restructure the specs to the pillars and the operating system | `specs/capabilities/` for the five capabilities; `specs/os/` with Graph `GR` · Access `AC` · Runtime `RT`, their stories re-cut from Shell, Settings and Inbox with new ids; Inbox's *Running* folded into Agents › Runs | `specs/products/` · `specs/foundation/` with Shell `SH` · Settings `ST` · Inbox `IN` | Specs · `check.py` · skills · edit rights · engine docstrings and the golden file · docs · no aliases | Agreed — not started |
