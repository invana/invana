---
id: AG
title: Agents
status: idea
owner: Ravi
personas: [builder, admin, analyst]
---

# Agents

> Build agents, skills and workflows once for the deployment, see how every plan was chosen and what the thinking graph
> remembers, and put agents on a schedule.
> The decision it helps make: *which agent, skill or workflow is ready to be given work, and what should change given
> what past runs show?*

Pillar: **Agents** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

An agent nobody can read, test or pin behaves differently every week; a plan that served is forgotten and drafted
again from nothing; a failed run nobody can open cannot be fixed; and what one run learned never reaches the next.

## Users

| Persona | Comes here to |
|---|---|
| Agent builder | Build and version agents and skills, test them with evals, version workflows, read their runs |
| Analyst | Run a workflow by name, propose a plan that served as a workflow, read a run's thinking, mark it good or bad |
| Admin | Approve functions, copy built-ins, answer what no named approver can, import and export agents and skills |

## Goals

| Goal | Measured by |
|---|---|
| An agent's version, model and skills are pinned, so a run can be repeated as it was | Open — set at the spec review |
| A plan that served is reused, not drafted again | Share of runs on rungs 1–3 of the ladder, stored by the engine |
| Every failed run opens to why, and to the skill or workflow to improve | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| AG-F01 | [Build an agent](features/AG-F01-build-an-agent/feature.md) | AG-21 · AG-26 · AG-29 · AG-36 | idea |
| AG-F02 | [The agents catalogue](features/AG-F02-the-agents-catalogue/feature.md) | AG-35 | idea |
| AG-F04 | [Skills](features/AG-F04-skills/feature.md) | AG-19 · AG-20 · AG-30 · AG-37 | idea |
| AG-F05 | [Delegation and outside agents](features/AG-F05-delegation-and-outside-agents/feature.md) | AG-24 · AG-33 · AG-34 | idea |
| AG-F06 | [Plans and workflows](features/AG-F06-plans-and-workflows/feature.md) | AG-18 · AG-31 · AG-38 · AG-44 · AG-46 · AG-47 · AG-48 | idea |
| AG-F07 | [Schedules](features/AG-F07-schedules/feature.md) | AG-42 | idea |
| AG-F08 | [Portable agents and skills](features/AG-F08-portable-agents-and-skills/feature.md) | AG-39 · AG-40 | idea |
| AG-F09 | [Learn from memory](features/AG-F09-learn-from-memory/feature.md) | AG-49 · AG-50 · AG-51 · AG-52 · AG-53 · AG-55 | idea |
| AG-F10 | [Test an agent and a skill](features/AG-F10-test-an-agent-and-a-skill/feature.md) | AG-56 · AG-57 · AG-58 · AG-59 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Agents | modal | `agents` |
| An agent | sheet | `agents.agent` |
| A new agent | modal | `agents.new` |
| Skills · a skill | modal · sheet | `agents.skills` · `agents.skill` |
| Workflows · functions | modal | `agents.skills` |
| A workflow | sheet | `agents.workflow` |
| The thinking graph — Memory, browsed ([GP-F02](../../os/graph/features/GP-F02-memory/feature.md)) | modal | `agents.thinking` |
| Schedules | modal | `agents.schedules` |

## Decisions

| Decision | Detail |
|---|---|
| Built once for the deployment | Agents, skills and workflows are built and versioned once; a person uses the agents granted to them, and each agent's Access Policies say what it may touch ([AC-F02](../../os/access/features/AC-F02-access-policies/feature.md)) |
| Built-in agents | One of each, owned by the system user: Assistant · Query console · Modeller · Coordinator · Record editor · Loader ([AG-F02](features/AG-F02-the-agents-catalogue/feature.md#mechanisms)). A person's own acts run as one of them. Copied to customise, never edited |
| The platform owns the work | Built-in and shared agents, skills and workflows are owned by the platform and keep who made them; a personal agent is its person's, granted to them alone. What an agent makes is the platform's, made by the person behind the run. Making or owning grants nothing ([AC-F07](../../os/access/features/AC-F07-ownership/feature.md)) |
| Nothing that ran is deleted | A retired agent, skill version or workflow version keeps its row and its name, so every run and who made whom still resolves |
| Limits read as a table | Each limit's value beside what it bounds — set once, read often — never a form of inputs |
| Every run reads one way | Runs, how agents are doing and every hand-off read from the same stored runs, so no two numbers disagree; runs are read in the Control Plane ([CP-F10](../../os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md)) |
| Skills are offered, never obeyed | A step is offered the skills its agent holds and says which it applied; what must hold is a policy rule or a checked model rule, never a skill ([AG-F04](features/AG-F04-skills/feature.md)) |
| Skills, plugins and functions declare needs | Usable when the needs are within the agent's policies and each graph database's mode allows it; refused otherwise, naming what is missing |
| What a step was given is kept by version | A step records the version of each skill it was offered and each workflow it ran |
| The ladder | One function → a workflow with new arguments → a plan composed from workflows → a new plan drafted; recall from the thinking graph comes first ([AG-F06](features/AG-F06-plans-and-workflows/feature.md)) |
| A plan becomes a workflow by approval | The agent's named approvers approve it for reuse; it is the platform's, made by the asker; a workflow is read-only and changes only as a new version ([AG-F06](features/AG-F06-plans-and-workflows/feature.md)) |
| Where a plan came from is always in the trace | Its rung, the workflows considered, what recall offered and avoided, and the check's result show on the run |
| A plan's steps are not tasks | A step that needs a person asks in the run; a project's task graph is the people's work, never a plan |
| Agents learn from Memory | Every plan, workflow, run, step, evidence, finding and decision is a node of [Memory](../../os/graph/features/GP-F02-memory/feature.md); recall ranks by outcome and keeps failures as *avoid*; learnings stay on their agent, attributed; agents propose org knowledge and a person promotes it ([AG-F09](features/AG-F09-learn-from-memory/feature.md)) |

## Depends on

| Product or capability | For |
|---|---|
| Control Plane | AI models, workers, plugins, graph databases, runs |
| Access Plane | Access Policies, asks and named approvers, ownership, History |

## Not building

| Item | Why not |
|---|---|
| Authoring a plan by hand | Plans come from the ladder; workflows from approval |
| An agent's private memory across runs | What runs teach is in the thinking graph, recalled and cited, or in skills and workflows a person changes ([AG-F09](features/AG-F09-learn-from-memory/feature.md)) |
| Agents accepting their own work | A finding or proposal an agent produced is reviewed by a person or another agent |
| Ranking skills, or picking them by similarity | A skill is offered or it is not; its *when to use* is written by a person and can be read |
| A skill or workflow an agent changes by itself | A suggested change waits for a person ([AG-F09](features/AG-F09-learn-from-memory/feature.md)) |
| Approving a workflow automatically when it served | Reuse is the named approvers' call; serving only makes it a candidate |
| Editing a built-in workflow or skill | It is the system user's; *Copy* makes a custom one, the platform's, made by the copier |
| A separate plan language for loading data | A load of many files is an ordinary plan that reuses the one-file load (RC-F02) |
