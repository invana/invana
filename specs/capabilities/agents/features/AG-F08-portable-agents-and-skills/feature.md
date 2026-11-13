---
id: AG-F08
title: Portable agents and skills
product: AG
status: idea
personas: [admin]
stories: [AG-39, AG-40]
journeys: []
boards: [agents.skills, agents.skill, agents.agent]
nfrs: []
depends_on: [AG-F02, AG-F04, CP-F02, CP-F06]
---

# Portable agents and skills

> Agents and skills come in and go out as the open files other agent systems already use — an agent is a Markdown
> file with front matter, a skill is a `SKILL.md` folder — with Invana's own fields riding under `metadata:`. Other
> formats are read and converted, never written. A library becomes functions only once an Admin approves them. The
> decision it helps make: *is this outside agent, skill or library safe to let in, and what will it become here?*

## User journey

```mermaid
flowchart TD
  start([Agents › Skills]) --> imp["AG-39 · Import: a zip or a folder"]
  imp --> kind{"What came in"}
  kind -->|agent .md · SKILL.md folder| map["Every file: kind · what it becomes · ready, needs approval or refused"]
  kind -->|AGENTS.md · Codex TOML · Claude plugin bundle| conv["AG-39 · Converted — import only"] --> map
  kind -->|a hook · a command| rk["Refused, naming why"]
  map -->|a planned skill's line maps to no function| rf["Refused under the line — Import as guided · add a library or a plugin · edit the file"] --> imp
  map -->|a script in a skill| ap["Needs approval — CP-F06"]
  map -->|an MCP server a bundle names| ms["Listed for an Admin to add — CP-02"]
  map -->|ready| save["Import n — saved as drafts"]
  ap --> save
  save --> test(["Tested and published like any agent — AG-36"])
  start --> lib["AG-40 · Add a library — its package and docs"]
  lib -->|cannot be read| lx["Says why, naming the package"]
  lib --> prop["The functions Invana proposes, inputs and outputs as JSON Schema"]
  prop -->|Approve| fn(["Read-only functions skills may call"])
  prop -->|leave out| no(["Not a function"])
  start --> exp["AG-39 · Export one agent, one skill or all"]
  exp --> files(["Agent .md files and SKILL.md folders"])
  start -->|not an Admin| na["Import, Export and Add a library are absent"]
```

```mermaid
sequenceDiagram
  actor A as Admin
  participant S as Studio
  participant E as Engine
  A->>S: Drop a zip or a folder
  S->>E: dry run — read, convert, map, compile each planned skill's plan
  E-->>S: What came in — each file's kind, what it becomes, its state
  A->>S: Confirm descriptions and model versions · Import n
  S->>E: save as drafts
  A->>S: Add a library — package and docs
  S->>E: read the package and its docs
  E-->>S: proposed functions — name, JSON Schema inputs and outputs, what each reaches
  A->>S: Approve, function by function
  S->>E: register each approved function, read-only
```

## Stories

| ID | Story | Status |
|---|---|---|
| AG-39 | [Bring agents and skills in as standard files, and export them](stories/AG-39-bring-agents-and-skills-in-as-standard-files-and-export-them/story.md) | idea |
| AG-40 | [Turn a library into functions an Admin approves](stories/AG-40-turn-a-library-into-functions-an-admin-approves/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Import agents and skills · export them | Admin | *Import* and *Export* are absent |
| Add a library · approve the functions it proposes | Admin | *Add a library* is absent; proposed functions read *Waiting for an Admin* |
| Approve a skill's script | Admin (CP-F06) | As CP-F06 |
| Read imported agents, skills and approved functions | Operator — every member of the install | — |

## States

| State | What the person sees |
|---|---|
| First use | Import reads *Drop a zip or a folder* with the formats it takes; *Tools they call* reads *No libraries* |
| Empty after a filter | — |
| Loading | Import reads *Reading the files…*; a library reads *Reading the package…* |
| Has data | *What came in* with every file's kind, what it becomes and its state; a library's proposed or approved functions |
| Failed | A refused file or line names why and what would make it map; a package that cannot be read is named |
| Agent working or proposing | Import mapping and converting the files and compiling each planned skill's plan; Invana proposing a library's functions |
| No access | Import, Export and *Add a library* are absent; everything saved reads |

## Rules

| Rule | Detail |
|---|---|
| An agent is a Markdown file | YAML front matter `name` · `description` · `model` · `tools` · `skills`, the body its instructions — the Claude-style agent file |
| A skill is a `SKILL.md` folder | The Agent Skills folder: `SKILL.md` with `name` and `description` in its front matter, and `references/`, `scripts/`, `assets/` beside it (AG-F04) |
| Invana's fields ride under `metadata:` | Voice, effort, when to use, how a skill runs, model version — every field the open format lacks; a file without them still imports |
| Read many, write one | `AGENTS.md`, Codex TOML agent files and Claude plugin bundles are import-only: converted to an agent `.md` and skill folders. Export writes only those two |
| The file round-trips | An exported agent or skill imports back unchanged |
| A dry run first | Every file is converted and mapped, every planned skill's plan compiled and every refusal named before anything is saved |
| Imported means draft | Imported agents and skills are drafts, tested and published like any other (AG-36) |
| Code only by approval | A library reaches a plan only as a function an Admin approved, read-only from then; a script runs only once an Admin approved it (CP-F06) |
| A plan is not portable | It is Invana's cache of a skill's text (AG-F04): never exported, compiled again on import |
| Nothing a bundle names starts | An MCP server in a bundle is listed for an Admin to add (CP-02); hooks and commands are refused |
| Leans on | The catalogue (AG-F02) · skills (AG-F04) · plugins and MCP servers (CP-F02) · skill scripts (CP-F06) · AI models (CP-F01) |

## Data touched

| Record | Read or write |
|---|---|
| Agents and skills of the install, and their versions | Write on import · read on export |
| An import's dry run — each file, its kind, what it becomes, its state | Read |
| A library, its proposed functions, their JSON Schema contracts and their approval | Write · read |
| Exported files | Read |

## Engine

### Records

| Table | Columns | Notes |
|---|---|---|
| — | — | An import writes AG-F01's and AG-F04's rows as drafts and stores nothing of its own; the dry run is returned, never saved. Where a library and its approved functions are kept is an open question below |

### Reads

| Record | Owner |
|---|---|
| Agents and their versions — written as drafts on commit, read on export | [AG-F01](../AG-F01-build-an-agent/feature.md#engine) |
| Skills, their versions, `folder` and `metadata`; the draw that compiles a planned skill | [AG-F04](../AG-F04-skills/feature.md#engine) |
| The function catalogue a plan maps to | [AG-F06](../AG-F06-plans-and-workflows/feature.md#engine) |
| Model versions offered, for an alias | [CP-F01](../../../../os/control/features/CP-F01-ai-models/feature.md#engine) |
| MCP servers an Admin adds · plugins enabled | [CP-F02](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#engine) |
| Scripts and their approval | [CP-F06](../../../../os/control/features/CP-F06-skill-scripts/feature.md#engine) |

### Routes

| Route, install-wide, after `/api/v1/catalogue` | Does | Story |
|---|---|---|
| `POST /import` | The dry run: every file, its kind, what it becomes, its state (`ready` · `needs approval` · `refused`) and each mapped field beside its source; nothing saved | AG-39 |
| `POST /import/commit` | Save every agent and skill of a dry run with nothing refused, as drafts | AG-39 |
| `GET /agents/{id}/export` · `GET /skills/{id}/export` · `GET /export` | One agent `.md` · one `SKILL.md` folder · a zip of the whole catalogue | AG-39 |
| `POST /libraries` | Read a package and its docs; proposes typed functions | AG-40 |
| `POST /libraries/{id}/functions/{fn}/approve` | Register a proposed function, read-only from then | AG-40 |

### Events

| Event | When |
|---|---|
| `agents.create` · `agents.skills.create` | Each imported agent and skill, as AG-F01 and AG-F04 emit them |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| refused (a row of the dry run) | A planned skill's line no function maps to | *{line} maps to no function — add a library, enable a plugin, or rewrite it.* | AG-39.5 |
| refused (a row of the dry run) | A `references/` file over the size limit | *{file} is over {limit} characters.* | AG-39.9 |
| refused (a row of the dry run) | An MCP server started as a local process | *Invana reaches MCP servers by address.* | AG-39.16 |
| refused (a row of the dry run) | A hook, a command or any other file a bundle carries | *{file} is a {kind}; Invana runs no hooks or commands.* | AG-39.17 |
| 409 | `POST /import/commit` while any row is refused | *Fix or leave out the refused files first.* | AG-39.10 |
| 422 | A package that cannot be found or read | *{package} could not be read: {reason}.* | AG-40.7 |
| step refused | A plan naming a library function no Admin approved | *{function} is not approved.* | AG-40.4 |
| 403 | Import, export, add a library or approve a function without Admin | *Only an Admin does this.* | AG-39.13 · AG-40.10 |

### CLI

| Command | Does |
|---|---|
| `invana agents import <path> [--commit]` | The dry run; with `--commit`, saves it |
| `invana agents export [<name>]` | One agent or skill, or the whole catalogue |

### Mechanisms

| Mechanism | How |
|---|---|
| Read many, write one | Agent `.md` files and `SKILL.md` folders import and export; `AGENTS.md`, Codex TOML and Claude plugin bundles are converted on import and never written |
| Invana's fields | Read from and written under `metadata:`; a file without them still imports |
| A planned skill on import | Its plan is compiled in the dry run by AG-F04's draw; the plan is never exported |
| A library | Read from its package and docs; each proposed function declares inputs and outputs as JSON Schema and what it reaches, and the steps record which part of the docs each came from |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 8 APIs and events | Install-wide routes under `/api/v1/catalogue` and the CLI above | — |
| § 11 Failure modes and the outside boundary | Outside files and packages are read, never run; a library's code reaches a plan only as an approved function | — |
| § 12 Qualities | Security: no hook, command or local-process server from a bundle runs | — |

## Decisions

| Decision | Detail |
|---|---|
| Model aliases on import | `sonnet` · `opus` · `inherit` resolve to an exact offered version, shown for the Admin to confirm |
| A name already in the catalogue | Offered as a new version of it, or a rename |
| `AGENTS.md` | One draft agent, its body the instructions, named after its folder for the Admin to confirm |
| Codex TOML | Converted to the agent `.md` shape; every mapped field shown beside its source, an unmapped one named as left out |
| A Claude plugin bundle | Its agents and skills import; its MCP servers are listed for CP-02; a local-process server, a hook or a command is refused |
| A planned skill that will not compile | Refused under the line, with *Import as guided* (AG-F04) beside the refusal |
| Function contracts | A library's proposed functions declare their inputs and outputs as JSON Schema, as every function does (CP-F02) |
| Export | One agent, one skill or all; the plan is not exported |
| Versions of each format | [System design § 11](../../../../system-design.md#11-failure-modes-and-the-outside-boundary) › *Standards* |
| Not built yet | Import, export and libraries have no engine yet |

## Open questions

| Question | Who answers |
|---|---|
| `AGENTS.md` imports as one agent (recommended), or as rules of the graph (SE-F07)? | Ravi |
| A planned skill that will not compile on import: offer *Import as guided* (recommended), or refuse until the file is fixed? | Ravi |
| Where a library and its approved functions are kept, when the function catalogue is code (AG-F06) — two tables, `agents_libraries` and `agents_library_functions` (name, JSON Schema contracts, status `proposed · approved`, who approved) (recommended), or a generated plugin package an Admin installs? | Ravi |

## Not building

| Item | Why not |
|---|---|
| Exporting `AGENTS.md`, Codex TOML or plugin bundles | One portable format each for agents and skills; every other one is read only |
| Running a bundle's hooks or commands | Invana runs no code it did not approve, and a command is a prompt for a person at a terminal |
| Adding a bundle's MCP servers on import | An Admin adds a server deliberately (CP-02) |
| A remote catalogue or hub | Later |
| A function editor | Functions are code |
| Code generated per run, or frozen into a plan at publish | Runs must reproduce, and installs on premises run only approved code |
