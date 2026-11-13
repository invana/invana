---
id: PJ
title: Projects
status: idea
owner: Ravi
personas: [decision-maker, analyst, researcher, investigator, builder]
---

# Projects

> Run any kind of work with a team of people and agents: shape it with the project assistant, split it into tasks of
> the kinds it needs, order them in groups, gate each on its checks, and decide — with a trail anyone can follow.

Pillar: **Evidence** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

Work done in a meeting, a chat or a tracker leaves no trail: nobody can see which evidence a decision rested on, why a
result was accepted, whether its checks ran, or pick the work up when the person who started it is gone.

## Users

| Persona | Comes here to |
|---|---|
| Decision maker | Pursue a question to a decision: fork branches, read findings, decide, publish a report |
| Researcher · Investigator | Run a study or a case — its type's fields, task kinds and words |
| Analyst | Take a task, add a finding from a board |
| Agent builder | Run delivery work — a document, a fix, a release — with agents that pick up tasks and checks that gate them |

## Goals

| Goal | Measured by |
|---|---|
| Every decision cites the findings, runs and steps it rests on | Settled — a decision's lineage opens every finding it cites and the thinking-graph steps behind them (PJ-11) |
| An agent proposes; a person accepts or rejects | Settled — only a person accepts a proposal, a task's result or a decision, recorded in their name (PJ-05 · PJ-12 · PJ-21) |
| No result is accepted on an agent's word | Settled — a task with checks reaches review only when every check passed in a run of its own (PJ-25) |
| No project waits on one person | Settled — members, reviewers and assignees are slots with fallbacks ([AC-F07](../../os/access/features/AC-F07-ownership/feature.md#slots-and-fallbacks)) |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| PJ-F01 | [Projects and tasks](features/PJ-F01-projects-and-tasks/feature.md) | PJ-01 · PJ-02 · PJ-12 · PJ-15 · PJ-18 · PJ-20 · PJ-21 · PJ-22 · PJ-23 · PJ-24 · PJ-25 | idea |
| PJ-F03 | [Branches, findings and decisions](features/PJ-F03-branches-findings-and-decisions/feature.md) | PJ-03 · PJ-04 · PJ-05 · PJ-06 · PJ-07 · PJ-08 · PJ-10 · PJ-11 · PJ-13 | idea |
| PJ-F05 | [Project reports](features/PJ-F05-project-reports/feature.md) | PJ-14 | idea |
| PJ-F06 | [Alerts](features/PJ-F06-alerts/feature.md) | PJ-19 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Projects | mode | `projects.list` |
| A project | mode | `projects.project` |
| The project assistant | the assistant region | `projects.assistant` |
| A new project | modal | `projects.new` |
| Ask another project for help | modal | `projects.ask_help` |
| A task | mode | `projects.task` · `projects.task.thinking` · `projects.task.from_board` |
| Options and a decision | mode · modal | `projects.options` · `projects.decide` |
| A finding | peek | `projects.finding` |
| A report | sheet | `projects.report` |
| A project's alerts | mode | `projects.alerts` |
| A project as a map | mode | `graph.memory.project_map` ([GP-08](../../os/graph/features/GP-F02-memory/stories/GP-08-see-a-project-as-a-map-and-what-is-moving-on-it/story.md)) |

## Decisions

| Decision | Detail |
|---|---|
| Experimental | Projects is shown and labelled *Experimental*, not launched, until workers, agents, Explore and Model are strong; nothing is hidden behind a setting |
| Any kind of work | A project is any work a team of people and agents runs — a question to decide, a case, a document, a fix. Its type decides its fields, its task kinds and its words (PJ-F01) |
| Of one type | Its type — Research · Investigation · Policy · General, or one a Team pack adds — declares the fields *New project* asks for, the task kinds it offers, and relabels Project, Task, Branch, Finding and Decision inside the project only; it carries default rules, suggested agents and skills, default checks and a report template. The engine, the API and every shared place say the generic words; changing the type later only relabels |
| Flat projects | A project has no sub-projects; branches live inside it and are never sub-projects. Tasks nest: sub-tasks to any depth for people, bounded by the run's limits for agents (PJ-F01) |
| A project is a repository | Tasks are issues: people ask, agents answer, and @ an agent gives it work |
| Projects hold no permissions | A project is its context, instructions, files, tasks, project assistant, reviewers and relations. It grants nothing and holds no connectors: what a run reaches is its agent's Access Policies alone, narrowed by the run scope ([AC-F04](../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#rules)) |
| Every project is open | Every person sees every project's head; what they read of it is what their default agent may Read ([AC-F02](../../os/access/features/AC-F02-access-policies/feature.md#rules)) |
| Owned by the organisation | A project is the organisation's, keeping who made it ([AC-F07](../../os/access/features/AC-F07-ownership/feature.md)); members, reviewers and assignees are slots with fallbacks |
| The project assistant | Each project names one agent as its assistant: it ideates with the members and turns what it hears, recommendations and asks from other projects into proposals a member accepts (PJ-21 · PJ-22) |
| Only a person decides | An agent posts results, adds findings and proposes; accepting a proposal, a task's result, a verdict and a decision is always a person's — a result is a reviewer's |
| Checks gate a task | A task with checks reaches review only when each passed in a run of its own; an agent's own claim that its work is green is never evidence (PJ-25) |
| A task needs no project | A task may sit in no project, so small work never needs a catch-all project; routine work is a schedule (AG-F07) |
| What waits on a person is the Inbox | A result to accept, a proposal, a question an agent asks and a verdict to give reach the person in Needs you ([CP-F08](../../os/control/features/CP-F08-the-inbox/feature.md)); Projects keeps no list of its own |
| A todo graph is not a plan | A project's tasks, groups and their dependencies are work people accept; a plan is what one run executes ([AG-F06](../agents/features/AG-F06-plans-and-workflows/feature.md)) |
| A task needs no plan | A person given a task with a body saying what done means and no steps is the smallest case; it uses no field it does not need |
| A task is worked through an agent | The agent brings its AI model, skills, Access Policies and limits; assigning a task to an agent — one granted to the assigner — opens one run with the assigner as the person behind it; a picked-up task runs as the agent |
| A task's state is its latest run's | Open · assigned · in progress · needs input · blocked · checking · checks failed · in review read off the run and its checks; only *done*, *failed* and *cancelled* are written — by a person accepting, rejecting or cancelling |
| Agents may raise tasks | From inside a run, for a helper or for a person; handing work to another agent and raising a task are the same act |
| A plan's steps are never tasks | A run's steps — a query, a model call, a step a person does — are its plan's; a task is work someone accepts. No screen calls either a *job* |
| Archiving freezes | An archived project and its tasks read only; runs already going finish |
| Decisions are never edited | A decision cites the thinking-graph steps it rests on; it is immutable and owned by nobody — a new decision supersedes it, linking back (PJ-F03) |
| Loads used are cited ones | A project's loads are the ones its findings cite, by stable id and content hash; derived records it saves are written to a read + write graph database, labelled *derived* |
| What-if is a way of reasoning | Simulating before committing is asked in a conversation and comes back as evidence marked *Predicted* ([EX-F05](../explore/features/EX-F05-when-it-cannot-answer-and-how-it-reasons/feature.md)); what a decision reaches is PJ-10 |
| Generic by design | No project type, task kind, story or word is domain-specific; a team's own types and kinds arrive in its Team pack (CP-F02) |

## Depends on

| Product or capability | For |
|---|---|
| Explore | The boards findings come from, and what-if answers whose evidence is marked *Predicted* (EX-F05) |
| Agents | The agents that take tasks, the project assistant, and the workflows checks run (AG-F06) |
| Intelligence | The loads findings cite, and the derived records a project saves |
| Ontology | The rules that check a decision, and the alert rules that open leads (SE-F07) |
| Graph Plane | Memory — the project map, project memory and org knowledge ([GP-F02](../../os/graph/features/GP-F02-memory/feature.md)) |
| Control Plane | The Inbox, where project work waits on a person (CP-F08); ops alerts, which are never a project's (CP-F11) |
| Access Plane | The agents granted to a person and their default agent (AC-F02 · AC-F03); slots and fallbacks (AC-F07); the run scope (AC-F04) |

## Not building

| Item | Why not |
|---|---|
| Sub-projects | Branches carry the forks; groups and relations carry the rest |
| A project's own access list | Projects hold no permissions; a person reads what their default agent may Read |
| Connectors on a project | Agents bring their work connections ([CP-F02](../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md)) |
| Parameter sweeps · game theory | After 1.0 |
| Per-project roles | The role table governs every act ([AC-F02](../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)) and a project grants nothing |
| Gantt charts, sprints, story points, time tracking | Groups and the Order answer "what is next"; the record holds what things cost |
| Objectives and per-task criteria | A task's body says what done means; checks prove what can be proved; a reviewer accepts |
| Editing a decision | A decision is superseded, never edited |
| Writing project types or task kinds in Studio | Built-in types and Team packs (CP-F02) |
| Soft deletes, trash, undo | Archiving covers the need |
| Agents deciding on their own | Agents propose; people decide |
