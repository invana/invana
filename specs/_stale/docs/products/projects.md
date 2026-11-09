# Invana Projects — pursue and decide

Product spec: [Projects](../../specs/capabilities/projects/product.md) — its features PJ-F01–PJ-F05 hold the stories, project types, branches, evidence, visibility, reports and product decisions. What stays here is the CLI and the Studio layout rows the spec does not carry yet.

System design: [api-and-cli.md](../../specs/system-design/api-and-cli.md) — the CLI. This file keeps the CLI's build status.

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## CLI — build status

What each command does, and the conventions, are in [api-and-cli.md](../../specs/system-design/api-and-cli.md). This keeps where each stands.

| Command | Status |
|---|---|
| `invana projects list` · `create <name> --type research\|policy\|general --question "…" [--private]` · `show` | ✅ B05 |
| `invana branches list --project` · `fork <b> --into "…" "…"` · `merge <from> <into>` | ✅ B05 |
| `invana findings add --branch --stance supports\|contradicts\|context --cites <record…>` · `review` | ✅ B05 |
| `invana branches decide <b> --verdict … --decision … --rationale "…"` | ✅ B05 |
| `invana proposals list` · `accept` · `reject` | ✅ B05 |
| `invana todos list [--mine]` · `add` · `done` | ✅ partly (today's projects API) · New CLI |
| `invana reports generate --project` · `publish` · `export --format md` | ✅ B05 |
| `invana lineage --decision <id>` | New · P-10 |
| `invana simulate --project --branch --plugin <name> --file <spec>` · `invana simulations list` · `show` | ✅ B09 |

## Decisions

Today's Studio layout — a rail and a stack — which the design language's modes replace; and two rows the spec leaves open.

| Decision | Detail |
|---|---|
| Rail → path | Projects `/projects[/:project]` · My todos `/projects/todos[/:todo]` · Decisions `/projects/decisions`. A project's key sits right under the product root, so `todos` and `decisions` are not usable project keys. The rail lights the longest-matching item |
| One stack, two rail items | Projects and My todos are the two sections of today's Projects stack (Projects over Todos), as Agents and LLMs share one stack |
| My todos | With no project open, the Todos section lists the signed-in person's Todos (`assignee` = them) and its header reads *My todos*; with a project open it reads *Todos* and lists the project's |
| Pages in `mainSection` | A project, a branch, a finding and Decisions are pages, not stack sections. A project opens as the Studio-only declared board `project:<key>` when the stack drills into it (a cold `/projects/<key>` included); Decisions opens as `decisions:<graph>` on the move into the rail item and has no left column. The Projects stack stays in `leftSection` beside the page |
| Plan canvas | The Projects stack's Plan tab brings the plan canvas in front of any focused page |
| Not on the page yet | *Datasets* as a tab of its own — the Overview lists a project's datasets, which are its findings' dataset cites; a branch's *Runs* and *Schedules* tabs |
| Staffing people | The creator is staffed by the engine; other people cannot be staffed from Studio yet, because the Graph's member list carries no user id |
| Assignees | A Todo's agent picker reads the agents list through `ProjectsSlotsContext.useAgents`, because Projects may not import the Agents product |
