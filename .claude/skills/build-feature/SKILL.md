---
name: build-feature
description: How an Invana feature is built — scope from the feature index and spec, decisions, access, traces, engine standards (Python · FastAPI · uv), tests (unit and end to end, never mocked), changesets and finishing. Use before writing or changing any code in engine/, studio/ or integrations/, and when reviewing such code. Studio and design-kit UI also loads build-studio.
---

# Build a feature

How code is written in this repo. The coder follows it for every story and fix; QA's code review checks against it.
Studio and design-kit work also follows **`build-studio`**. Who may edit what is `.claude/team/TEAM.md` §1 *Edit rights*.

## 1. Scope

**A feature with a spec in `specs/` is governed by it; every other feature by `docs/for-developers/`** until the
product-manager migrates it. `for-developers/README.md` is the feature index; each module folder holds `spec.md` and
one file per feature. When choosing what to build:

1. **Build only what the index lists.** Anything not in `for-developers/README.md` is out of scope, even if
   `docs/system-design.md` describes it.
2. **Respect what is deliberately absent.** Every module spec and feature file ends with a
   "Not building" table. Those are explicit non-goals — do not implement them, do not scaffold for
   them, do not "while I'm here" them.
3. **Read the feature file before writing code.** It carries the user story, capabilities, journeys,
   seams, surfaces and engine shapes. If it is missing something you need, the product-manager adds it
   first — a coder raises it, never writes it.
4. **Build the columns a feature needs.** `API`, `CLI` and `Studio` are tracked separately in the
   index; a feature ships when every column it needs is ✅.
5. **Follow the slice order.** The `Slice` column ties each feature to the Delivery plan. Don't start a
   slice until the prior one's "Done when" is reproducible from a clean checkout.
6. **Don't re-scope silently.** If the scope looks wrong for the task at hand, the product-manager updates the
   feature file and the index first — then the coder implements.
7. **Use the product's words.** `docs/for-developers/terminology.md` pins them, and names the
   ones we do not use. Code, UI copy and docs follow it.

The product split of Studio (Explorer, Modeller, Agents, Projects, Datasets) is planned in `docs/products/`.

## 2. Before code

- Read `CLAUDE.md`, the feature file in `docs/for-developers/modules/<module>/features/`, its module `spec.md`, and its row in `docs/for-developers/README.md`. Build only what the index lists; respect every *Not building* row.
- When the feature has a spec in `specs/products/<product>/features/`, the spec governs: each story's `story.md` is the source of truth — build exactly its acceptance criteria and cite their IDs (`MO-17.2`) in tests and commit messages. A story below `designed` is not built. A gap or a contradiction in the spec goes back to the **product-manager**, not into code.
- **Add your tasks** to the story's `task.md` before the first line of code (`.claude/skills/product-spec/format.md` › *Tasks*): Owner `coder`, one task per commit-sized step — engine, Studio, tests, changeset — each citing the criteria it delivers and the boards it builds, with *Depends on* between them. Every criterion lands in at least one task. Mark each `doing` as you start it and `done` with its commit as evidence. Edit only rows whose Owner is `coder`; a task the story cannot justify is a `raise` row, not a task.
- A missing or wrong feature file blocks the build: a `raise` row to the product manager, who fixes it first. A decision only Ravi can make: stop and ask.
- Find the boards: a spec's stories name them in `## Screens` of each `story.md` and the feature's `boards:`, drawn on the Agent version canvas (`.design/canvas-agent-version/project/<board>.dc.html`). A feature not yet migrated names them in its Surfaces table, in Invana Products (`.design/canvas-products/project/`). Ask the **designer** which components draw them before writing UI.
- Build one story at a time. A surface not yet `built` is kept from users — behind a flag or the *Experimental* label.

## 3. Fix lane

A fix makes the code meet criteria and boards that already exist: cite the criterion IDs it restores in its test and commit. No new spec, no new board. A fix that needs a criterion, a board or an access rule to change stops and goes to the **product manager** as a `raise` row.

## 4. Decisions and traces

Invana helps a person decide (`.claude/team/TEAM.md` §0). Every agent step, source, assumption and actor is recorded by the engine when it happens and served for *How it got here*; Studio never rebuilds a trace. Nothing writes, sends, spends or changes access without the person's yes.

## 5. Access

Every act in the spec's Access table is enforced in the engine by its role (`apps/graphs/roles.py` — a new graph-scoped write route is mapped to its area, or the golden test fails) and drawn in Studio as the boards show for those without it. Never add a role or an area without a `decide` row to Ravi. Specs say *Operator* for the role code calls `viewer`; do not rename it outside migration M1 (`specs/migrations.md`).

## 6. Engine standards (Python 3.14 · FastAPI · uv)

- Async throughout; SQLAlchemy async models; Alembic migrations. No backward compatibility: rename and drop outright, a migration may drop and recreate; every capability and `demos/airways` keep working.
- The engine computes and stores every number when the fact settles; endpoints serve it (rule 13). Tokens, never currency. Lists follow the list contract; a refusal names its rule.
- Module, class and method docstrings are full (usage and design); model and column comments are one or two lines. Never cite a decision id (`WD3`, `SK12`) in code or tests.
- Security: queries take parameters, never string-joined user or graph text; graph data and documents that reach an LLM are data, never instructions; an agent tool that writes, sends or spends waits for the person's yes; secrets are never logged, returned or committed.
- `uv run ruff check .` and `ruff format` clean; import-linter bands hold.

## 7. Rules the code keeps

| Rule | Detail |
|---|---|
| Short on columns, full on modules | Model and column comments are one or two lines — trim the long ones in every file you touch. Module, class and method docstrings stay full: they explain usage and design (`engine/src/invana/core/telemetry/middleware.py` is the model). Code documentation stands alone — never cite a decision id (`TE3`, `(SR7)`) in code or tests. No history ([module-structure.md](../../../docs/for-developers/module-structure.md) §5b). |
| The backend owns every number | Every metric Studio shows — durations, totals, counts, rates, tokens — is computed by the engine **once, when the fact settles**, stored in a column, and served by the API. Studio formats it; it never derives it (no `finished_at − started_at`, no summing step rows, no counting a list to show a total). Performance views and evals read the same stored column, so every surface shows one number. A windowed aggregate (p95 over 7 days, tokens today), a change against a prior period, a rate or a share is computed by the engine from stored columns and returned by its endpoint; a count of a list that may be paged is the API's `total`. Not covered: a count of a small list that is fully on screen (`Bound (3)`, a tab count, a selection), what the canvas draws right now, a live clock on something still running, "3m ago", and a meter's fill. The inventory and its phases are [metrics-are-stored](../../../docs/for-developers/modules/platform/features/metrics-are-stored.md). |
| Cross-platform | The development setup works on every operating system, so community developers can contribute |
| Built together | Engine and Studio are built together, distributed flexibly (one image or separate). |

## 8. Tests

The tests are yours — QA runs them, never writes them. For every capability: engine tests, Studio unit tests and
end-to-end specs on the running stack for every changed screen and journey; the access test both ways; the eval set
of every agent or skill the change touches. Few positive and negative tests per capability, against the graph database, never mocked. Graph-database tests only against an isolated database (`bolt://localhost:27687`), never the live local Neo4j. A change to an agent, skill, prompt, plan or model also runs their eval sets. Report the finished story to the product manager; **QA**'s two passes decide.

- Coverage target: **80%** minimum for engine and Studio. Never mocked unless asked — always against graph databases.

## 9. Finishing

- Every user-facing change gets a changeset in `.changeset/`.
- Name each surface that shipped in your report — the product manager flips its index columns and its row in `the-screens.md`.
- Fix every blocker in QA's reports — tests, code review and design QA — when the product manager sends them back. Write the tests QA's recommendations ask for only when the product manager takes them up and sends them to you.
