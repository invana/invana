---
id: PJ-F02
title: Objectives and review
product: PJ
status: idea
personas: [decision-maker, analyst]
stories: [PJ-16, PJ-17]
journeys: [J03]
boards: [projects.project, projects.task, projects.task.thinking, inbox]
nfrs: []
depends_on: [PJ-F01, SE-F07, EX-F07]
---

# Objectives and review

> A project's goal and its *done* are written as short statements an agent can cite and a check can prove; whatever
> waits on a person — a result to accept, a question an agent asked, a pass to judge — reaches them in one list. The
> decisions it helps make: *is this work done, by the criteria we agreed?* — and, when it is not, *which criterion
> failed, and what should happen next?*

## User journey

Journeys this feature is a step of: [J03 · Give an agent work and decide on the result](../../../../journeys/J03-give-an-agent-work-and-decide-on-the-result.md)

```mermaid
flowchart TD
  s([A project › Details]) --> obj["PJ-16 · Objectives and criteria — inherited rules first, read-only"]
  obj --> how{"How is it written?"}
  how -->|one line| one["Type the statement"]
  how -->|a paragraph| para["The assistant proposes candidate objectives and criteria"]
  para --> pick["Accept · edit · discard each"]
  pick -->|nothing found| nf["Says so; the text stays where it was"]
  one --> chk["Pick how it is checked — a query · an agent · a person"]
  pick --> chk
  chk -->|no check| refused["Refused — a criterion names how it is checked"] --> chk
  chk -->|a query that errors or returns nothing| unv["Saved, marked not proven yet"]
  chk --> saved["Saved · every task in the project is judged by it"]
  obj -->|Operator| ro["Read only — acts disabled, naming Can work on projects"]
  saved --> task["A task inherits them, read-only, and may add its own"]
  task --> result["The assignee posts a result"]
  result --> eval["Each query criterion runs · each agent criterion is judged"]
  eval --> nyou["PJ-17 · Inbox › Needs you — questions and passes to judge first, then results"]
  nyou --> kind{"What waits?"}
  kind -->|a result| crit["Each criterion: met · unmet · needs a person, with its evidence"]
  crit -->|Accept| done(["The task is done — by a person, never by an agent"])
  crit -->|Send back with a note on the failing criterion| back["The task is open again; the note is the next instruction"]
  kind -->|a question| ans["Answer it · the run goes on where it stopped"]
  kind -->|a pass to judge| pass["Good enough · Go again with a note"]
  pass -->|Go again| again["Another pass; the note is its input"]
  pass -->|no answer by the deadline| fail["The run fails, naming who was asked; the draft is kept"]
  nyou -->|nothing waiting| calm(["Nothing is waiting on you"])
  nyou -->|Operator| nro["Items read; acts disabled, naming Can work on projects"]
```

```mermaid
sequenceDiagram
  actor A as Assignee (person or agent)
  participant E as Engine
  participant M as AI model
  actor R as Reviewer (Needs you)
  A->>E: posts a result
  E->>E: runs each query criterion
  E->>M: asks each agent criterion, with its prompt
  M-->>E: met · unmet · will not judge
  E-->>R: the result, each criterion with its outcome and evidence
  alt every criterion met
    R->>E: Accept
  else one fails
    R->>E: Send back, a note on the failing criterion
  end
  E-->>R: How it got here opens the run behind the result
```

## Stories

| ID | Story | Status |
|---|---|---|
| PJ-16 | [Say what done means](stories/PJ-16-say-what-done-means/story.md) | idea |
| PJ-17 | [Decide what waits on me](stories/PJ-17-decide-what-waits-on-me/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read a project's objectives, criteria and every outcome | Operator — every member who can see the project | — |
| Add, edit or remove an objective or a project criterion; add a task's own criterion | `contributor` · shown as *Can work on projects* · Admin | Read only; each act disabled, naming *Can work on projects* |
| Accept or send back a result · answer an agent's question on a task · judge a pass | `contributor` · shown as *Can work on projects* · Admin — a person, never an agent | The item reads; its acts are disabled, naming *Can work on projects* |
| A project's rules | SE-F07 — *Can shape the model* | As SE-F07 says |

## States

| State | What the person sees |
|---|---|
| First use | A project with no criteria: *No criteria yet — a task here is accepted by eye*, with *Add an objective* and *Add a criterion*. Needs you with nothing in it: *Nothing is waiting on you*, as good news |
| Empty after a filter | Needs you filtered by kind, agent or age with no match: *Nothing matches*, with *Clear filters* |
| Loading | The Details section and Needs you drawn at once; rows load in place |
| Has data | Objectives, each with the criteria that measure it, then criteria standing alone; Needs you grouped — questions and passes first, then results |
| Failed | The list could not load, saying why, with *Try again*. A criterion whose check could not run reads *needs a person*, with the error under it — never *unmet* |
| Agent working or proposing | The assistant's candidate objectives and criteria from a pasted paragraph, each to accept, edit or discard; an agent criterion being judged reads *checking* |
| No access | Objectives, criteria and every item in Needs you read; every act disabled, naming *Can work on projects* |

## Rules

| Rule | Detail |
|---|---|
| An objective is one statement | On a project, with no body — a paragraph is two objectives |
| A criterion says how it is checked | *A query* (it must return) · *An agent* (a judgement prompt, previewed on a past result) · *A person* (decided at review). One with no check is refused at save |
| Criteria measure objectives, or stand alone | Linking a criterion to an objective is optional |
| A task inherits by reference | A task is judged by its project's criteria, read-only and live — editing a project criterion changes what every open task is judged by. A task may add its own, and may have none |
| A check that cannot run needs a person | A query that errors and an agent that will not judge read *needs a person*, showing the error or the prompt it was given — never *unmet* |
| A check never proven | A query that errored or returned nothing when saved is marked *not proven yet*; it still reaches review and a person decides it |
| Outcomes keep what they judged | An outcome keeps the criterion's statement as it was checked; an edit applies only to results not judged yet |
| Accepting is one deliberate act | Every criterion met still waits for *Accept*; nothing is accepted on its own. A result with no criteria says it is being taken on trust |
| A send-back names its criterion | The note sits on the criterion that failed and becomes the task's next instruction |
| Only a person closes a task | An agent posts results; a person accepts. An agent that judges a criterion gives an outcome, never an acceptance |
| One list of what waits | Needs you holds every item waiting on a person: an agent's question on a task and a pass to judge first, because a run is stopped on each; then results to accept and agents' open proposals (PJ-F03). Approvals before a run acts are AC-F05's; suggested changes EX-F07's — all in the same list |
| A question resumes its run | Answering continues the run where it stopped |
| A pass to judge | *Good enough* settles the loop · *Go again* with a note runs another pass with the note as its input; the item shows what the pass produced, which pass it is, how many remain and the tokens spent. Unanswered by its deadline, the run fails naming who was asked, and the draft is kept; five *Go again* with no *Good enough* fail the run, every pass and note kept |
| Work items only | Needs you lists what an agent or a person raised — never a graph row because data looked odd |
| Shared, and signed | Anyone who can work on projects may act on any item; History says who did |
| Nothing is written to the source | Objectives, criteria and outcomes live in Invana's own store, never in the connected database |
| Leans on | Projects and tasks (PJ-F01) · Rules (SE-F07 — a project's rules sit in its Details, inherited first) · Suggested changes (EX-F07) · the Inbox (GR-F05) · runs and their trace (AG-F03) |

## Data touched

| Record | Read or write |
|---|---|
| Objectives — project, statement, open · met · dropped, order | Write · read |
| Criteria — project or task, the objective it measures, statement, how it is checked, the check, revision | Write · read |
| Criterion outcomes — the criterion and its revision, the statement checked, the task, met · unmet · needs a person, evidence, who checked | Write · read |
| Tasks and their latest run (PJ-F01, AG-F03) | Read · accept or send back |
| Questions and passes waiting in runs | Read · answer |
| History rows of every accept, send-back, answer and judgement (AC-F06) | Write |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in. None of it is built yet.

### Records

| Table | Columns | Notes |
|---|---|---|
| `projects_objectives` | `project_id` · `statement` · `status` (`open` · `met` · `dropped`) · `order` | One statement, no body |
| `projects_criteria` | `scope` (`project` · `task`) · `owner_id` (the project or the task) · `objective_id?` · `statement` · `check` (`query` · `agent` · `person`) · `check_spec` · `revision` | `revision` counts each edit |
| `projects_criterion_outcomes` | `criterion_id` · `criterion_revision` · `statement_at_check` · `task_id` · `state` (`met` · `unmet` · `needs_person`) · `evidence` · `checked_by_kind` · `checked_by_id` | One row per check; no route updates it |

### Reads

| Record | Owner |
|---|---|
| Tasks, their state, and the accept and send-back routes | [PJ-F01](../PJ-F01-projects-and-tasks/feature.md#engine) |
| Runs, their unanswered clarifications and the steps awaiting a verdict | [AG-F03](../../../agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Steps awaiting approval | [AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#engine) |
| Open proposals | [PJ-F03](../PJ-F03-branches-findings-and-decisions/feature.md#engine) |
| Suggested changes | [EX-F07](../../../explore/features/EX-F07-memory-what-past-runs-teach/feature.md#engine) |
| A project's rules, shown beside its criteria | [SE-F07](../../../semantics/features/SE-F07-rules/feature.md#engine) |
| The Inbox that draws Needs you | [GR-F05](../../../../os/graph/features/GR-F05-the-inbox/feature.md#engine) |
| History | [AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine) |

### Routes

| Route, after `/api/v1/u/{u}/{g}/projects` | Does | Story |
|---|---|---|
| `/{key}/objectives` | A project's objectives — list, add, edit, remove | PJ-16 |
| `/{key}/criteria` | A project's criteria — list, add, edit, remove | PJ-16 |
| `/tasks/{id}/criteria` | A task's own criteria, after the project's | PJ-16 |
| `/tasks/{id}/outcomes` | The outcome each criterion was judged to | PJ-17 |
| `GET /review?kind=…` | Needs you — the derived list, filtered by kind | PJ-17 |

| Route, outside `projects` | Does | Story |
|---|---|---|
| `POST /api/v1/u/{u}/{g}/agents/runs/{id}/steps/{step_id}/verdict` | Judge a pass — on the run's step ([AG-F03](../../../agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine)), never on a task | PJ-17 |

### Events

| Event | When |
|---|---|
| `projects.objectives.*` · `projects.criteria.*` | An objective or a criterion is added, edited or removed |
| `projects.criteria.evaluated` | A criterion is checked against a result |
| — | Needs you adds none: each act writes its own subject's event |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 403 | A write by someone without *Can work on projects* | *This needs Can work on projects — ask {owner}.* | PJ-16.15 · PJ-17.17 |
| 422 | A criterion with no check | *A criterion says how it is checked — a query, an agent or a person.* | PJ-16.3 |
| 403 | An agent accepts a result | [PJ-F01 › Refusals](../PJ-F01-projects-and-tasks/feature.md#refusals) | PJ-17.16 |

### CLI

| Command | Does |
|---|---|
| — | No command of its own |

### Mechanisms

| Mechanism | How |
|---|---|
| Criteria a task is judged by | The project's `projects_criteria` rows (`scope = project`), read live, then the task's own (`scope = task`) |
| A check that cannot run | Writes `state = needs_person`, with the error or the prompt as `evidence` |
| Accept carries outcomes | `POST /tasks/{id}/accept` carries the per-criterion outcomes it accepted, so plan verification gets which criterion was met — not a binary signal |
| Needs you is derived | `GET /review` owns no rows: unanswered clarifications, steps awaiting approval, steps awaiting a verdict, open proposals and tasks in `review`. Each act — answer, accept, send back, judge, accept or reject a proposal — writes to its own subject |
| A verdict is not a result | A verdict posts to the run's step and decides whether a loop goes round again; its note is bound into the loop's next pass as its feedback. The runtime suspends the run and draws no surface of its own |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Three tables in Invana's own store; no new store | — |
| § 8 APIs and events | The routes and events above | — |
| § 10 AI and agents | Agent criteria judged by a model; a pass judged by a person feeds the loop's next pass | — |

## Decisions

| Decision | Detail |
|---|---|
| Goals belong to a project | A Graph has rules, not goals; objectives and criteria sit on a project |
| Statements, not paragraphs | Prose is an input: a pasted paragraph becomes candidates a person accepts; nothing stores a paragraph of *done* |
| Review is Inbox › Needs you | There is one place for what waits on a person; Projects adds its kinds to it rather than a queue of its own |
| A revision, not versions | A criterion carries a revision; its outcomes keep the statement they judged |
| A proposal waits like a result | An agent's open proposal is listed in Needs you with the results; accepting or rejecting it is PJ-F03's act on its branch |
| Rules are SE-F07's | A project's working rules are written and checked as SE-F07 says; this feature shows them, inherited first, beside the criteria |

## Open questions

| Question | Who answers |
|---|---|
| Does a query criterion re-run on every result, or only when asked? Recommend: on every result — the reviewer sees fresh evidence without asking | Ravi |
| Do a project's rules need a priority, or is their `order` enough? Recommend: `order` is enough — the rule records keep an `order` and no priority, and a blocking rule refuses whatever its place (SE-F07 owns the rules) | Ravi |
| Is an objective closed by hand, or only by its criteria being met? Recommend: by hand, with its criteria's outcomes shown — an objective can be met by work no criterion measures | Ravi |

## Not building

| Item | Why not |
|---|---|
| Waivers on a criterion | A waiver is a policy decision; a criterion is met, unmet or needs a person |
| Weights, scores and pass thresholds | A criterion is met or it is not |
| Editing an inherited criterion on a task | Narrowing is adding the task's own |
| Criteria on a Graph | A Graph states rules; goals live with the work |
| Assigning a review item to one person | The list is shared; History says who acted |
| Accepting many results at once | Acceptance is per result, with its evidence |
