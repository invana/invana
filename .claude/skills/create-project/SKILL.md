---
name: create-project
description: Plan a project with Ravi — interview him until the goal, scope and what "done" means are clear, read what the work touches, split it into phases sized for one or two sessions each, and write .claude/team/projects/<name>/project.md for the project-lead to run with /run-project. Use when Ravi asks to create, plan or start a project, or types /create-project. Writes nothing until he approves the plan.
---

# Create a project

A project is work too big for one session: several phases, run unattended by the **project-lead** with `/run-project`,
watched on `/project-dashboard`. This skill plans it; it never runs it. The product-manager runs it as its own
procedure; any session may.

**Talk is not a request to write.** Steps 1–4 write nothing. The project file is written in step 5, after Ravi says
yes to the plan.

## 1. Interview

Ask in batches of at most four, each with your recommended answer first, until every row is settled. Read before you
ask — never ask what a file already answers.

| Settle | Ask |
|---|---|
| Goal | What is true when this is done? For whom? |
| Why now | What it unblocks, or what hurts until it is done |
| Done when | What a reviewer checks — observable, never "improved" or "cleaner" |
| Scope | Which files, products, modules or specs are in; what is explicitly out |
| Must not break | Capabilities, demo data, links, other sessions' work, rules agents follow |
| Approvals | Which phases stop for Ravi before they count as done (`Approve: Ravi`) |
| Type | Which row of *Project types* below it is — or what it is if none fits |
| Budget | Anything that cannot be split below 300k context per session (rare; needs a reason) |

## 2. Investigate

Read what the work touches and size it: files and lines, specs and stories with their statuses, boards, routes, tests,
who links to what. Note what other live sessions are editing (`git status`, `/project-dashboard`) — a project never
plans over their files.

A project builds only what its specs say: every story a phase builds is `designed`, or the phase is docs-only. A phase
names its stories in *Stories*; the work inside one is the story's `task.md`, which the phase's agent fills for its
role — a phase never lists tasks. A gap in
the specs is a `/product-spec` job first, not a phase.

## 3. Shape the phases

| Project type | Phase shape | Agent | Gates | Review |
|---|---|---|---|---|
| Docs cleanup | inventory → restructure → verify | coder | link check · `scripts/specs/check.py` | blank · Approve: Ravi |
| Doc-format migration | foundations → **is it built?** (QA audits every claim: ✅ · 🟡 · ❌ with evidence) → one phase per feature, the spec written from the doc and the audit → clean the old docs | product-manager; the audit is `qa` | `scripts/specs/check.py` · link check | blank · Approve: Ravi per phase |
| Design migration | docs first, then one phase per surface | coder | lint · types · tests · e2e | qa |
| Feature build | contract → engine → Studio, per story | coder | lint · types · tests · e2e | qa |

*Review* is `qa` (pass 1 always, pass 2 when the phase names boards) or blank. *Approve: Ravi* is an `Approve` row in the
entry: the runner pauses the project after that phase is done, until Ravi starts it again. A phase whose agent is `qa`
is an audit — it proves and records in its report. QA never edits code, tests or docs; what should be added goes to
`.claude/team/agents-recommendations.md`, and the product manager takes it up as a session, a phase or a project.
A phase writes only what its agent's role writes (`.claude/team/TEAM.md` §1 *Edit rights*): docs for the
product-manager, code and tests for the coder.

| Rule | Detail |
|---|---|
| One deliverable a phase | One surface, one engine module or one doc set — never "the product" |
| Fits one or two sessions | A phase that reads or writes more than ~40 files, or two products, is split |
| Leaves the tree green | No phase breaks something a later phase repairs |
| Ordered by Needs | A phase starts only when every phase it needs is `done` |
| Done when is checkable | A reviewer, or a gate, can say yes or no to it |
| First phase is cheap | When the shape is uncertain, P01 is an inventory or a report Ravi approves before anything is changed |
| One owner per design section | A phase that changes `specs/system-design.md` names the sections it edits in *Lands*; no two phases that can run together edit the same section |

## 4. Show the plan

Present it in the reply, not a file: goal · scope · out of scope · the phases as a table (ID · phase · agent · needs ·
done when · approve) · gates · risks · open questions. Ravi approves, changes or drops it. Loop until he approves.

## 5. Write

1. `.claude/team/projects/<name>/project.md` from `.claude/skills/run-project/project-template.md`, every placeholder
   filled, `status: draft`, `branch:` the branch the checkout is on. Every phase has its entry and its Log row.
2. Show Ravi the file's path and the phase table once more. On his yes, set `status: ready`.
3. Hand off: Ravi starts `claude --agent project-lead` and says "run `<name>`". Never start the run yourself.

## Not this skill

| Want | Use |
|---|---|
| A new feature or story | `/product-spec` first; a project only builds what is specified |
| Running, stopping or triaging a project | the project-lead with `/run-project` |
| Watching it | `/project-dashboard` |
