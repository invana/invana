---
id: PJ-F03
title: Branches, findings and decisions
product: PJ
status: idea
personas: [decision-maker, analyst]
stories: [PJ-03, PJ-04, PJ-05, PJ-06, PJ-07, PJ-08, PJ-11, PJ-13]
journeys: [J03]
boards: [projects.project, projects.options, projects.finding, projects.task.thinking, projects.decide]
nfrs: []
depends_on: [PJ-F01, RC-F02, EX-F02, AG-F03, SE-F07]
---

# Branches, findings and decisions

> A project is one question. Its lines of inquiry are branches; the evidence for and against each is a finding; a person
> closes a line with a verdict and a decision that the rules check. Agents propose; people decide. The decisions it
> helps make: *which line do we pursue, park, drop or merge — and what does it rest on?*

## User journey

Journeys this feature is a step of: [J03 · Give an agent work and decide on the result](../../../../journeys/J03-give-an-agent-work-and-decide-on-the-result.md)

```mermaid
flowchart TD
  start([Projects › a project]) --> vis{"Private, and not staffed on it?"}
  vis -->|yes| priv["PJ-03 · Private — it does not open, for an Admin as for anyone"]
  vis -->|no| ov["PJ-03 · Overview: question · branches · loads cited and records saved · open work"]
  ov -->|archived| arch["Reads only — every act disabled, saying archived"]
  ov --> tree["PJ-04 · The tree"]
  tree --> fork["PJ-04 · Fork a branch into children"]
  fork -->|dropped or merged| rf["Refused — revisit it with a new decision first"]
  fork -->|Operator| fo["Fork disabled, naming Can work on projects"]
  tree --> br["PJ-05 · A branch: findings for and against · decisions · proposals · tasks"]
  ov --> br
  br --> add["PJ-06 · Add a finding: supports · contradicts · context, with its cites"]
  add -->|a cite does not resolve| rc["Names the cite · nothing added"]
  explore([Explore › Add to a project — EX-12]) --> add
  add --> fd["PJ-06 · A finding: records · origin · reviewed by · How it got here"]
  fd -->|an agent added it| rev["Unreviewed until a person reviews it"] --> fd
  fd -->|a load it cites is undone| rt["Marked: a load undone"]
  br --> dec["PJ-07 · Decide: verdict · decision · rationale · what it cites"]
  dec -->|a rule blocks| rr["Refused: the rule · the evidence · Remove it from the cites"]
  rr -->|evidence not reviewed| fd
  rr --> dec
  dec -->|a rule warns| dw["Recorded with the rule's line"]
  dec -->|branch already decided| sup["Supersedes the current decision · must cite newer evidence"]
  dec -->|Operator| dn["Decide disabled, naming Can work on projects"]
  dec --> rec["Decision recorded · the branch's status moves"]
  sup --> rec
  dw --> rec
  br -->|merge| mg["PJ-08 · Merge: into · what moves"]
  mg -->|into itself, dropped or merged| mr["Refused, saying why"]
  mg -->|a rule blocks| mrr["Refused: the rule · the evidence"]
  mg --> rec
  agent([An agent proposes a fork or a decision]) --> prop["PJ-05 · Proposal waiting on the branch"]
  prop -->|a person accepts a fork| fork
  prop -->|a person accepts a decision| dec
  prop -->|a person rejects| pr["Rejected · kept"]
  rec --> lin["PJ-11 · Lineage: authors · loads · runs · findings · the decision"]
  rec --> all["PJ-13 · Every decision, across projects"]
  all --> lin
```

```mermaid
sequenceDiagram
  actor P as Person who can work on projects
  participant A as Agent
  participant E as Engine
  A->>E: adds findings, proposes a fork or a decision with a rationale
  E-->>P: the proposal waits on the branch, with How it got here
  P->>E: Accept (or Reject)
  alt a fork
    E->>E: children made, holding the parent's findings
  else a decision
    E->>E: every rule in force checks it, as the accepting person
    alt a rule blocks
      E-->>P: refused, naming the rule and the evidence · the proposal stays open
    else passes or warns
      E-->>P: decision recorded in the person's name
    end
  end
  Note over A,E: An agent never records a verdict or a decision
```

## Stories

| ID | Story | Status |
|---|---|---|
| PJ-03 | [See where a project stands](stories/PJ-03-see-where-a-project-stands/story.md) | idea |
| PJ-04 | [Fork a line of inquiry and see the tree](stories/PJ-04-fork-a-line-of-inquiry-and-see-the-tree/story.md) | idea |
| PJ-05 | [Read a branch with its evidence and proposals](stories/PJ-05-read-a-branch-with-its-evidence-and-proposals/story.md) | idea |
| PJ-06 | [Weigh a finding and the records behind it](stories/PJ-06-weigh-a-finding-and-the-records-behind-it/story.md) | idea |
| PJ-07 | [Record a verdict and a decision the rules check](stories/PJ-07-record-a-verdict-and-a-decision-the-rules-check/story.md) | idea |
| PJ-08 | [Merge what one branch learned into another](stories/PJ-08-merge-what-one-branch-learned-into-another/story.md) | idea |
| PJ-11 | [Follow a decision back to the original authors](stories/PJ-11-follow-a-decision-back-to-the-original-authors/story.md) | idea |
| PJ-13 | [Audit every decision in one place](stories/PJ-13-audit-every-decision-in-one-place/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read a project the person may see, its branches, findings, decisions, lineage and the Decisions page | Operator — every member | A private project reads only to the people staffed on it; nobody else, an Admin included, can open it |
| Fork, merge, add or review a finding, record a verdict and a decision, accept or reject a proposal, file a task on a branch | `contributor` · shown as *Can work on projects* · Admin | Everything reads; each act is disabled, naming *Can work on projects* |
| Add findings, propose a fork or a decision | An agent | A proposal reads as waiting, with its rationale and *How it got here* |
| Record a verdict or a decision | A person with *Can work on projects*, never an agent | An agent can only propose |

## States

| State | What the person sees |
|---|---|
| First use | A project just started: the question as one open branch, *No findings yet*; a branch with no findings says so with *Add a finding*; Decisions says *No decisions yet* |
| Empty after a filter | The lineage narrowed by *Show* to a source that holds nothing says so |
| Loading | The page is drawn at once; the lists, the tree and the lineage fill in |
| Has data | The overview, tree, branch, finding, decisions and lineage as their stories describe |
| Failed | The page could not load, saying why, with *Try again*; an act the engine refuses names the reason and changes nothing |
| Agent working or proposing | A proposal waits on its branch, an agent's finding reads *Unreviewed*; each opens *How it got here* |
| No access | A private project does not open; for an Operator without *Can work on projects* everything reads and each act is disabled, naming *Can work on projects* |

## Rules

| Rule | Detail |
|---|---|
| The type carries the words | Engine, API and specs always say Project · Task · Branch · Finding · Decision. A project's type relabels them in Studio **inside the project only** — its heading, tabs, dialogs and report (below). Shared places — Projects, My tasks, Inbox › Needs you, Decisions, search, History — keep the generic words with the type as a badge. The records underneath are the same for every type; changing the type only relabels |
| Where types come from | The built-in types and the project types a Domain pack installs (RT-F02); none is written in Studio |
| One question, one tree | A project has one question; its first branch is the question as asked, open. Branches live inside the project and are never projects of their own |
| Branch status | open (the question, or a line not yet worked) · pursuing · parked (evidence kept) · dropped (kept, struck through) · merged. A decision moves it: pursue, park, drop, merge |
| Fork | Children hold the parent's findings and the loads they cite; open tasks stay on the parent; the parent's status does not change |
| A finding has a stance | supports · contradicts · context; it cites records, loads (by stable id and content hash) and runs. Origin and review come from where it was added |
| A person's finding is reviewed; an agent's is not | A person's is reviewed by them at once; an agent's waits for a person's *Review* |
| Verdict | In the type's words, separate from the decision; it addresses every contradicting finding on the branch |
| Rules check every decision | The rules in force on the install, the Graph and the project that check a decision (SE-F07): block refuses, naming the rule and the evidence that broke it; warn records it with a line; report records the check in History |
| Append-only | A decision is never edited or deleted. Revisiting one is a new decision that names the one it supersedes and cites a finding added after it |
| Merge is a decision | It carries chosen findings into another branch of the same project; findings are shared, never copied; both branches keep their history; the source is always marked merged |
| Agents propose | A fork or a decision, with a rationale; a person accepts or rejects; accepting a decision runs the full rule check as the accepting person |
| Loads cited | The loads a branch's findings cite — no second list. A load undone in Records flags every finding and decision that cites it |
| Private projects | Seen only by the people staffed on them, an Admin included (PJ-F01) |
| Archived | An archived project reads; every act is disabled |
| Numbers are the engine's | Branch, finding, decision and proposal numbers, balances and *current · recorded* are stored by the engine; Studio formats them |
| Leans on | Projects and tasks (PJ-F01) · loads and undoing a load (RC-F02) · adding an answer as a finding (EX-F02) · runs and *How it got here* (AG-F03) · rules (SE-F07) |

| Project type | A project is a | A task is a | A branch is a | Evidence is a | Verdict | Decision |
|---|---|---|---|---|---|---|
| Research | Study | Task | Hypothesis | Finding | supported · refuted · inconclusive | pursue · park · drop |
| Investigation | Case | Action | Lead | Evidence | confirmed · ruled out · open | escalate · monitor · close |
| Policy | Review | Task | Option | Evidence | effective · harmful · unclear | adopt · amend · reject |
| General | Project | Task | Option | Evidence | supported · against · unclear | choose · park · drop |

| A type also carries | Detail |
|---|---|
| Default rules | The rules in force on a new project of the type (SE-F07); a person with *Can work on projects* may add more |
| Suggested agents and skills | Offered first when staffing the project or a task; never added without a person's yes |
| A report template | What a report of the type opens with (PJ-F05) |

## Data touched

| Record | Read or write |
|---|---|
| Branches — number, parent, title, status, merged into | Write · read |
| Findings — statement, stance, cites, added by (person or agent), reviewed by | Write · read |
| Decisions — verdict, decision, rationale, cites, addressed findings, merged into, supersedes, rules checked, warnings, decided by | Write · read |
| Proposals — fork or decision, rationale, agent, who sent it, accepted or rejected, by whom | Write · read |
| Tasks filed on a branch (PJ-F01) | Write · read |
| Loads cited, and the notice when one is undone (RC-F02) | Read |
| Runs cited and their steps (AG-F03) | Read |
| Rules in force (SE-F07) | Read |
| History rows of every fork, finding, review, decision and proposal (AC-F06) | Write · read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `projects_branches` | `project_id` · `number` · `parent_id?` · `title` · `body` · `status` (`open` · `pursuing` · `parked` · `dropped` · `merged`) · `merged_into_id?` · `created_by_kind` · `created_by_id` | The first branch is the question as asked, written at project create |
| `projects_findings` | `project_id` · `branch_id` (added on) · `number` · `statement` · `stance` (`supports` · `contradicts` · `context`) · `cites[]` · `added_by_kind` (`user` · `agent`) · `added_by_id` · `reviewed_by_id?` · `reviewed_at?` | A cite is `{kind: record · load · run, ref}`; a load cite is resolved on add to its stable id and content hash. A person's finding is written with `reviewed_by_id` set to them |
| `projects_branch_findings` | `branch_id` · `finding_id` · `via` (`own` · `fork` · `merge`) | A branch's evidence is its links |
| `projects_decisions` | `project_id` · `branch_id` · `number` · `verdict` · `choice` · `rationale` · `cites[]` (finding ids) · `addresses[]` · `into_branch_id?` · `supersedes_id?` (unique) · `checks[]` · `warnings[]` · `decided_by_id` | `choice` is `pursue` · `park` · `drop` · `merge`; `checks[]` the rules it was checked against. No route updates or deletes a row |
| `projects_proposals` | `project_id` · `branch_id` · `number` · `kind` (`fork` · `decision`) · `payload` · `rationale` · `status` (`open` · `accepted` · `rejected`) · `agent_id` · `submitted_by_id` · `resolved_by_id?` · `note` · `result` | Attributed to an agent of the Graph; `submitted_by_id` the signed-in principal that sent it |

### Reads

| Record | Owner |
|---|---|
| Projects, their type and staff · tasks filed on a branch | [PJ-F01](../PJ-F01-projects-and-tasks/feature.md#engine) |
| Loads, their content hash and whether one was undone | [RC-F02](../../../records/features/RC-F02-bring-records-in/feature.md#engine) |
| Runs cited and their steps | [AG-F03](../../../agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Rules in force, and the rule-check event | [SE-F07](../../../semantics/features/SE-F07-rules/feature.md#engine) |
| An Explore answer added as a finding | [EX-F02](../../../explore/features/EX-F02-share-and-present-an-answer/feature.md#engine) |
| History | [AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine) |

### Routes

| Route, after `/api/v1/u/{u}/{g}/projects` | Does | Story |
|---|---|---|
| `GET /{key}/branches` | The tree | PJ-03 · PJ-04 |
| `GET /{key}/branches/{n}` | A branch with its findings, decisions, proposals and tasks | PJ-05 |
| `POST /{key}/branches/{n}/fork` | Fork into named children | PJ-04 |
| `GET /{key}/branches/{n}/findings` · `POST /{key}/branches/{n}/findings` | A branch's findings · add one | PJ-05 · PJ-06 |
| `GET /{key}/branches/{n}/decisions` · `POST /{key}/branches/{n}/decisions` | A branch's decisions, newest first · record one — a merge is a decision with `choice = merge` and `into` | PJ-07 · PJ-08 |
| `POST /{key}/branches/{n}/proposals` | An agent proposes a fork or a decision | PJ-05 |
| `GET /{key}/findings/{n}` · `POST /{key}/findings/{n}/review` | A finding · a person reviews it | PJ-06 |
| `GET /{key}/proposals` · `POST /{key}/proposals/{n}/accept` · `POST /{key}/proposals/{n}/reject` | Proposals · accept · reject | PJ-05 |
| `GET /{key}/decisions` · `GET /decisions` | A project's decisions · every decision the reader may see, across projects | PJ-11 · PJ-13 |

### Events

| Event | When |
|---|---|
| `projects.branches.fork` | Children made |
| `projects.findings.add` · `projects.findings.review` | A finding added · reviewed |
| `projects.decisions.record` | A decision recorded, a merge included |
| `projects.proposals.submit` · `accept` · `reject` | A proposal's three acts |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 403 | A write by someone without *Can work on projects* | *This needs Can work on projects — ask {owner}.* | PJ-03.12 · PJ-04.12 · PJ-05.14 · PJ-06.11 · PJ-07.16 · PJ-08.12 |
| 403 | An agent records a verdict or a decision | *An agent proposes — a person decides.* | PJ-05.13 · PJ-07.15 |
| 422 | A fork with a child not titled | *Each child needs a title.* | PJ-04.7 |
| 422 | A load or run cite that does not resolve | *`{cite}` does not resolve — nothing was added.* | PJ-06.3 |
| 422 | A contradicting finding linked to the branch not in `addresses` | *The verdict does not address {fN}.* | PJ-07.4 |
| 422 | A superseding decision that cites no finding added after the one it supersedes | *Cite evidence newer than {dN}.* | PJ-07.11 |
| 422 | A merge into itself, into a dropped branch or into a merged one | *Cannot merge into {bN} — {why}.* | PJ-08.8 |
| 409 | A fork of a dropped or merged branch | *{bN} is {status} — revisit it with a new decision first.* | PJ-04.6 |
| 409 | A rule in force blocks the decision or the merge | *blocked by rule — "{statement}" (because {because}): {reason}*, one line per blocking rule joined by `; ` | PJ-05.10 · PJ-07.5 · PJ-08.10 |
| 409 | A decision on a decided branch that does not name the current one in `supersedes` | *{bN} is decided — supersede {dN}.* | API only — Studio supersedes without asking (PJ-07.10) |
| 409 | Acting on a proposal already accepted or rejected | *{pN} is already {status}.* | PJ-05.12 |
| 409 | Any write to an archived project | [PJ-F01 › Refusals](../PJ-F01-projects-and-tasks/feature.md#refusals) | PJ-03.11 |
| 404 | A branch, finding, decision or proposal of another project | *Not found.* | API only — each is addressed by number inside its project |

### CLI

| Command | Does |
|---|---|
| — | No command of its own; lineage is not built for the command line |

### Mechanisms

| Mechanism | How |
|---|---|
| Canonical words are stored | Verdicts `supported` · `refuted` · `inconclusive`; choices `pursue` · `park` · `drop` · `merge`. The type table in [Rules](#rules) is read on the way out, so changing a type rewrites nothing |
| Numbers per project | `number` on branches, findings, decisions, proposals and simulations counts from 1 in each project (`b3`, `f4`, `s1`) |
| Evidence is links | Fork writes `projects_branch_findings` rows `via = fork` for each child; merge writes `via = merge` for the chosen findings. A finding row is never copied |
| A decision moves its branch | `pursue` → `pursuing` · `park` → `parked` · `drop` → `dropped` · `merge` → `merged` (and `merged_into_id`); a fork alone never moves it |
| Rules check before writing | Every active rule whose check names `projects.decisions.record`, at install, Graph and project scope: block → 409 and nothing written, events included; warn → `warnings[]`; report → the rule-check event only |
| What a rule can check on a decision | Two check kinds: `evidence.reviewed` (every cited finding reviewed by a person) · `evidence.not_undone` (no cited finding cites a load since undone) |
| Accepting a proposal | Accepting a decision proposal runs the full decide as the accepting person; a refusal leaves it open. No route takes an agent as the decider |
| A merge with no findings named | Carries every finding linked to the source |
| A load undone | Read on every read of a finding or decision that cites it, never stored |
| Decision counts | `GET /{key}/decisions` and `GET /decisions` return `total` and `current` — the listed decisions no later one supersedes |
| Hidden projects | Every read here applies the private-project filter of [PJ-F01 › Mechanisms](../PJ-F01-projects-and-tasks/feature.md#mechanisms) |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Five append-mostly tables in Invana's own store; no new store | — |
| § 8 APIs and events | The routes and events above | — |
| § 10 AI and agents | Agents add findings and propose; only a person records a verdict or a decision, checked by the rules | — |

## Decisions

| Decision | Detail |
|---|---|
| Launched types | Research · Investigation · Policy · General are offered at creation (PJ-F01); a Domain pack may add more |
| Studio fills in what the engine requires | *Decide* addresses every contradicting finding and supersedes the current decision without asking |
| A refusal names what broke | A rule's refusal is drawn as a card naming the rule and the findings, with *Remove fN from the cites*; reviewing one is the finding page's *Review* |
| The tree is drawn | A fork is an edge, a merge a dashed *merged* edge, a dropped branch hollow; clicking a branch opens it; fork, decide and merge are acts on its page. The Overview keeps the indented list |
| Merge asks only what moves | What moves is also what the decision cites; the source is always marked merged — there is no *stays parked* |
| Levels of the path are named | *Projects › the project › H2 · title › the finding's statement*; a project, branch and finding are named for what they are, never their key |
| The page's state survives a reload | The open tab, branch, finding and decision ride in the address; moving to another project clears them |
| A finding's page | The statement is its title; *Added by* and *reviewed by* name the person or agent through the project's staff, as *By* does on Decisions; a run cite reads `run 8195c5e8` and opens the run |
| Lineage is built from records | A decision, its cited findings, their run and load cites, each load's author chain — never inferred; every node opens its source; *Show* narrows the loads and their authors to one source; a list of every node's hops under the drawing serves readers who cannot use it |
| Who decided | Decisions names a decider from each project's staff and the signed-in person; anyone else reads *a person*. *Export for audit* is a CSV of the rows shown |
| Current is counted by the engine | *2 current · 5 recorded*; it reads *5* alone when they match |
| Add from Explore | A settled answer reaches *Add a finding* through *Add to a project* (EX-12) |

## Open questions

| Question | Who answers |
|---|---|
| May a branch be decided with no findings cited? The source is silent. Recommend: yes, the dialog says *This cites nothing* and the rules decide whether to block it, so a project can record a decision taken without evidence rather than hide it | Ravi |

## Not building

| Item | Why not |
|---|---|
| Editing or deleting a decision or a finding | Append-only is the point; a newer finding or a superseding decision replaces |
| Agents deciding | Agents propose; people decide |
| Type authoring in Studio | Types are built in or come from a Domain pack (RT-F02) |
| Relabelling shared places | A list that mixes types must read one way; the type shows as a badge |
| A load list per branch | The loads cited are the ones its findings cite |
| A *Loads* tab, and a branch's *Runs* and *Schedules* tabs | Not yet: the Overview lists the loads cited; runs and schedules are listed elsewhere |
| A *stays parked* choice on merge | A merge always marks the source merged |
| Lineage from the command line | Not yet; Studio draws it from the same records |
| Simulation and impact on a branch | PJ-F04 |
| Reports drafted from the records | PJ-F05 |
| Staffing other people from Studio | Not yet; the creator is staffed (PJ-F01) |
