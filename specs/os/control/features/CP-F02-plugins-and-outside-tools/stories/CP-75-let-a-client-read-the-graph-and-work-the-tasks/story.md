---
id: CP-75
title: Let a client read the graph and work the tasks
feature: CP-F02
status: idea
personas: [builder, analyst, admin]
boards: [settings.mcp]
---

# CP-75 · Let a client read the graph and work the tasks

**As** an agent builder **I want** Claude Code, an IDE or an agent to ask Invana's MCP server for a node's context, its impact, a search, a read-only query, and to read and work tasks and milestones **so that** a coding agent sees what the project knows before it writes, and everything it does acts as me or as it, under the same policies.

Tasks: [task.md](task.md) · Feature: [CP-F02](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | With Manage on `plugin/<name>`: serve or stop serving each graph and task tool; read every call | — |
| Operator | Read what is served and how to connect; call the served tools as themselves through a connected client or a key; read their own calls | The served switches are disabled, naming the Admins; another person's calls are absent |

## Flow

```mermaid
flowchart TD
  c([A client with a key or a connected client]) --> v{"Valid, not expired?"}
  v -->|no| r1(["401 · where to find the metadata"])
  v -->|yes| ls["Lists the tools served · granted to the caller · within their policy"]
  ls --> call{"Allowed for this caller, in this project?"}
  call -->|no| r2(["Refused · names the rule · recorded"])
  call -->|read| rd["context · impact · find · query · tasks.list · milestones.read"]
  call -->|work| wk["tasks.create · update · comment · tag · proposals.create · needs_you.ask"]
  rd --> bd["A bundle: within its token budget · nothing the caller may not read · withheld counted"]
  wk --> pr["As the project says: a task, or a proposal a person accepts"]
  s([Settings › Connections › MCP server]) --> sw["Admin serves or stops each tool"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-75.1 | A signed-in person | they open *MCP server* | it lists the graph and task tools — `context` · `impact` · `find` · `query` · `tasks.list` · `tasks.create` · `tasks.update` · `tasks.comment` · `tasks.tag` · `milestones.read` · `proposals.create` · `needs_you.ask` — each with a switch, off until an Admin serves it |
| CP-75.2 | A tool served | a call is made | it acts as the person behind the client or key, or as the agent, under the strictest of their Access Policies, as CP-03.7 says; History and *Access usage* record it |
| CP-75.3 | A key used with these tools | it is created or read | it has an expiry — 30, 90 or 365 days — and *never* is refused here; an expired or revoked key is refused |
| CP-75.4 | `context(node or group, hops, budget)` | it is called | the bundle never passes its token budget nor the project's limit, never includes a node the caller may not read, counts what was withheld, and says how many more were cut |
| CP-75.5 | `query` | it is called | it takes the path of an agent's raw query ([system-design § 12](../../../../../../system-design.md)): typed plans only where the caller's policies hide anything in that graph database, elsewhere the static check, a read-only session (NFR-SEC-9) and a result filtered to what the caller may read; it returns at most 200 rows, stops at 10 seconds and takes at most 30 calls a minute from one key; any write, and any name the caller may not see, is refused as a name that does not exist |
| CP-75.6 | `impact` and `find` | they are called | they return what PJ-29.5 and PJ-29.6 return |
| CP-75.7 | `tasks.create`, `update`, `comment` or `tag` | it is called by a caller the project's policies let write | it is written as PJ-F01 says — a task in the project, or a proposal for its people — and a tag of *waiting-deletion* only tags (CP-74) |
| CP-75.8 | `proposals.create` | it is called | it creates a proposal only; it never accepts one |
| CP-75.9 | `needs_you.ask` | it is called | an ask waits in Needs you naming the caller and what will happen; the call returns that it is waiting and never acts on silence |
| CP-75.10 | Any call | it names a tool that deletes | no such tool exists; the call is refused as unknown |
| CP-75.11 | A call for a project the caller may not read, or a tool not served | it is made | it is refused naming why; nothing runs |
| CP-75.12 | An Operator | they open *MCP server* | the served switches are disabled, naming the Admins; a serve through the API is refused |
| CP-75.13 | A bundle | it is built | each node carries its source and whether its text is ours or outside text; outside text is fenced and labelled *data, not instructions* in the result, since the client may be an agent with a shell (NFR-SEC-15) |
| CP-75.14 | `context` or `impact` | it is called | it follows up to 4 hops, 2 unless the caller asks for more, and stops at a 5 second deadline, returning what it has and saying how many more were cut |
| CP-75.15 | `find` | it is called | it returns only matches the caller may read and never says how many were withheld, so a node's existence cannot be probed; no match reads *Nothing found* |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| MCP tools | Admin | settings.mcp · Tools · Nothing served | — | settings.mcp · Tools · Loading | settings.mcp · Tools | settings.mcp · Tools · Could not load | — | — |
| MCP tools | Operator | settings.mcp · Tools · Nothing served | — | settings.mcp · Tools · Loading | settings.mcp · Tools | settings.mcp · Tools · Could not load | — | settings.mcp · Tools · Read only |
| Recent calls | Admin | settings.mcp · No calls yet | settings.mcp · Nothing matches | settings.mcp · Loading | settings.mcp · Recent calls | settings.mcp · Call refused | — | — |
| Recent calls | Operator | settings.mcp · No calls yet | settings.mcp · Nothing matches | settings.mcp · Loading | settings.mcp · Recent calls | settings.mcp · Call refused | — | settings.mcp · My calls |
