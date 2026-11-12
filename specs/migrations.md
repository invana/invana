# Migrations waiting to be done

Changes Ravi has agreed to that are not yet made. Each becomes a spec and goes through the spec flow — specified, designed, built, verified —
when it is picked up. Until then, specs and designs use the target words; code keeps the current ones.

| # | Migration | Target | Current | Scope | Status |
|---|---|---|---|---|---|
| M1 | Rename the `viewer` Graph role to **operator** | `GraphRole.operator`, the managed access rule `operator`, *Operator* on screen | `viewer` in code and stored data | Engine 17 files · engine tests 6 + the golden route table · Studio 17 · docs 25 · one migration rewriting stored member roles and the managed policy name · no aliases | Agreed — not started |
| M2 | Move every product doc into `specs/` | One folder per feature, one per story (`story.md` · `task.md`), in the standard format | Moved: 5 products and the 3 foundation parts · 41 features · 158 stories · journeys J01–J05 · [system design](system-design.md). `docs/for-developers/`, `docs/products/` and `docs/system-design*` are gone: the domain terms are in [the glossary](glossary.md#domain-terms), the Studio build docs in [design-language.md](design-language.md) and the features that own each canvas. Every other old doc is merged into the live spec that owns it, or retired, and deleted: `_stale/` holds only its `README.md` and `code.md` (the code paths still to delete), and no doc | Nothing left to pull back | Done |
| M3 | Restructure the specs to the pillars and the operating system | `specs/capabilities/` for the five capabilities; `specs/os/` with Graph `GR` · Access `AC` · Runtime `RT`, their stories re-cut from Shell, Settings and Inbox with new ids; Inbox's *Running* folded into Agents › Runs | `specs/products/` · `specs/foundation/` with Shell `SH` · Settings `ST` · Inbox `IN` | Specs · `check.py` · skills · edit rights · engine docstrings and the golden file · docs · no aliases · the map is [M3 — old→new ID map](#m3--oldnew-id-map) | Map approved · specs moved to `os/` and `capabilities/` — code, skills, edit rights and docs to follow |
| M4 | Restore what the old docs held into the live specs | Every item the old docs held lives once in the live spec that owns it — restored, retired in a *Not building* or Decisions row, or decided from the code; every repeated fact has one home | 465 numbered gaps from eight fidelity audits of the old docs at commit `0236fa8d2d04` | Specs only · the map is [M4 — the old docs and their live homes](#m4--the-old-docs-and-their-live-homes) | Done |
| M5 | Name the code after the products | Engine modules `semantics` (modeller · semantic · standards) · `records` · `explore` (explorer · boards · sessions) · `projects` (work) · `access` (iam · govern) · `runtime` (flows · workers · llm · llm_providers · mcp_server); Studio and the board areas follow | The old module names; `datasets` code with no product | Engine modules, their tests and the golden files · Studio packages · boards. Code is frozen on these modules until the specs pass the check | Agreed — not started |
| M6 | Bring the Projects engine to its `## Engine` sections | [PJ-F01](capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine)–[PJ-F05](capabilities/projects/features/PJ-F05-project-reports/feature.md#engine): reserved keys `tasks` · `decisions` · `review`; the agent function `projects.tasks.claim` and events `projects.tasks.claimed` · `projects.tasks.claim_lapsed`; `GET /api/v1/projects/types`; a task's state derived, never stored; the summary counts `loads` and `records_saved`; cites and simulation inputs are loads | No reserved keys; no claim function or route listing types; a stored task status; the summary counts `datasets`; cites and inputs are dataset versions | Engine `work` module, its tests and the golden route table · Studio's Projects package. After M5 | Agreed — not started |

## M3 — old→new ID map

Paths are under `specs/`. OS stories are numbered from 01 within each prefix, in the order of the new features; a story
keeps its slug. Content moves unchanged but for IDs and links.

### The capabilities

| Capability | Old path | New path |
|---|---|---|
| MO Model | `products/model/` | `capabilities/semantics/`, as SE Semantics |
| DA Data | `products/data/` | `capabilities/records/`, as RC Records |
| DS Datasets | `products/datasets/` | Retired — its standards stories are in `capabilities/semantics/`, its load stories in `capabilities/records/` |
| AG Agents | `products/agents/` | `capabilities/agents/` |
| EX Explore | `products/explore/` | `capabilities/explore/` |
| PJ Projects | `products/projects/` | `capabilities/projects/` |

IDs inside the capabilities do not change, but for IN-06 joining AG-F03 as AG-45.

### The operating system — products

| Old | Old path | New | New path |
|---|---|---|---|
| SH Shell · ST Settings · IN Inbox | `foundation/shell/` · `foundation/settings/` · `foundation/inbox/` | GR Graph | `os/graph/` |
| | | AC Access | `os/access/` |
| | | RT Runtime | `os/runtime/` |

### The operating system — features

| New | Feature | Stories | From |
|---|---|---|---|
| GR-F01 | Open a graph | GR-01 – GR-03 | SH-F01 Sign in and start, less sign-in |
| GR-F02 | Create a graph | GR-04 – GR-07 | SH-F02 |
| GR-F03 | Find your way — modes, crumbs, ⌘K, no access | GR-08 – GR-12 | SH-F03 |
| GR-F04 | This graph — name, connection, members, usage | GR-13 – GR-15 | ST-F01 |
| GR-F05 | The Inbox — what needs me, and notifications | GR-16 – GR-17 | IN-F01 Needs you, less the asks |
| AC-F01 | Sign in, account and sessions | AC-01 – AC-02 | SH-F01 sign-in · ST-F03 You |
| AC-F02 | Access rules | AC-03 – AC-08 | ST-F02 People and access |
| AC-F03 | Groups, keys and who holds a rule | AC-09 – AC-11 | ST-F02 People and access |
| AC-F04 | What an agent may touch | AC-12 – AC-14 | ST-F02 People and access |
| AC-F05 | Asks and approvals | AC-15 | IN-F01 Needs you, the asks |
| AC-F06 | History | AC-16 – AC-17 | IN-F03 |
| RT-F01 | AI models | RT-01 | ST-F05 |
| RT-F02 | Plugins and outside tools | RT-02 – RT-04 | ST-F04 |
| RT-F03 | Workers and the queue | RT-05 – RT-10 | ST-F06 Workers and limits, the workers and the queue |
| RT-F04 | Limits | RT-11 – RT-14 | ST-F06 Workers and limits, the limits |
| AG-F03 | Runs and how the agents are doing | gains AG-45 | IN-F02 Running |

### The stories

| Old | Old path | New | New feature | New path |
|---|---|---|---|---|
| SH-02 | `foundation/shell/features/SH-F01-sign-in-and-start/stories/SH-02-open-a-graph-i-can-reach/` | GR-01 | GR-F01 | `os/graph/features/GR-F01-open-a-graph/stories/GR-01-open-a-graph-i-can-reach/` |
| SH-19 | `foundation/shell/features/SH-F01-sign-in-and-start/stories/SH-19-start-an-empty-install-from-a-question/` | GR-02 | GR-F01 | `os/graph/features/GR-F01-open-a-graph/stories/GR-02-start-an-empty-install-from-a-question/` |
| SH-24 | `foundation/shell/features/SH-F01-sign-in-and-start/stories/SH-24-see-only-what-works-with-no-graph-open/` | GR-03 | GR-F01 | `os/graph/features/GR-F01-open-a-graph/stories/GR-03-see-only-what-works-with-no-graph-open/` |
| SH-03 | `foundation/shell/features/SH-F02-create-a-graph/stories/SH-03-see-what-is-left-before-the-graph-answers/` | GR-04 | GR-F02 | `os/graph/features/GR-F02-create-a-graph/stories/GR-04-see-what-is-left-before-the-graph-answers/` |
| SH-21 | `foundation/shell/features/SH-F02-create-a-graph/stories/SH-21-create-a-graph-in-one-modal-of-steps/` | GR-05 | GR-F02 | `os/graph/features/GR-F02-create-a-graph/stories/GR-05-create-a-graph-in-one-modal-of-steps/` |
| SH-25 | `foundation/shell/features/SH-F02-create-a-graph/stories/SH-25-start-from-a-graph-database-that-already-holds-data/` | GR-06 | GR-F02 | `os/graph/features/GR-F02-create-a-graph/stories/GR-06-start-from-a-graph-database-that-already-holds-data/` |
| SH-26 | `foundation/shell/features/SH-F02-create-a-graph/stories/SH-26-start-from-files-with-an-empty-database/` | GR-07 | GR-F02 | `os/graph/features/GR-F02-create-a-graph/stories/GR-07-start-from-files-with-an-empty-database/` |
| SH-04 | `foundation/shell/features/SH-F03-find-your-way/stories/SH-04-switch-mode-and-keep-the-open-graph/` | GR-08 | GR-F03 | `os/graph/features/GR-F03-find-your-way/stories/GR-08-switch-mode-and-keep-the-open-graph/` |
| SH-05 | `foundation/shell/features/SH-F03-find-your-way/stories/SH-05-know-where-i-am-and-step-back-up/` | GR-09 | GR-F03 | `os/graph/features/GR-F03-find-your-way/stories/GR-09-know-where-i-am-and-step-back-up/` |
| SH-06 | `foundation/shell/features/SH-F03-find-your-way/stories/SH-06-do-open-or-ask-anything-from-k/` | GR-10 | GR-F03 | `os/graph/features/GR-F03-find-your-way/stories/GR-10-do-open-or-ask-anything-from-k/` |
| SH-07 | `foundation/shell/features/SH-F03-find-your-way/stories/SH-07-make-the-frame-work-my-way/` | GR-11 | GR-F03 | `os/graph/features/GR-F03-find-your-way/stories/GR-11-make-the-frame-work-my-way/` |
| SH-20 | `foundation/shell/features/SH-F03-find-your-way/stories/SH-20-read-without-the-grant-and-see-who-can-act/` | GR-12 | GR-F03 | `os/graph/features/GR-F03-find-your-way/stories/GR-12-read-without-the-grant-and-see-who-can-act/` |
| ST-12 | `foundation/settings/features/ST-F01-this-graph/stories/ST-12-see-and-change-who-is-on-this-graph/` | GR-13 | GR-F04 | `os/graph/features/GR-F04-this-graph/stories/GR-13-see-and-change-who-is-on-this-graph/` |
| ST-13 | `foundation/settings/features/ST-F01-this-graph/stories/ST-13-read-what-this-graph-spends-against-its-limits/` | GR-14 | GR-F04 | `os/graph/features/GR-F04-this-graph/stories/GR-14-read-what-this-graph-spends-against-its-limits/` |
| ST-14 | `foundation/settings/features/ST-F01-this-graph/stories/ST-14-name-describe-and-connect-this-graph/` | GR-15 | GR-F04 | `os/graph/features/GR-F04-this-graph/stories/GR-15-name-describe-and-connect-this-graph/` |
| IN-04 | `foundation/inbox/features/IN-F01-needs-you/stories/IN-04-see-what-needs-me-in-one-inbox/` | GR-16 | GR-F05 | `os/graph/features/GR-F05-the-inbox/stories/GR-16-see-what-needs-me-in-one-inbox/` |
| IN-05 | `foundation/inbox/features/IN-F01-needs-you/stories/IN-05-say-which-events-reach-whom-and-where/` | GR-17 | GR-F05 | `os/graph/features/GR-F05-the-inbox/stories/GR-17-say-which-events-reach-whom-and-where/` |
| SH-01 | `foundation/shell/features/SH-F01-sign-in-and-start/stories/SH-01-sign-in/` | AC-01 | AC-F01 | `os/access/features/AC-F01-sign-in-account-and-sessions/stories/AC-01-sign-in/` |
| ST-15 | `foundation/settings/features/ST-F03-you-account-and-sessions/stories/ST-15-keep-my-account-username-and-sessions-in-order/` | AC-02 | AC-F01 | `os/access/features/AC-F01-sign-in-account-and-sessions/stories/AC-02-keep-my-account-username-and-sessions-in-order/` |
| ST-01 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-01-read-every-access-rule-and-who-holds-it/` | AC-03 | AC-F02 | `os/access/features/AC-F02-access-rules/stories/AC-03-read-every-access-rule-and-who-holds-it/` |
| ST-02 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-02-say-exactly-what-an-access-rule-allows/` | AC-04 | AC-F02 | `os/access/features/AC-F02-access-rules/stories/AC-04-say-exactly-what-an-access-rule-allows/` |
| ST-03 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-03-set-limits-on-an-access-rule/` | AC-05 | AC-F02 | `os/access/features/AC-F02-access-rules/stories/AC-05-set-limits-on-an-access-rule/` |
| ST-05 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-05-draft-an-access-rule-and-see-who-it-changes/` | AC-06 | AC-F02 | `os/access/features/AC-F02-access-rules/stories/AC-06-draft-an-access-rule-and-see-who-it-changes/` |
| ST-06 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-06-read-access-without-the-grant-and-know-who-to-ask/` | AC-07 | AC-F02 | `os/access/features/AC-F02-access-rules/stories/AC-07-read-access-without-the-grant-and-know-who-to-ask/` |
| ST-11 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-11-test-whether-someone-can-do-something/` | AC-08 | AC-F02 | `os/access/features/AC-F02-access-rules/stories/AC-08-test-whether-someone-can-do-something/` |
| ST-08 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-08-grant-a-team-once-with-people-and-groups/` | AC-09 | AC-F03 | `os/access/features/AC-F03-groups-keys-and-holders/stories/AC-09-grant-a-team-once-with-people-and-groups/` |
| ST-09 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-09-mint-a-key-that-acts-as-its-holder-narrowed/` | AC-10 | AC-F03 | `os/access/features/AC-F03-groups-keys-and-holders/stories/AC-10-mint-a-key-that-acts-as-its-holder-narrowed/` |
| ST-10 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-10-see-and-change-who-holds-an-access-rule/` | AC-11 | AC-F03 | `os/access/features/AC-F03-groups-keys-and-holders/stories/AC-11-see-and-change-who-holds-an-access-rule/` |
| ST-07 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-07-see-why-an-agent-can-or-cannot/` | AC-12 | AC-F04 | `os/access/features/AC-F04-what-an-agent-may-touch/stories/AC-12-see-why-an-agent-can-or-cannot/` |
| ST-30 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-30-see-what-an-agent-may-touch/` | AC-13 | AC-F04 | `os/access/features/AC-F04-what-an-agent-may-touch/stories/AC-13-see-what-an-agent-may-touch/` |
| ST-31 | `foundation/settings/features/ST-F02-people-and-access/stories/ST-31-a-blocked-agent-asks-for-more/` | AC-14 | AC-F04 | `os/access/features/AC-F04-what-an-agent-may-touch/stories/AC-14-a-blocked-agent-asks-for-more/` |
| IN-01 | `foundation/inbox/features/IN-F01-needs-you/stories/IN-01-decide-what-an-agent-asks-before-it-acts/` | AC-15 | AC-F05 | `os/access/features/AC-F05-asks-and-approvals/stories/AC-15-decide-what-an-agent-asks-before-it-acts/` |
| IN-02 | `foundation/inbox/features/IN-F03-history/stories/IN-02-read-what-people-and-agents-did-and-prove-it/` | AC-16 | AC-F06 | `os/access/features/AC-F06-history/stories/AC-16-read-what-people-and-agents-did-and-prove-it/` |
| IN-03 | `foundation/inbox/features/IN-F03-history/stories/IN-03-see-every-change-and-compare-two-versions/` | AC-17 | AC-F06 | `os/access/features/AC-F06-history/stories/AC-17-see-every-change-and-compare-two-versions/` |
| ST-28 | `foundation/settings/features/ST-F05-ai-models/stories/ST-28-offer-the-model-versions-agents-may-pin/` | RT-01 | RT-F01 | `os/runtime/features/RT-F01-ai-models/stories/RT-01-offer-the-model-versions-agents-may-pin/` |
| ST-26 | `foundation/settings/features/ST-F04-plugins-and-outside-tools/stories/ST-26-add-an-outside-tool-server-and-let-agents-call-its-tools/` | RT-02 | RT-F02 | `os/runtime/features/RT-F02-plugins-and-outside-tools/stories/RT-02-add-an-outside-tool-server-and-let-agents-call-its-tools/` |
| ST-27 | `foundation/settings/features/ST-F04-plugins-and-outside-tools/stories/ST-27-let-claude-code-and-other-callers-use-this-graph/` | RT-03 | RT-F02 | `os/runtime/features/RT-F02-plugins-and-outside-tools/stories/RT-03-let-claude-code-and-other-callers-use-this-graph/` |
| ST-29 | `foundation/settings/features/ST-F04-plugins-and-outside-tools/stories/ST-29-see-every-plugin-and-turn-a-tool-plugin-on/` | RT-04 | RT-F02 | `os/runtime/features/RT-F02-plugins-and-outside-tools/stories/RT-04-see-every-plugin-and-turn-a-tool-plugin-on/` |
| ST-17 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-17-see-where-work-is-and-why-it-waits/` | RT-05 | RT-F03 | `os/runtime/features/RT-F03-workers-and-the-queue/stories/RT-05-see-where-work-is-and-why-it-waits/` |
| ST-18 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-18-questions-go-before-batch-work/` | RT-06 | RT-F03 | `os/runtime/features/RT-F03-workers-and-the-queue/stories/RT-06-questions-go-before-batch-work/` |
| ST-19 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-19-a-lost-coordinator-costs-seconds-not-runs/` | RT-07 | RT-F03 | `os/runtime/features/RT-F03-workers-and-the-queue/stories/RT-07-a-lost-coordinator-costs-seconds-not-runs/` |
| ST-21 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-21-see-how-many-workers-each-group-needs/` | RT-08 | RT-F03 | `os/runtime/features/RT-F03-workers-and-the-queue/stories/RT-08-see-how-many-workers-each-group-needs/` |
| ST-24 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-24-see-every-worker-and-what-it-is-running/` | RT-09 | RT-F03 | `os/runtime/features/RT-F03-workers-and-the-queue/stories/RT-09-see-every-worker-and-what-it-is-running/` |
| ST-25 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-25-add-workers-on-my-own-machines-with-one-command/` | RT-10 | RT-F03 | `os/runtime/features/RT-F03-workers-and-the-queue/stories/RT-10-add-workers-on-my-own-machines-with-one-command/` |
| ST-16 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-16-set-each-graphs-tokens-runs-at-once-and-workers/` | RT-11 | RT-F04 | `os/runtime/features/RT-F04-limits/stories/RT-11-set-each-graphs-tokens-runs-at-once-and-workers/` |
| ST-20 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-20-see-why-a-run-started-waits-or-was-refused/` | RT-12 | RT-F04 | `os/runtime/features/RT-F04-limits/stories/RT-12-see-why-a-run-started-waits-or-was-refused/` |
| ST-22 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-22-see-each-ai-models-rate-limit-and-what-waits-on-it/` | RT-13 | RT-F04 | `os/runtime/features/RT-F04-limits/stories/RT-13-see-each-ai-models-rate-limit-and-what-waits-on-it/` |
| ST-23 | `foundation/settings/features/ST-F06-workers-and-limits/stories/ST-23-know-why-my-run-is-held-and-ask-for-more/` | RT-14 | RT-F04 | `os/runtime/features/RT-F04-limits/stories/RT-14-know-why-my-run-is-held-and-ask-for-more/` |
| IN-06 | `foundation/inbox/features/IN-F02-running/stories/IN-06-see-what-is-running-and-what-just-ran/` | AG-45 | AG-F03 | `capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/stories/AG-45-see-what-is-running-and-what-just-ran/` |

| Count | SH | ST | IN | Total |
|---|---|---|---|---|
| Stories mapped, each once | 13 | 30 | 6 | 49 |

## M4 — the old docs and their live homes

Old paths are under `for-developers/` at commit `0236fa8d2d04` unless they start `docs/`. An item is one numbered
PARTIAL or MISSING gap of an audit; the items each audit found already live, or retired, are not counted. *Elsewhere*
is an item whose home is not a spec — a team file or CI, raised as a recommendation — or one that needs no change.

| Old area | Old files | Live home | Items | Restored | Retired | Found | Decided | Elsewhere |
|---|---|---|---|---|---|---|---|---|
| Studio | `building-studio/` (8 files) · six placeholder outlines (`docs/studio/*`, `docs/development/rfcs.md`) | [System design](system-design.md) · [design-language.md](design-language.md) · [glossary.md](glossary.md) · [SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md#decisions) · [AG-F04](capabilities/agents/features/AG-F04-skills/feature.md) · [AG-F06](capabilities/agents/features/AG-F06-plans-and-functions/feature.md) | 74 | 68 | 2 | 2 | 0 | 2 |
| Connect, bring data in, connectors, govern | `modules/connect-and-model/` · `modules/bring-data-in/` · `modules/graph-connectors/` · `modules/govern/` | [Semantics](capabilities/semantics/product.md) · [SE-F02](capabilities/semantics/features/SE-F02-change-and-publish-a-model/feature.md#engine) · [SE-F07](capabilities/semantics/features/SE-F07-rules/feature.md#engine) · [SE-F09](capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md#engine) · [RC-F02](capabilities/records/features/RC-F02-bring-records-in/feature.md#engine) · [System design § 8](system-design.md#8-apis-and-events) | 47 | 45 | 0 | 0 | 2 | 0 |
| Agents, skills, workflows | `modules/agents/` · `modules/skills/` · `modules/workflows/` | [AG-F01](capabilities/agents/features/AG-F01-build-an-agent/feature.md) · [AG-F02](capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md#engine) · [AG-F04](capabilities/agents/features/AG-F04-skills/feature.md#engine) · [AG-F06](capabilities/agents/features/AG-F06-plans-and-functions/feature.md#engine) | 39 | 38 | 1 | 0 | 0 | 0 |
| Ask, memory, explore | `modules/ask/` · `modules/memory/` · `modules/explore/` | [Explore](capabilities/explore/product.md) · [EX-F03](capabilities/explore/features/EX-F03-ask-a-question/feature.md#engine) · [EX-F07](capabilities/explore/features/EX-F07-memory-what-past-runs-teach/feature.md#engine) · [EX-F01](capabilities/explore/features/EX-F01-the-board-and-its-canvas/feature.md#engine) | 49 | 47 | 1 | 0 | 1 | 0 |
| Identity and platform | `modules/identity-and-access/` · `modules/platform/` | [Access](os/access/product.md) · [AC-F02](os/access/features/AC-F02-access-rules/feature.md#engine) · [Runtime](os/runtime/product.md) · [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md#engine) · [System design § 12](system-design.md#observability) | 75 | 69 | 2 | 2 | 2 | 0 |
| Operate, work, building the engine | `modules/operate/` · `modules/work/` · `building-engine/` | [Projects](capabilities/projects/product.md) · [AG-F06](capabilities/agents/features/AG-F06-plans-and-functions/feature.md#engine) · [AG-F01](capabilities/agents/features/AG-F01-build-an-agent/feature.md#engine) · [AC-F06](os/access/features/AC-F06-history/feature.md#engine) · [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md#engine) | 89 | 76 | 4 | 7 | 1 | 1 |
| Products and system design | `docs/products/` · `docs/system-design*` · the top-level `for-developers/` files | [Records](capabilities/records/product.md) · [System design](system-design.md) · [SE-F09](capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md#engine) · [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md) | 68 | 42 | 15 | 9 | 0 | 2 |
| The remainder | `migration-plan.md` §10–§24 · `task-model-migration.md` · `building-engine/refactor-plan.md` §2–§6 · `modules/operate/features/see-what-ran.md` SR1–SR78 · eight placeholder files | [AG-F01](capabilities/agents/features/AG-F01-build-an-agent/feature.md#engine) · [AG-F06](capabilities/agents/features/AG-F06-plans-and-functions/feature.md#engine) · [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md#engine) · [AG-F03](capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md) | 24 | 22 | 0 | 0 | 0 | 2 |
| **Total** | | | **465** | **407** | **25** | **20** | **6** | **7** |

### What M4 decided

| Decision | Stated in |
|---|---|
| C1 · A username is 2 to 64 characters and only `u` is reserved | [AC-F01](os/access/features/AC-F01-sign-in-account-and-sessions/feature.md#decisions) |
| C2 · An agent is a member of a Graph with no Graph role; its membership is `agents_members` | [GR-F04](os/graph/features/GR-F04-this-graph/feature.md#decisions) |
| C3 · The floor Graph role is `operator`; the code's `viewer` waits on M1 | [GR-F04 › Mechanisms](os/graph/features/GR-F04-this-graph/feature.md#mechanisms) |
| C4 · A publish approval's impact is frozen when the preview settles | [SE-F02 › Mechanisms](capabilities/semantics/features/SE-F02-change-and-publish-a-model/feature.md#mechanisms) |
| C5 · Both query digests always; both texts only when the lens rewrote the query, on the step, never on the touch | [SE-F09 › Mechanisms](capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md#mechanisms) |
| C6 · C8 · Board kinds are six drawn and twelve declared, no `agent` kind; the glossary links the one list | [EX-F01 › Mechanisms](capabilities/explore/features/EX-F01-the-board-and-its-canvas/feature.md#mechanisms) · [glossary.md](glossary.md) |
| C7 · The engine's word for a link between models is `stitch` — plan keys, catalogue keys, the lens address and the CLI | [SE-F06 › Engine](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md#engine) |
| Scale-out keeps its pools — one queue per label and step class, workers clamped to the pool and the Graph's quota, an idle worker drained after 5 minutes | [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md#decisions) |
| KEDA, Auto Scaling, multi-replica orchestrators and a per-mode deployment are not built | [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md#not-building) |
| The goals *Trust* and *Privacy*; the gateway records each AI model call | [SE-F09 › Mechanisms](capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md#mechanisms) · [System design § 12](system-design.md#privacy) |
| Only the gateway calls an AI model and only secrets holds keys — import rules | [System design § 7](system-design.md#7-architecture-and-components) |
| A value from an AI model's output is `origin = llm`; every element Invana writes carries its run, its time and its origin | [System design § 6](system-design.md#6-data-and-storage) |
| The router and specialist roster, the default stance and the Data assistant are retired; the shipped agents are the live set; A2A is 1.0 | [AG-F02](capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md#not-building) · [AG-F01 › Not building](capabilities/agents/features/AG-F01-build-an-agent/feature.md#not-building) · [System design § 11](system-design.md#11-failure-modes-and-the-outside-boundary) · [glossary.md](glossary.md) |
| OpenAPI and Airbyte source adapters are not built — Invana is a destination | [Records](capabilities/records/product.md#not-building) |
| Datasets as CSV files queried with DuckDB are not built | [Records](capabilities/records/product.md#not-building) |
| Signed grants to remote workers and the action-vocabulary policy grammar are not built | [AC-F02](os/access/features/AC-F02-access-rules/feature.md#not-building) |
| Every tool plugin is an MCP server; `web`, `mail` and `science` stay | [RT-F02](os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md#decisions) · [glossary.md](glossary.md) |
| A link between models writes its relationships and withdraws them on removal | [SE-F06 › Engine](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md#engine) · [glossary.md](glossary.md) |
| The generated admin | [System design § 13](system-design.md#13-delivery-and-operations) |
| The `start.*` and `shell.*` boards take their package names, below | Every story's `## Screens`, every feature's `boards:`, journeys J01 · J02 · J05 |

### The board rename

| Old | New |
|---|---|
| `start.signin` | `access.signin` |
| `shell.locked` | `access.locked` |
| `start.home` | `graphs.home` |
| `start.new_graph` · `.connect` · `.files` · `.shape` · `.invite` · `.ready` | `graphs.new_graph` · `.connect` · `.files` · `.shape` · `.invite` · `.ready` |
| `start.graph_picker` | `graphs.graph_picker` |
| `start.setup` | `graphs.setup` |
| `shell.command` | `graphs.command` |
| `shell.launcher` · `.open` · `.platform` | `graphs.launcher` · `.open` · `.platform` |
| `shell.graph.new.*` · `.team` · `.review` | `graphs.new_graph.*` · `.team` · `.review` |
