# Invana Projects — pursue and decide

For anyone on a quest: a scientist validating a hypothesis, a government testing a policy, an investor testing a thesis, a marketer testing a position. Prototype page: *Invana Projects › Pursue and decide*. Examples: an Arabidopsis flowering-time quest (Research), allowing gene-edited lines in field trials (Policy), a futures position (Investment).

| | |
|---|---|
| For | thinkers — scientists, policy makers, investors, marketers, investigators, analysts |
| Scope | One Graph |
| Rail | Projects · My todos · Decisions |
| A project is | one question, of one **type** |
| Hands off to | Datasets (evidence, derived outputs) · Agents (todos for agents) · Shell › Schedules (re-checks) |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Project types

The type sets the words and the panel that opens first. The records underneath are the same for every type, so lineage, rules, reports and audit work everywhere.

| Type | For | A branch is a | Evidence is a | Verdict | Decision | Opens first |
|---|---|---|---|---|---|---|
| Research | scientists | Hypothesis | Finding | supported · refuted · inconclusive | pursue · park · drop | Simulate, Lineage |
| Investment | financial and money markets | Thesis | Signal | holds · broken · unclear | invest · hold · pass | Scenarios, Risk |
| Policy | government, compliance | Option | Evidence | effective · harmful · unclear | adopt · amend · reject | Impact |
| Market | product marketing, positioning | Position | Insight | validated · invalidated · mixed | go · revise · no-go | Comparison |
| Investigation | fraud, incidents, intelligence | Lead | Evidence | confirmed · ruled out · open | escalate · monitor · close | Lineage, Timeline |
| General | anything else | Option | Evidence | supported · against · unclear | choose · park · drop | Overview |

- **Launch order:** Research, Policy and General first; Investment, Market and Investigation switch on when a real user for that persona exists.
- Merge is a decision in every type.
- A type is chosen when the project is created; changing it later only relabels.

## Features

| ID | Feature | Status | Stories |
|---|---|---|---|
| PJ-F1 | Projects — type, question, objective, people, visibility, rules in force | Moves (today’s Projects) · New (type, visibility) · Blocked · P-14 (private) | PJ-01 · PJ-02 · PJ-03 |
| PJ-F2 | Branches — fork, merge, park, drop; the tree | New · Blocked · P-10 | PJ-04 · PJ-08 |
| PJ-F3 | Branch page — hypothesis, verdict, evidence for and against, agent proposals, todos, datasets, runs, schedules | New · Blocked · P-10 | PJ-05 |
| PJ-F4 | Findings with evidence — stance, records, origin, version, rules satisfied | New · Blocked · P-10 P-08 | PJ-06 |
| PJ-F5 | Verdicts and decisions — rationale, cites, rule check that can refuse, supersede | New · Blocked · P-10 | PJ-07 · PJ-13 |
| PJ-F6 | Simulation — parents, targets, simulator plugin, ranked result | New · engine ✅ B09 ([9.8](../for-developers/modules/work/features/simulation.md)), Studio C06 | PJ-09 |
| PJ-F7 | Impact — a decision’s blast radius by hop over the graph | New · Blocked · P-06 (what-if values only) | PJ-10 |
| PJ-F8 | Lineage — decision back to original authors | New · Blocked · P-10 P-08 | PJ-11 |
| PJ-F9 | My todos — with or without a project | Moves (today’s Projects) | PJ-12 |
| PJ-F10 | Reports — drafted from the records, edited, published as versions, exported | New · Blocked · P-10 | PJ-14 |

## User stories

| ID | As a | I want | So that | Boards (walk order) |
|---|---|---|---|---|
| PJ-01 | thinker | every question being pursued on this Graph | I see what is open and what was decided | `projects.list` |
| PJ-02 | thinker | to start a project by saying what I am deciding — its type, question, first branch, people and who can see it | a quest has a shape and the right words from day one | `projects.new` |
| PJ-03 | thinker | a project overview: branches, datasets used and made, open work | I know where the quest stands | `projects.project` |
| PJ-04 | thinker | to fork a line of inquiry into hypotheses and see the tree | I explore alternatives without losing any | `projects.project.branches` · `projects.branch.fork` |
| PJ-05 | thinker | a branch with its hypothesis, verdict, evidence for and against, agent proposals and todos | work and evidence sit together, counter-evidence included | `projects.branch` |
| PJ-06 | reviewer | a finding with every record behind it, its origin and version | claims are checked against data | `projects.finding` |
| PJ-07 | thinker | to record a verdict and pursue, park, drop or merge, checked by the rules; a later decision supersedes, never overwrites | decisions are deliberate, defensible and revisable | `projects.branch.decide` |
| PJ-08 | thinker | to merge what one branch learned into another | lines of inquiry converge without copying | `projects.branch.merge` |
| PJ-09 | scientist | to simulate crosses against target traits before making them | I spend a season on the best bet | `projects.simulate` · `projects.simulate.result` |
| PJ-10 | policy maker | a decision’s blast radius across the graph | I see who it reaches before I commit | `projects.impact` |
| PJ-11 | auditor | the lineage of a decision back to the original authors of the data | anyone can follow how we got here | `projects.lineage` |
| PJ-12 | anyone | my todos, with or without a project | a stray task has a home without a “misc” project | `projects.todos` · `projects.todo` |
| PJ-13 | auditor | every decision across projects, what it cited, the rules it passed | decisions can be audited in one place | `projects.decisions` |
| PJ-14 | thinker | a report drafted from the records, edited and published as a frozen version | what we decided can be circulated, cited and audited | `projects.report` |

## Branches

| Status | Means |
|---|---|
| open | the question as asked, or a line not yet worked |
| pursuing | being worked |
| parked | stopped for now; evidence kept |
| dropped | stopped for good; kept, struck through |
| merged | its chosen findings and datasets were carried into another branch |

| Act | Rule |
|---|---|
| Fork | Children inherit the parent’s findings and datasets; open todos stay on the parent |
| Merge | Copies references, never data; both branches keep their history |
| Verdict | supported · refuted · inconclusive (in the type’s words), separate from the decision; it must address every contradicting finding |
| Decide | pursue · park · drop · merge, with a rationale; every rule in force is checked |
| Refuse | A rule that blocks says which evidence broke it and offers: remove it, or send it for review |
| Supersede | Decisions are append-only. Revisiting one is a new decision that cites the new evidence and names the one it supersedes |

## Evidence

| Stance | Means |
|---|---|
| supports | bears for the branch’s hypothesis |
| contradicts | bears against it — the verdict must address it |
| context | relevant, neither for nor against |

- The branch header shows the balance (e.g. *3 supports · 1 contradicts*).
- Findings carry origin and review status from Datasets; rules can require person-reviewed evidence.

## People and agents

| Who | May |
|---|---|
| People on the project | everything: findings, verdicts, decisions, reports |
| Agents | do todos, add findings, **propose** a fork or a decision with a rationale |
| Proposals | land in the branch’s Proposals; a person accepts or rejects. Verdicts and decisions are always a person’s |

## Visibility

| Setting | Who can see the project |
|---|---|
| Graph members | every member of the Graph |
| Only the people on it | the people staffed on the project ✅ B05. Agents are not on the list: an agent run reads projects through its own principal, and access is enforced on the people-facing API and search ([PP6](../for-developers/modules/work/features/private-projects.md)) |

## Reports

| Rule | Detail |
|---|---|
| Drafted | from a template over the records — question, branches, evidence, verdicts, decisions; never invented, no LLM |
| Edited | by a person before publishing |
| Published | as a frozen version that cites dataset versions; earlier versions stay readable |
| Exported | Markdown from the engine; PDF from Studio's print |
| Retractions | a published report that cites retracted data shows a notice |

## CLI

| Command | Does | Status |
|---|---|---|
| `invana projects list` · `create <name> --type research\|policy\|general --question "…" [--private]` · `show` | projects of a type, optionally private | ✅ B05 |
| `invana branches list --project` · `fork <b> --into "…" "…"` · `merge <from> <into>` | the tree of inquiry | ✅ B05 |
| `invana findings add --branch --stance supports\|contradicts\|context --cites <record…>` · `review` | evidence for or against; an agent's waits for a person's review | ✅ B05 |
| `invana branches decide <b> --verdict … --decision … --rationale "…"` | verdict and decision; rules checked; supersedes, never edits | ✅ B05 |
| `invana proposals list` · `accept` · `reject` | what agents proposed | ✅ B05 |
| `invana todos list [--mine]` · `add` · `done` | todos, with or without a project | ✅ partly (today's projects API) · New CLI |
| `invana reports generate --project` · `publish` · `export --format md` | versioned write-ups; PDF is Studio's print | ✅ B05 |
| `invana lineage --decision <id>` | everything behind a decision | New · P-10 |
| `invana simulate --project --branch --plugin <name> --file <spec>` · `invana simulations list` · `show` | run a simulator plugin; its ranked result | ✅ B09 |

## Decisions

| Decision | Detail |
|---|---|
| Name | Projects — generic; the project type carries each persona’s language |
| Projects stay flat | Branches are lines of inquiry, not sub-projects |
| No “Misc” project | A todo may have no project; routine work is a schedule |
| Simulation | A plugin does the science; Invana runs it, pins inputs, labels output `derived` |
| Impact | Reach by hop is graph traversal; what-if values need the simulation runtime |
| Lineage | Built from records, never inferred; every node opens its source |
| Rail → path | Projects `/projects[/:project]` · My todos `/projects/todos[/:todo]` · Decisions `/projects/decisions`. A project's key sits right under the product root, so `todos` and `decisions` are not usable project keys. The rail lights the longest-matching item |
| One stack, two rail items | Projects and My todos are the two sections of today's Projects stack (Projects over Todos), as Agents and LLMs share one stack |
| My todos | Draws today's Todos section: with no project open, every Todo in the Graph. Narrowing it to the signed-in person's todos comes with C02 |
| Decisions | The kit's `EmptyState` with an *Opens with engine support* lock until B05 records decisions |
| `projects.addFinding` | Registered with `available: false`, so `useAction` returns `null` and the Explorer's button stays hidden until C02 |
| Assignees | A Todo's agent picker reads the agents list through `ProjectsSlotsContext.useAgents`, because Projects may not import the Agents product |

## Not building

| Item | Why |
|---|---|
| Sub-projects, folders | Branches cover it |
| Gantt charts, sprints, story points | Projects here are decision quests, not project management |
| Projects spanning Graphs | A project lives in one Graph |
| Type authoring | Six built-in types; teams don’t define their own yet |
| Autonomous agent decisions | Agents propose; people decide |
