---
id: CP-03
title: Let Claude Code and other clients use the deployment
feature: CP-F02
status: idea
personas: [builder, curator, analyst, admin]
boards: [settings.mcp]
---

# CP-03 · Let Claude Code and other clients use the deployment

**As** an agent builder or data curator **I want** Claude Code, an IDE or a script to check records, load records and
ask an agent through the deployment's one MCP server, as me **so that** data arrives without Invana pulling it, a
client never reaches more than I may, and every load is checked and can be undone.

Tasks: [task.md](task.md) · Feature: [CP-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Serve or stop serving an agent or a record tool; read the address, how to connect and every call | — |
| Operator | Read the address, what is served and how to connect; call the server as themselves through a connected client (AC-F11) or a key (AC-F10); read their own calls | The served switches read, naming the Admins; another person's calls are absent |

## Flow

```mermaid
flowchart TD
  s([Settings › Invana › MCP server]) --> w["Address · what it serves · how to connect"]
  w -->|Admin| on(["Serve or stop serving an agent · Check records · Load records"])
  w -->|not an Admin| dis["Switches read · naming the Admins"]
  c([A client]) --> v{"A connected client or a key?"}
  v -->|neither| r1(["401 · where to find the metadata"])
  v -->|yes| ls["Lists what is served and the person's agents may use"]
  ls --> call{"The person's agents may make this call?"}
  call -->|no| r2(["Refused · names the rule · recorded"])
  call -->|yes| run(["A run as the person, through the agent"])
  run -->|check records| ck(["Valid · rejected, each named · nothing written"])
  run -->|load records| dr{"A read + write graph database · Write allowed?"}
  dr -->|no| df(["The run fails, naming why"])
  dr -->|yes| dv(["A load · checked against the model · rejected record by record"])
  run --> rc["Recent calls shows it"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-03.1 | A signed-in person | they open *MCP server* | its address, how to connect — with a connected client or with a key — what it serves with a switch each, and their recent calls read |
| CP-03.2 | Nothing served yet | the page opens | every agent and record tool that may be served lists with its switch off, and recent calls says *No calls yet* with how to connect |
| CP-03.3 | An Admin | they serve an agent or a record tool | a caller lists it from their next call, if the person's agents may use it — an agent as `ask_<agent>`, *Check records* and *Load records* by their tool names |
| CP-03.4 | An agent that is paused, retired or a draft | the served list is read, or a call reaches it | it cannot be served; a call to it is refused, naming its status |
| CP-03.5 | No client token and no key | a client calls | it is refused with where to find the metadata, and nothing is listed (AC-35.1) |
| CP-03.6 | A call the person may not make — an agent they may not use, or a rule that does not allow it | it is made | it is refused, naming the rule; History records the refusal; no run opens |
| CP-03.7 | An allowed call | it is made | it is a run as the person behind the client or key, through the agent the tool runs as, recorded with the tool and the client or key; a key's narrowing holds (AC-F10) |
| CP-03.8 | *Check records* | it runs | it returns which records are valid and which are rejected, each with its reason, and writes nothing |
| CP-03.9 | *Load records* into a read + write graph database whose kind the person may write | it runs | it is a load (RC-F02): records that hold land, records that break a rule are rejected each with its reason, and the caller gets the load's id, content hash and counts |
| CP-03.10 | *Load records* into a read-only graph database, or without Write on that kind | it runs | the run fails, naming the graph database or the rule; nothing is written |
| CP-03.11 | An answer to an outside caller | it returns | every record carries where it came from; anything out of the person's reach is refused, never silently left out |
| CP-03.12 | A call carrying a session its credential did not open, or a protocol version other than the pinned one | it is made | it is refused, saying which |
| CP-03.13 | An Operator | they open *MCP server* | everything they may read reads; the served switches are disabled, naming the Admins; a serve through the API is refused |
| CP-03.14 | A call | its run settles | recent calls shows when, the person, the client or key, the tool, its one-line result as the engine stored it, and the run — to that person and to the Admins |
| CP-03.15 | Any call | it is made | *Access usage* records what it read and wrote, naming the person and the client or key (AC-F08 · AC-F09) |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| MCP server | Admin | settings.mcp · Nothing served | — | settings.mcp · Loading | settings.mcp | settings.mcp · Could not load | — | — |
| MCP server | Operator | settings.mcp · Nothing served · Read only | — | settings.mcp · Loading | settings.mcp · Read only | settings.mcp · Could not load | — | settings.mcp · Read only |
| Recent calls | Admin | settings.mcp · No calls yet | settings.mcp · Nothing matches | settings.mcp · Loading | settings.mcp · Recent calls | settings.mcp · Call refused | — | — |
| Recent calls | Operator | settings.mcp · No calls yet | settings.mcp · Nothing matches | settings.mcp · Loading | settings.mcp · My calls | settings.mcp · Call refused | — | — |
