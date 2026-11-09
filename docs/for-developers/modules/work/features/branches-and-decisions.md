# Branches, findings and decisions

A project is one question of one **type**. Its lines of inquiry are **branches**; evidence for and
against each is a **finding**; a person closes a line with a **verdict** and a **decision**, checked by
the rules in force. Agents **propose**; people decide.

| | |
|---|---|
| Index | [9.5](../../../README.md#9--work) · B05 |
| Module | [Work](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Product | capabilities/projects.md PJ-F1 · PJ-F2 · PJ-F3 · PJ-F4 · PJ-F5 |
| Related | [projects-and-tasks](projects-and-tasks.md) · [project-reports](project-reports.md) · [private-projects](private-projects.md) · [rules](../../skills/features/rules.md) · [datasets](../../bring-data-in/features/datasets.md) |

Product spec: [PJ-F03 · Branches, findings and decisions](../../../../../specs/capabilities/projects/features/PJ-F03-branches-findings-and-decisions/feature.md) — PJ-03 · PJ-04 · PJ-05 · PJ-06 · PJ-07 · PJ-08 · PJ-11 · PJ-13; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `projects` gains | `type` (default `general`) · `question` · `visibility` ([9.7](private-projects.md)) |
| `project_branches` | `project_id` · `number` (per project) · `parent_id?` · `title` · `body` · `status (open\|pursuing\|parked\|dropped\|merged)` · `merged_into_id?` · `created_by_*` |
| `project_findings` | `project_id` · `branch_id` (added on) · `number` · `statement` · `stance` · `cites[]` · `added_by_kind (user\|agent)` · `added_by_id` · `reviewed_by_id?` · `reviewed_at?` |
| `branch_findings` | `branch_id` · `finding_id` · `via (own\|fork\|merge)` — a branch's evidence is its links |
| `project_decisions` | `project_id` · `branch_id` · `number` · `verdict` · `choice` · `rationale` · `cites[]` (finding ids) · `addresses[]` · `into_branch_id?` · `supersedes_id?` (unique) · `checks[]` · `warnings[]` · `decided_by_id` |
| `project_proposals` | `project_id` · `branch_id` · `number` · `kind (fork\|decision)` · `payload` · `rationale` · `status (open\|accepted\|rejected)` · `agent_id` · `submitted_by_id` · `resolved_by_id?` · `note` · `result` |
| `todos.branch_id?` | A todo filed on a branch of its project |
| A cite | `{kind: record\|dataset\|run, ref}` — a dataset cite is `publisher/name@v`, resolved to `version_id` on add |
| Rule checks | acts `project.decide`; kinds `evidence.reviewed` · `evidence.not_retracted` at scopes install · graph · project |
| Routes | `…/projects/{key}/branches` · `/{n}` · `/{n}/fork` · `/{n}/findings` · `/{n}/decisions` · `/{n}/proposals` · `…/projects/{key}/findings/{n}/review` · `…/projects/{key}/proposals/{n}/accept\|reject` · `GET …/decisions` |
| Events | `branch.fork` · `finding.add` · `finding.review` · `decision.record` · `proposal.submit · accept · reject` |

### Seams

| Seam | What the caller gets |
|---|---|
| A type not switched on | 422 naming the launched types |
| Fork of a dropped or merged branch | 409 — revisit it with a superseding decision first |
| Contradicting finding not addressed | 422 naming each one by number |
| A rule blocks | 409 `blocked by rule — "<statement>": <reason>`; nothing written, events included |
| A rule warns | 201, `warnings[]` on the decision |
| Deciding a branch that already has one | 409 naming the current decision; the new one must `supersedes` it |
| Supersede without newer evidence | 422 — cite a finding added after the decision it supersedes |
| Merge into itself or a dropped branch | 422 |
| Merge into another project's branch | 404 — branches are addressed by number inside the project |
| A proposal already resolved | 409 |
| An archived project | 409 on every write, as for its todos |
| A dataset cite that does not resolve | 422 on the finding |

### Studio consumes

Studio is `@invana-studio/projects` `src/project/`; a project is the declared board `project:<key>`.

| Component | Consumes |
|---|---|
| `ProjectPage` · `BranchTree` | `GET …/projects/{key}` · `…/branches` · each `…/branches/{n}` · `…/assignments` |
| `ForkDialog` | `POST …/branches/{n}/fork` |
| `BranchView` | `GET …/branches/{n}` · `POST …/proposals/{n}/accept\|reject` · `POST …/tasks` with `branch` |
| `FindingView` · `AddFindingDialog` | `GET …/findings/{n}` · `POST …/findings/{n}/review` · `POST …/branches/{n}/findings` |
| `DecideDialog` | `POST …/branches/{n}/decisions` |
| `DecisionsPage` | `GET …/decisions` · each project's `…/assignments` for *By* |
| CLI | `invana branches · findings · proposals` |

## Decisions

Engine rows; the product decisions are PJ-F03's.

| # | Decision |
|---|---|
| BD1 | The stored verdict and decision are the **canonical** words (`supported · refuted · inconclusive`; `pursue · park · drop · merge`); the type is a label table read on the way out. Changing a type only relabels — nothing is rewritten. |
| BD2 | Launched types are `research · policy · general`. The other three are in the label table and refused at create with 422 until switched on in code. |
| BD3 | A branch is addressed by `number`, one counter per project, because people type it (`b3`). Findings, decisions and proposals number the same way, each with its own counter. |
| BD4 | A branch's evidence is its `branch_findings` links. Fork links the parent's findings into each child (`via = fork`); merge links the chosen findings into the target (`via = merge`). References are copied, never findings. |
| BD7 | One current decision per branch. A new decision on a decided branch must name it in `supersedes` (409 otherwise) and cite at least one finding added after it (422 otherwise). Nothing edits or deletes a decision. |
| BD8 | The verdict must address every `contradicts` finding linked to the branch: `addresses` lists them, and a missing one is 422 naming it. A built-in rule, not a configurable one. |
| BD9 | Decide reads every active rule whose check names `project.decide`, at install, Graph and project scope, **before** writing. Block → 409 naming each rule and the evidence that broke it; warn → `warnings[]`; report → the `rule.check` event only. The decision stores the rules it was checked against in `checks[]`. |
| BD10 | Two decide checks: `evidence.reviewed` (every cited finding was reviewed by a person) and `evidence.not_retracted` (no cited finding cites a retracted dataset version). |
| BD12 | A proposal is attributed to an **agent** of the Graph, with `submitted_by_id` naming the signed-in principal that sent it. Accepting a decision proposal runs the full decide — rules included — as the accepting person; a refusal leaves the proposal open. |
| BD13 | Verdicts and decisions are always a person's: no route takes an agent as the decider. |
| BD14 | Merge needs `into` (another branch of the same project, not dropped or merged) and optionally the finding numbers to carry; with none named, every finding on the source is carried. |
| BD15 | The Graph's decisions list (`GET …/decisions`) is a read across projects, filtered to the projects the reader may see ([9.7](private-projects.md)). |
| BD18 | **Current is counted by the engine.** The decisions lists (`GET …/decisions`, `GET …/projects/{key}/decisions`) return `current` beside `total`: the listed decisions no later one supersedes. The Decisions page's `2 current · 5 recorded` is those two numbers, and reads `5` alone when they match. |
