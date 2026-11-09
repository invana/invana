---
id: EX-F07
title: Memory — what past runs teach
product: EX
status: idea
personas: [builder, modeller, analyst]
stories: [EX-29, EX-30, EX-31, EX-32]
journeys: [J02, J04]
boards: [agents.skills, agents.skill, explore.board, agents.run.answer, inbox]
depends_on: [EX-F04]
---

# Memory — what past runs teach

> What carries over from one run to the next: records in the Graph an agent reads with a step it plans, and changes a
> person accepts on the evidence of what happened — so the person decides which skill, plan, rule or criterion to
> change, from counts they can open, and never finds the setup changed behind their back.
> The decision it helps make: *which skill, plan, rule or criterion should change, given what past runs show?*

## User journey

Journeys this feature is a step of: [J02 · Ask and trust the answer](../../../../journeys/J02-ask-and-trust-the-answer.md) · [J04 · Build an agent and improve it from what runs teach](../../../../journeys/J04-build-an-agent-and-improve-it-from-what-runs-teach.md)

```mermaid
flowchart TD
  run([Runs happen]) --> rec["The record: steps · answers · how each ended"]
  rec --> ev["EX-29 · Evidence: offered vs applied · plans that served · criteria never met · rules never cited"]
  rec --> mem[("Records in the Graph · the domain's own kinds")]
  mem -->|a skill says when| rc["EX-30 · Recall: a step reads prior records, cited"]
  rc -->|none| rn(["No prior records for this subject — stated"])
  rc --> ans(["The answer builds on them — EX-F04"])
  ev -->|too few runs| few(["12 runs — too few to read"])
  ev -->|a threshold crossed| sg["EX-31 · A suggested change: its evidence, the difference, what it predicts"]
  sg --> inbox["Inbox › Needs you"]
  inbox --> dec{"EX-32 · The person decides"}
  dec -->|accept · accept with edits| pub["The next version is published"]
  dec -->|reject, with a note| rj(["Closed · the note is evidence"])
  dec -->|no grant| na["Read only — Ask Priya (owner)"]
  dec -->|its base has moved on| st(["Refused · both versions shown"])
  pub --> watch["Watched against what it predicted"]
  watch -->|improved · unchanged| out(["Written on the version"])
  watch -->|worsened| rv["A revert, suggested the same way"]
  rv --> inbox
  watch -->|too few runs| un(["Unmeasured — never called a success"])
```

```mermaid
sequenceDiagram
  participant E as Engine
  participant D as A detector or an agent
  participant I as Inbox
  actor B as Agent builder
  E->>E: counts each run's evidence as it settles
  D->>E: a threshold crossed — offered 40, applied 2
  E->>E: a suggested change: the difference, the runs behind it, what it predicts
  E->>I: Needs you · a suggested change
  B->>I: open it
  I-->>B: the difference · the evidence, each count opening its runs · the prediction
  B->>E: accept (or edit, or reject with a note)
  E->>E: publish the next version · start watching the prediction
  E-->>B: after the window — improved · unchanged · worsened
```

## Stories

| ID | Story | Status |
|---|---|---|
| EX-29 | [See what is failing quietly](stories/EX-29-see-what-is-failing-quietly/story.md) | idea |
| EX-30 | [The next run builds on the last](stories/EX-30-the-next-run-builds-on-the-last/story.md) | idea |
| EX-31 | [A suggested change, with its evidence](stories/EX-31-a-suggested-change-with-its-evidence/story.md) | idea |
| EX-32 | [Accept, edit or reject a suggested change, then see if it helped](stories/EX-32-decide-on-a-suggested-change/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read evidence and open the runs behind a count | Operator — every member | — |
| Read a recall step and its citations | Operator — every member who can read the run | — |
| Say when a skill recalls | `builder` · shown as *Can build agents* | The skill read-only |
| Model the kinds the domain remembers with | `modeller` · shown as *Can shape the model* | The model read-only |
| Read a suggested change | Operator — every member | — |
| Accept, edit or reject a suggested change to a skill, plan, agent or answer template | `builder` · shown as *Can build agents* | Read only — *Ask Priya (owner)* |
| Accept, edit or reject a suggested change to a rule | `modeller` · shown as *Can shape the model* | Read only — *Ask Priya (owner)* |
| Accept, edit or reject a suggested change to a project's criterion | `contributor` · shown as *Can work on projects* | Read only — *Ask Priya (owner)* |

## States

| State | What the person sees |
|---|---|
| First use | No runs yet: Evidence says counts arrive as runs settle; no suggested change waits |
| Empty after a filter | Nothing wrong for that kind and window: Evidence says so — never a board of zeroes; an empty queue says the setup is behaving |
| Loading | Evidence and the suggested change's evidence load with their window named; a recall step reads *Recall ·* its count as it settles |
| Has data | Counts ranked by the size of the gap, each with its window and what its runs share; a suggested change with its difference, evidence and prediction |
| Failed | A suggested change refused because its base moved on, both versions shown; a recall step that failed, named on the step |
| Agent working or proposing | A suggested change waiting in Inbox › Needs you, from a detector or an agent, named |
| No access | Without the grant its target needs, a suggested change is read only — *Ask Priya (owner)* |

## Rules

| Rule | Detail |
|---|---|
| No memory of its own | An agent does not carry anything from one run to the next by itself. What it knows next time is a record in the Graph it reads, or a change a person accepted |
| Recall is a planned step | Never context added behind the scenes; it reads records with a query, cites them by record, and states *nothing to recall* when there is none |
| A skill says when to recall | The trigger is written in the skill; recall never runs on every question |
| The domain models its memory | The product ships the mechanism; a Graph names its own kinds — an observation, a claim made from observations, how the claim fared. A starter model ships that shape, renamed on arrival |
| Where memory lives | Runs, their steps and their evidence are Invana's; what the domain learned is in the Graph, joined to its own kinds and cited in answers. A memory record carries the run that produced it |
| Counts, not scores | Evidence is counted and opened, never scored or ranked by agent |
| Every count opens its runs | A count that cannot be opened is not evidence |
| The window is stated | Last 7 · 30 · 90 days, on every figure; a new version restarts its counts, the previous version's kept beside them |
| Too few is said | *12 runs — too few to read*, never a percentage |
| A gap is read beside what its runs share | *37 of the 40 never matched the trigger* — the count says something is wrong; what the runs share says what to change |
| Improvement is a version a person accepts | Never a weight that shifts; nothing changes itself at any threshold |
| A suggested change carries its evidence | The runs, the counts and the window behind it; one without evidence is refused when it is made |
| One change, one target | A suggested change is the whole new body of one skill, plan, agent's skills or limits, rule, criterion or answer template, against the version it changes |
| Newer replaces older | A newer suggested change on the same target replaces the open one, carrying both bodies of evidence |
| An agent may only tighten its own limits | It may suggest a tighter limit, or a change to a skill or plan; widening its own limits or budget is a person's act |
| A rejection carries a note | The note is evidence about what suggested it |
| Accepting predicts | It states what should change, and by how much, so the outcome is judged — improved · unchanged · worsened · unmeasured |
| A worse outcome is a revert suggested the same way | Nothing rolls back by itself |
| Leans on | EX-F04 — the run and its trace · Agents › Skills — the skills, plans and templates that change · Model — the domain's memory kinds and the rules · Projects — criteria · Inbox — Needs you |

## Data touched

| Record | Read or write |
|---|---|
| Runs and their steps — skills offered and applied, plan served, rules cited, refusals, failures | Read |
| Evidence counts — per skill, plan, rule, criterion and refusal, per version and window | Write (the engine, as each run settles) · read |
| Memory records in the Graph — the domain's own kinds, each with the run that produced it | Read · write (by a run, inside what it may do) |
| A suggested change — target and the version it changes, the new body, the evidence, the prediction, who suggested it, status | Write (a detector or an agent) · read |
| The decision on it — who, when, the note, whether edited | Write (the grant its target needs) · read |
| A version's outcome against its prediction | Write (the engine) · read |

## Decisions

| Decision | Detail |
|---|---|
| The engine counts evidence | Every count is stored by the engine when the run it counts settles; Studio shows it and never works one out |
| Evidence opens from Agents › Skills | It is read about a skill, plan, rule or criterion, so it opens from the Skills list and from the item itself, with the same numbers on both — never a place of its own in the leftNav |
| Suggested changes wait in Inbox › Needs you | They wait on a person and never block a run; ranked by the size of their evidence, not their age |
| A stale base is refused | A suggested change made against an older version than the current one is refused on accept, with both shown — never merged blind |
| What is offered is versioned; what is judged against is revised | Skills, plans, rules and answer templates have versions old runs still resolve to; a criterion has revisions, and its outcome keeps the statement it judged |
| Accepted with edits is recorded | The published body, and that a person changed it |

## Open questions

| Question | Who answers |
|---|---|
| Who sets a detector's threshold — the defaults that ship, or each Graph? | Ravi |
| Does accepting with edits keep the body as suggested, to compare? | Ravi |
| Does a suggested change expire if nobody decides, or wait in Needs you? | Ravi |
| May a suggested change target a starter model's shape, or only what a Graph authored? | Ravi |

## Not building

| Item | Why not |
|---|---|
| An agent carrying context from one run to the next | It cannot be audited, and what it recalls cannot be cited |
| Recall by similarity over past runs | What is recalled must be explainable as a query over records |
| Recall on every run · recall across Graphs | A skill decides when; the Graph is the boundary |
| Agents writing their own skills or rules | A change has an author for a reason |
| Memory per person | The Graph is the shared truth; a memory per person forks it |
| Training or fine-tuning on outcomes · scoring agents | What changes must stay readable and editable by a person; a score invites gaming the score |
| Agent leaderboards · predicting quality · alerts on thresholds | A count you can open is the point; alerts belong to operations |
| Changing itself at a threshold · accepting in bulk · accepting low-risk changes unread | A difference nobody read is not a decision; risk is what the person judges |
| A rollback by itself on a worse outcome | Reverting is a change, and changes are reviewed |
| A suggested change to several things at once | A difference a person cannot hold in their head is not reviewable |
| Running two versions live side by side | Its cost and attribution make it unreadable at this scale |
