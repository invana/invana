# Skills dashboards — three declared boards

**What `More` opens from the Skills stack.** The drawer stays the 420px overview; a dashboard is the
page you open deliberately when the drawer is not enough ([CV14](../modules/explore/features/boards.md)).
Three declared kinds ship here — `skill`, `skill_usage`, `rule` — each a `DashboardSpec` composed from
one read, laid out by `@invana/dashboard`, bound to one record through `subject_id`.

| | |
|---|---|
| Ships | [6.1 Authoring](../modules/skills/features/authoring-a-skill.md) · [6.3 Usage](../modules/skills/features/usage.md) · [6.4 Rules](../modules/skills/features/rules.md) |
| Registry | [boards-migration § 5](../building-engine/boards-migration.md) — `apps/boards/kinds.py` and `boardKinds.ts` go from ten kinds to thirteen |
| Drawn from | [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) — the drawers `SkillsPanel` · `SkillFlow` · `SkillVersions` · `SkillUsage` · `UsageVersions` · `UsageReadings` · `UsageSeams` · `RulesPanel` · `RuleCited` |
| Drawn as | the boards themselves — `SkillDash` (S6) · `SkillDashDraft` (S7) · `UsageDash` (U5) · `UsageDashStates` (U6) · `RuleDash` (RL5), rows [34r–34t](../the-screens.md) |
| Pattern | `runDashboardSpec` / `stepDashboardSpec` ([see-what-ran SR30](../modules/operate/features/see-what-ran.md)) — a pure function of one read, nothing fetching, nothing rendering |
| Not in scope | authoring a dashboard, a panel Studio invents at runtime, and a dashboard for `bindings` — the Bindings tab is a picker, and a picker is not a reading |

---

## 1. Why a dashboard, when there is already a drawer

The Skills stack answers *which skill* in 420px. Every question that needs two numbers side by side —
*is this playbook being applied, and by whom* — is a table the drawer cannot draw without becoming a
dashboard in a column.

| Question | Where it is answered |
|---|---|
| Which skill? What does it say? | the drawer — unchanged |
| What will this playbook engage? | the drawer's **Flow** tab — unchanged ([SK16](../modules/skills/features/authoring-a-skill.md#decisions)) |
| What is this skill, whole — prose, flow, versions, bindings, headline usage | **`skill`** dashboard |
| Is it applied, by whom, in which outcomes, and what does the gap mean | **`skill_usage`** dashboard |
| Was this statement offered, cited, and where | **`rule`** dashboard |

**A dashboard never replaces the drawer.** Opening one leaves the stack where it was, so *Retune*'s
rule holds here too: the reading opens in `mainSection` and the panel that opened it stays beside it.

---

## 2. The three kinds

| Kind | `subject_id` | Reads | Opened from |
|---|---|---|---|
| `skill` | a `skills.id` | `GET …/skills/{id}` · `…/versions/{v}/tasks` · `…/versions` · `…/agents` · `…/usage` | `More` on the Skills drawer, drilled in |
| `skill_usage` | a `skills.id` | `GET …/skills/{id}/usage` | `Usage…` on the `skill` dashboard, and `More` on the drawer's **Usage** tab |
| `rule` | a `rules.id` | `GET …/rules/{id}/citations` (+ the rule from the list) | `More` on the Rules drawer, drilled in |

### SD1 · `skill_usage` is addressed by the skill, not by a version

`subject_id` is the **skill's** id on both skill kinds. The usage read returns every published
version in one document ([US3](../modules/skills/features/usage.md#decisions)), and the page's whole
job is reading one count against the next — so a board per version would be seven boards of one
reading, each holding a seventh of it, and the version bar would have to open a tab to move.

The version is therefore a **view**, not an address: it rides the spec's segmented action like
`Dashboard ¦ spec.json` does, and the tiles redraw. What the surface may never do is sum across
versions — *2,786 offers exist across seven texts, and that total is drawn nowhere*
([US3](../modules/skills/features/usage.md#decisions)).

### SD2 · A `skill` board and a `skill_usage` board share an id and are not the same page

`skill:skl_2c91` and `skill_usage:skl_2c91` both name one skill, which the page id parser already
allows — `kind` is the axis, `subject_id` is the record ([B3](../building-engine/boards-migration.md)).
They split by tense: the `skill` board is **what this playbook is and what it will engage**, drawn
from the plan; the `skill_usage` board is **what happened when it was offered**, drawn from
`task_runs`. One is declared, the other is recorded — the same pair the layer strip reads in two
tenses ([SK16](../modules/skills/features/authoring-a-skill.md#decisions)).

### SD3 · A declared board carries no run, so `OpenBoard.runId` becomes optional

`run`, `task_run` and `compare` all read one trace, so the host has carried `runId` on every open
board. A skill has no run. Rather than inventing one, `runId` is now optional on the record and the
three trace-reading kinds are the only ones that set it — which is what `subject_id` was for.

---

## 3. `skill` — the panel set

One row per band, in the order the drawer's tabs are read. Every panel with nothing behind it is
**absent, not empty** ([SR34](../modules/operate/features/see-what-ran.md)).

| # | Band | Kind | Carries | Absent when |
|---|---|---|---|---|
| 1 | tiles | `metrics` | `Offered` · `Applied` · `The gap` · `Bound to` · `Tasks` | a draft — nothing has been offered a draft ([SK21](../modules/skills/features/authoring-a-skill.md#decisions)) |
| 2 | **When to use** | `text` | the trigger sentence, verbatim | never — a published skill with none says *offered on every ask*; a draft says it is published to nobody ([SD10](#sd10--a-draft-has-no-published-text-and-every-band-that-reads-one-says-so)) |
| 3 | **The playbook** | `code` (`plain`) | `content`, as written | the prose is empty |
| 4 | **The flow** | `skillFlow` (registered) | `SkillFlowTab` — the plan in its six bands | never ([SK13](../modules/skills/features/authoring-a-skill.md#decisions)); a draft draws the band and says nothing is published ([SD10](#sd10--a-draft-has-no-published-text-and-every-band-that-reads-one-says-so)) |
| 5 | **Composed** | `list` | one row per `plan.uses`: `nl-single@2` · the rows it wrote · *a newer version exists* | the plan inlines nothing ([SK34](../modules/skills/features/authoring-a-skill.md#decisions)) |
| 6 | **Bindings** | `table` | agent · standing · the refusal's reason | nothing is bound |
| 7 | **Versions** | `table` | version · what changed · origin · offered / applied | a skill with one version still draws it |

**The tiles are the headline and nothing more.** `Offered` and `Applied` come from the usage read's
current-version row; the breakdowns do not appear here at all — `Usage…` opens the board that is
for them. A skill dashboard that grew a by-agent table would be the usage board with a playbook on
top of it.

### The actions

| Id | Label | What the page does |
|---|---|---|
| `view` | `Dashboard ¦ spec.json` | the same switch every dashboard carries ([SR37](../modules/operate/features/see-what-ran.md)) |
| `open-usage` | `Usage…` | opens `skill_usage:<id>` |
| `open-agent` | a Bindings row | opens the agent in the Agents panel |
| `open-version` | a Versions row | selects that version — the flow and the playbook redraw |
| `edit` | `Edit` | puts the drawer back on this skill, drilled in; the board stays open |

`New version` is **not** here. Publishing is an authoring act with a diff to read, and it lives in
the Playbook tab where the prose being published is ([SK6](../modules/skills/features/authoring-a-skill.md#decisions)).
A dashboard that published would be a reading surface with the one write that matters most on it.

---

## 4. `skill_usage` — the panel set

Composed from one `GET …/skills/{id}/usage`. The engine sends counts and says whether they are
readable; **nothing here computes a percentage** ([US6](../modules/skills/features/usage.md#decisions)).

| # | Band | Kind | Carries | Absent when |
|---|---|---|---|---|
| 1 | tiles | `metrics` | `Offered` · `Applied` · `The gap` · `Bound to` | never — this is the board's claim |
| 2 | **Self-reported** | `text` (callout) | *N steps said they used it. Nothing checks they used it well* | `applied` is 0 |
| 3 | **Per version** | `table` | version · offered · applied · gap · enough · what it reads as | never — with nothing published the slot carries the sentence instead of empty headings ([SD10](#sd10--a-draft-has-no-published-text-and-every-band-that-reads-one-says-so)) |
| 4 | **By agent** | `table` | agent · offered · applied · gap | the current version has no agent rows |
| 5 | **By outcome** | `table` | the run ended · offered · applied · gap | the current version has no outcome rows |
| 6 | **Recent steps** | `list` | run · step · task key · version · applied? · finished — one row per **step** ([SD11](#sd11--a-step-row-is-keyed-by-the-step-and-the-page-resolves-the-run)) | nothing has run |
| 7 | **What each reading means** | `table` | the shape · because · what to do | never — it is what turns the gap into a move |

### SD4 · The gap is `—` twice, and they are different sentences

| State | Tiles read | Because |
|---|---|---|
| `offered = 0` | `0 · 0 · —`, caption *no data yet* | a skill nothing has been offered has no gap, and a gap of zero would read as *applied every time* |
| `enough_to_read: false` | the counts, gap `—`, caption *too few to read* | three offers is three runs, not 33% ([US6](../modules/skills/features/usage.md#decisions)) |

Both draw `—`. Neither draws `0`, and neither draws a percentage. The caption is what tells them
apart, so it is never dropped for space.

### SD5 · The four readings are a panel, not a tooltip

`UsageReadings` puts the gap's four shapes on the surface — *a big gap on one agent · a big gap on
every agent · applied and the run still failed · applied and the run served* — each naming the move
it implies. It is the same table on every skill, which is exactly why it is a band rather than help
text: the number is only worth drawing if the reader knows which of four sentences it is, and a
reading guide behind a hover is a guide nobody reads.

### SD6 · The version bar picks what the breakdowns are of

`by_agent` and `by_outcome` are the **current** version's, which the response states and the panel's
`aside` repeats. Picking an older version in the segmented action redraws the tiles and the Per
version row's selection; the breakdowns then say *only the current version has a breakdown* rather
than silently showing the current one under an older heading.

### SD10 · A draft has no published text, and every band that reads one says so

The board draws the version a step is offered **today**, so a draft arrives at
every band with nothing behind it. Three bands each had a sentence for *empty*
that is true of a published skill and false of a draft, and a refusal that names
the wrong cause is worse than none:

| Band | Said | Says |
|---|---|---|
| **When to use** | *offered on every ask* — what a blank trigger means once published | *nothing published yet; the draft's trigger is in the drawer* |
| **The flow** | *something wrote a version without drawing it — which the engine does not allow* | *nothing published yet; the draft's own flow is in the drawer's Flow tab* |
| **Per version** | column headings over no rows | *nothing is published yet — there is no text for these counts to belong to* |

The version chip reads `draft`, not `v0`, and *an earlier text* is absent rather
than claiming the reader moved off a current version that does not exist. The
drawer keeps its own copy: inside it a version with no plan **is** a fault, which
is why the flow tab's default wording stays and the board passes its own.

### SD11 · A step row is keyed by the step, and the page resolves the run

**Recent steps** and **Where it was cited** are lists of *steps*, and two steps of
one run appear twice — one offered, one applied. Keying a row by `run_id` made
those one key twice, which React collapses, so the window silently drew fewer
rows than the engine sent. The row's id is therefore the step's, the page reads
the run back out of the document it drew, and a step whose root run is gone
carries **no action** rather than an action that opens nothing.

---

## 5. `rule` — the panel set

| # | Band | Kind | Carries | Absent when |
|---|---|---|---|---|
| 1 | **The statement** | `text` | the statement itself, as the page's subject | never — the statement *is* the rule ([RU1](../modules/skills/features/rules.md#decisions)) |
| 2 | tiles | `metrics` | `Offered` · `Cited` · `Never cited` · `Versions` | `Offered` and `Never cited` are absent until the engine sends offers (§ 6) |
| 3 | **The row** | `properties` | statement · kind *(derived)* · scope *(derived)* · order · active · version · citations | never |
| 4 | **Versions** | `table` | version · statement · published · cited | never |
| 5 | **Where it was cited** | `list` | run · version · step · what the step did — one row per citing **step** ([SD11](#sd11--a-step-row-is-keyed-by-the-step-and-the-page-resolves-the-run)) | nothing has cited it |
| 6 | **What is not a rule** | `table` | the statement · because it… · is really | never |

### SD7 · Never cited is a number, and it needs offers to exist

`RuleCited` draws three tiles — offered 1,204, cited 214, **never cited 990** — and the third is the
one [RU7](../modules/skills/features/rules.md#decisions) exists for: *without `rules_offered`, never
cited cannot be told from never offered*. `task_runs.rules_offered` has been written since migration
47 and **nothing has ever read it**. § 6 is that read. Until it lands the two tiles are absent, not
zero — an absent tile says *we do not know*, and `0` would say *it was never offered*.

### SD8 · A per-version citation count is counted by the engine, never off the step list

The citations read returns a bounded, newest-first window of steps and a `total` over every version.
Counting the Versions table's per-version column from that window would be a total taken from a page
wearing the label of a total over the record — the same mistake [usage](../modules/skills/features/usage.md)
names in its Engine table. So the engine returns a count per version beside the statement, and the
surface adds nothing up.

### SD9 · Deactivating stays in the drawer

The dialog that says *what stops* and *what stays* is an act with a consequence to read, and the
Rules drawer already draws it. The dashboard says `active: false` in the row and offers `Edit`,
which puts the drawer back on the rule. One place writes; the board reads.

---

## 6. The engine half — a rule says what it was offered

Three additions, all derived on read like every other count in this module.

| Piece | Shape |
|---|---|
| `TaskRunQuerySet.rule_offer_counts` | the mirror of `rule_citation_counts` over `rules_offered` — one query, one column per key |
| `RuleVersionCitations` | `rule_version_id · version · statement · published_at · cited` |
| `RuleCitationsResponse` | gains `offered: int` and `versions: list[RuleVersionCitations]` |

`offered` counts steps that had **any** version of the rule in context, the same shape as `total`
counts steps that cited any version. Per-version offers are **not** added: an offer is written by
assembly against whatever version was current, so an offer count per version is a fact, but nothing
on the surface asks for it — and a column drawn because it could be is the kind of number nobody can
act on.

---

## 7. What the host changes

| File | Change |
|---|---|
| `apps/boards/kinds.py` | three `_declared` rows and three literal members |
| `boardKinds.ts` | three `DeclaredKindSpec`s; `DeclaredKind` gains three members |
| `GraphDetailPage.tsx` | `OpenBoard.runId` optional ([SD3](#3--skill--the-panel-set)); the `renders: dashboard` branch gains three bodies; the Skills panel gets `onOpenSkillDashboard` · `onOpenUsageDashboard` · `onOpenRuleDashboard` |
| `features/skills/dashboards/` | the three composers, the three pages, one `shared.ts`, one `index.ts` border |
| `SkillsPanel.tsx` · `SkillDetail.tsx` · `RulesDrawer.tsx` | a `More` header action, drilled in only |

**The composers live under `features/skills/`, not under `boards/`.** A dashboard's panels are the
feature's vocabulary — *offered*, *applied*, *cited*, *enough to read* — and the boards folder owns
the page host, the record and the tab strip ([CV7](../modules/explore/features/boards.md)). Operate
holds `run` and `task_run` for the same reason.

---

## 8. Done when

| # | Reproducible from a clean checkout |
|---|---|
| 1 | Skills → a skill → `More` opens a `skill` page in the tab strip, beside the drawer, which stays |
| 2 | Its tiles read `offered · applied · gap` for the current version, and a draft draws no tiles |
| 3 | `Usage…` opens `skill_usage`, whose per-version table draws `too few to read` where `enough_to_read` is false and never a percentage |
| 4 | A skill nothing has been offered reads `0 · 0 · —` with *no data yet* |
| 5 | Rules → a rule → `More` opens a `rule` page: the statement, offered / cited / never cited, the versions with per-version counts, and where it was cited |
| 6 | `spec.json` on all three renders the document the page is |
| 7 | `uv run python -m tests.golden.update` leaves only the three new kinds in `openapi.json` |
| 8 | Each board is drawn on its feature's canvas page, with its refusals — [34r–34t](../the-screens.md) |

## 9. Not building

| Not building | Because |
|---|---|
| A `binding` dashboard | the Bindings tab is a picker — it binds as you click ([BN4](../modules/skills/features/bindings.md)), and a picker is a panel, not a reading |
| Authoring a dashboard per Graph | panels come from a closed set for the same reason the catalogue is one ([CV13](../modules/explore/features/boards.md)) |
| Publishing or deactivating from a dashboard | the act belongs where the thing being changed is written ([SD9](#sd9--deactivating-stays-in-the-drawer)) |
| A report of a skill board | a frozen reading is one version of a board ([C9](../modules/explore/features/boards.md)); nothing has asked to freeze a playbook yet |
| The *outside the lens* tile `SkillUsage` draws | it is a projection of the touch ledger, not of usage ([GV20](../modules/govern/spec.md)) — it belongs to the run, and the board would be reading a second module's record to draw one tile |
| Per-version offer counts | an offer is written against whatever version was current; nothing on the surface asks for the split (§ 6) |
