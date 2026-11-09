---
id: RT-F02
title: Plugins and outside tools
product: RT
status: idea
personas: [admin, builder, curator]
stories: [RT-02, RT-03, RT-04]
journeys: []
boards: [settings.ai]
depends_on: [AC-F02, RT-F03, AG-F06, AC-F05, DS-F01]
---

# Plugins and outside tools

> Where the install meets the outside, in both directions: tool plugins — every one an MCP server, the web, mail and
> science tools Invana ships and the outside servers an Admin adds — whose tools agents may call, and this Graph's own
> MCP server that Claude Code and other callers use. The decision it helps make: *what may agents reach outside Invana, and what may the outside reach in here?*

## User journey

```mermaid
flowchart TD
  s([Settings › Invana]) --> pl["RT-04 · Plugins: every plugin, its functions, skills and plans"]
  pl -->|not installed| ni["Names the extra that installs it"]
  pl -->|Admin turns a tool plugin on| on(["Agents may call its functions · from the next step"])
  pl -->|without Admin| pa["Switch disabled · names the Admin"]
  s --> ai["Settings › AI and connections"]
  ai --> mc["RT-02 · Add an MCP server by address and name"]
  mc -->|cannot list its tools| mf["Names the address and what failed · nothing stored"]
  mc -->|listed| fz(["Its tools frozen as functions · off until turned on"])
  fz --> rf["RT-02 · Read its tools again → a new revision"]
  ai --> sv["RT-03 · This graph's MCP server: what it serves · Claude Code line · recent calls"]
  sv -->|Can build agents| sw(["Serve an agent or a function"])
  sv -->|without the grant| sd["Switches disabled · Ask Priya"]
  out([Claude Code · any MCP client · a bot]) -->|a key| call{"Key valid, here, allows it?"}
  call -->|no| rj["Refused · names the key and its rule · recorded"]
  call -->|yes| run(["RT-03 · A run, as the key's holder ∩ the agent · in History"])
  run -->|a draft dataset version| pub(["A person publishes it (DS-F01)"])
  run -->|calls a tool that sends · Ask on the starting lines| ap["Waits for a yes in Needs you (AC-15)"]
```

```mermaid
sequenceDiagram
  actor C as Claude Code
  participant E as This graph's MCP server
  participant R as A run
  actor O as Dataset owner
  C->>E: list tools (with a key)
  E-->>C: only what is served
  C->>E: check records
  E->>R: opens a run as the key's holder, narrowed by the key
  R-->>C: valid · rejected, each named — nothing written
  C->>E: push a draft version
  E->>R: a run · draft stored, never current
  R-->>C: dataset · draft version · record count
  O->>O: reads the draft in Data · publishes it
```

## Stories

| ID | Story | Status |
|---|---|---|
| RT-02 | [Add an outside tool server and let agents call its tools](stories/RT-02-add-an-outside-tool-server-and-let-agents-call-its-tools/story.md) | idea |
| RT-03 | [Let Claude Code and other callers use this graph](stories/RT-03-let-claude-code-and-other-callers-use-this-graph/story.md) | idea |
| RT-04 | [See every plugin and turn a tool plugin on](stories/RT-04-see-every-plugin-and-turn-a-tool-plugin-on/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read every plugin, its functions, skills, plans and versions | Operator — every member | — |
| Turn a tool plugin on or off | Admin | The switch is disabled, naming the Admin |
| Add an MCP server · read its tools again | Admin | *Add a server* is disabled, naming the Admin |
| Read this graph's MCP server — address, what it serves, the Claude Code line, recent calls | Operator — every member | — |
| Serve an agent or a function over this graph's MCP server | `builder` · shown as *Can build agents* | The switches are disabled — *Ask Priya*, naming someone who can build agents |
| Call this graph from outside | Whoever holds a key minted in this Graph (AC-10), as that holder, narrowed by the key | Refused, naming the key and its rule |
| Publish a draft version pushed from outside | The dataset's owner (DS-F01) | As DS-F01 |
| Say yes to a tool that sends | As AC-F05 | As AC-F05 |

## States

| State | What the person sees |
|---|---|
| First use | Plugins: core plugins on, tool plugins off · MCP servers: none, *Add a server* · this graph's server: nothing served, *No calls yet* with the line to connect |
| Empty after a filter | Plugins filtered to none: *No plugin matches* |
| Loading | The section opens at once; rows fill in place |
| Has data | Plugins with their switches · MCP servers with their tools and revision · what this graph serves and its recent calls |
| Failed | A server that cannot be reached, named with what failed; a plugin not installed, naming its extra; a call refused, naming the key and its rule |
| Agent working or proposing | A run reaching a tool that sends waits for a yes in Needs you (AC-15) |
| No access | Every list reads; switches and *Add a server* are disabled, naming who can |

## Rules

| Rule | Detail |
|---|---|
| A plugin is a package | A versioned package of functions, skills and plans, of three kinds: core and simulator plugins, Invana's own, and tool plugins |
| A tool plugin is an MCP server | Every tool plugin speaks MCP: the web, mail and science tools Invana ships are MCP servers it runs on its workers, and an outside server an Admin adds is one more. Both are listed, frozen, versioned and switched the same way |
| Core and simulators stay Invana's own | Core and simulator plugins are Python in the engine, not MCP servers; their functions keep the same contracts |
| Every function's contract is JSON Schema | Its inputs and outputs are a JSON Schema — a tool's input and output schema as its MCP server lists it, or the schema an Invana function declares; a plan is checked against them when it is drawn |
| Graph connectors are not plugins | A connector package registers itself through a Python entry point (`specs/system-design/integrations.md`); it reaches the graph database, not the outside |
| Core is always on | Core plugins and simulators are the product and never switch; tool plugins are off until an Admin turns them on |
| Turning on is a gate, not an install | It takes effect from the next step dispatched — no restart. What a process can run is fixed when it starts |
| Installed is the engine's word | A tool plugin whose extra is not installed is listed as not installed, naming the extra; its functions cannot be planned |
| A function keeps its version | Each function versions on its own; a run records the version it ran; after a breaking version the previous one serves re-runs for a while |
| Plans come two ways | *Generated* from a skill's instructions, or *packaged* in a plugin; a person never writes a plan in Studio |
| A tool that sends starts at Ask | A function that sends — mail, any call carrying Graph data out of the install, any MCP tool whose read-only hint no Admin confirmed for its revision — is a send, at Ask on every starting line but the Owner's ([Which act a call is](../../../access/product.md#decisions)); asking, it waits for a yes in Needs you, and a no fails it as *not sent* |
| Each tool shows its mode | Every function reads its mode for this Graph — Allow · Ask · Deny — and who set it |
| Outside work runs on workers | Tool and MCP steps run on workers, never in the engine serving Studio; with no worker free they wait, then fail saying no worker took them |
| Secrets stay on the workers | A function reads only the secrets its plugin declares, from the worker's environment; nothing rides a run |
| The web tools cite and respect robots.txt | Every row a web or science tool returns carries its address; a page robots.txt disallows is not read |
| An MCP server's tools are frozen | The list an Admin saw when adding it; a later change on the server reaches no plan until an Admin reads its tools again |
| One server, one plugin | Its tools are functions `mcp.<server>.<tool>`; reading them again is a new revision, and only a changed tool's version moves |
| This graph's server serves what a builder chose | Everything starts not served; an agent is served as *ask* it, a function by its tool name |
| Only a key connects | A caller connects with a key minted in this Graph; a sign-in session is refused |
| Every call is a run | As the key's holder, narrowed by the key's own rule, in Runs and History; a refusal before a run is recorded, not run |
| Outside callers read, with sources | Every answer carries where its records came from; anything out of a key's reach is refused, never silently filtered |
| The only write is a draft | A draft dataset version — numbered, never current — that a person publishes |
| Versions | The MCP and JSON Schema versions Invana speaks are pinned in `specs/system-design/integrations.md` › *Standards* |
| Leans on | Keys (AC-10) · plans and functions (AG-F06) · asks in Needs you (AC-F05) · draft dataset versions (DS-F01) · workers (RT-F03) · History (AC-F06) |

## Data touched

| Record | Read or write |
|---|---|
| Plugins and whether each is on | Read · write |
| MCP servers — address, revision, frozen tools | Read · write |
| What this graph serves | Read · write |
| Runs triggered over MCP, with the tool, key and client | Write · read |
| Draft dataset versions (DS-F01) | Write |
| History rows of every switch, add, refusal and call (AC-F06) | Write |

## Decisions

| Decision | Detail |
|---|---|
| Plugins and connections are Settings › Invana | Plugins, MCP servers, this graph's server and outside agents are administered in Settings, not in Agents; Agents lists the functions they add |
| MCP carries tools, outside agents carry tasks | Outside agents are AG-F05; this feature is tools and callers |
| Streamable HTTP only | An MCP server is reached by address; Invana starts no third-party process on its own machine. The tool plugins it ships run on its workers and are reached the same way |
| One bearer token per outside server | Set on the workers, never stored in Invana |
| No retries for an outside tool | A blind retry of a send is a second send |
| Served functions | *Check records* and *Push a draft version*; served agents answer one question each |
| The engine writes the result line | Each call's one-line outcome is stored when its run settles; Recent calls only shows it |

## Open questions

| Question | Who answers |
|---|---|
| Plugins has no board (the Settings modal's *Invana › Plugins* entry draws none). Recommend: the designer draws `settings.plugins`; RT-04's cells name it once drawn | Ravi |
| May an Admin remove an MCP server? Recommend: no — turning it off stops every call, and removing would orphan the versions old runs recorded | Ravi |

## Not building

| Item | Why not |
|---|---|
| Starting outside servers on Invana's machine (stdio) | No third-party processes beside the engine |
| OAuth for outside servers or callers | A bearer token or a key covers it now |
| MCP resources, prompts, sampling, elicitation | Plans call tools; the rest has no place in a plan |
| Following a server's changed tool list | The list is frozen until an Admin reads it again |
| An Admin marking a tool read-only | An Admin only confirms the server's own hint, per revision; a tool the server does not mark stays a send |
| Hot-loading a new or refreshed server | What a process runs is fixed when it starts |
| A raw graph query as a served tool | Served agents answer with records cited |
| A general write path from outside | Writes have contracts; only a draft push writes, and a person publishes |
| Webhooks | Polling with sources is simpler to reason about and to audit |
| Third-party plugin packages outside the engine | A third party's tools arrive as an MCP server an Admin adds (RT-02); core and simulator plugins stay in the engine |
| A tool interface of Invana's own | One interface — MCP — for every tool, shipped or added |
| A secrets store in Invana | The worker's environment is enough for now |
