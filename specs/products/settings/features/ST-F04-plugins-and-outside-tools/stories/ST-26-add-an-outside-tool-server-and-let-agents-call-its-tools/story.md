---
id: ST-26
title: Add an outside tool server and let agents call its tools
feature: ST-F04
status: idea
personas: [admin, builder]
boards: [settings.ai]
---

# ST-26 · Add an outside tool server and let agents call its tools

**As** an install admin **I want** to add a third party's MCP server — Figma, say — and see its tools as functions,
frozen as I saw them **so that** agents use outside tools governed like any other function, and a server cannot widen
what agents run by changing its list.

Tasks: [task.md](task.md) · Feature: [ST-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Add a server by address and name; read its tools again; turn it on or off | — |
| Operator | Read every server, its tools, which ask first and which skills use them | *Add a server*, *Read its tools again* and the switch disabled, naming the Admin |

## Flow

```mermaid
flowchart TD
  s([Settings › AI and connections › MCP servers]) --> a["Add a server: address · name"]
  a --> n{"Name free and well-formed?"}
  n -->|no| nf["Says it is taken, or the rule it breaks"]
  n -->|yes| l{"Lists its tools?"}
  l -->|unreachable · unauthorised · not MCP| lf["Names the address and what failed · nothing stored"]
  l -->|yes| fz(["Frozen as functions · off · names any tool it skipped"])
  fz --> on["Admin turns it on"]
  on --> use(["Agents may call its tools · from the next step"])
  use -->|a tool not marked read-only| ask["Waits for a yes in Needs you"]
  s --> rf["Read its tools again"]
  rf --> rv(["A new revision · only changed tools move version"])
  s -->|without Admin| ro(["Reads · acts disabled, naming the Admin"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| ST-26.1 | An Admin | they add a server with an address and a name | its tools are listed and frozen as functions `mcp.<name>.<tool>`, and the server is off |
| ST-26.2 | A name already taken, or not lowercase letters, digits and underscores | the server is added | it is refused, saying which |
| ST-26.3 | A server that cannot be reached, refuses the token, or is not an MCP server | it is added | it is refused, naming the address and what failed; nothing is stored |
| ST-26.4 | A tool whose name Invana cannot key | the server is added | the rest are added and the skipped tool is named |
| ST-26.5 | A server that changed its tools | nothing is done | nothing changes; agents call only the tools frozen when it was added |
| ST-26.6 | An Admin | they read its tools again | a new revision is frozen; a new tool starts at its first version, a changed tool's version moves, an unchanged one keeps it, a dropped one leaves |
| ST-26.7 | A server turned on | a plan calls a tool the server marks read-only | it runs as a read |
| ST-26.8 | A server turned on, the tool's mode left at its default | a plan calls any other tool | it is Ask first: the run waits for a yes in Needs you (IN-01); a no fails the step as *not sent* |
| ST-26.9 | A server turned off | a plan calls its tool | the step is refused, saying the plugin is off and who can turn it on |
| ST-26.10 | The server is down at call time | a step calls it | the step fails, naming the address; it is not retried |
| ST-26.11 | A server that wants a token the workers do not hold | a step calls it | the step is refused, naming the setting the workers need |
| ST-26.12 | An Operator | they open MCP servers | every server and its tools read; *Add a server*, *Read its tools again* and the switch are disabled, naming the Admin |
| ST-26.13 | An add, a refresh or a switch | it is done | History records who did it and when (IN-F03) |
| ST-26.14 | A server's tools | they are read | each tool shows its mode for this Graph — Allow · Ask first · Block — and who set it |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| MCP servers | Admin | settings.ai · No MCP servers | — | settings.ai · Loading | settings.ai | settings.ai · Could not load | — | — |
| MCP servers | Operator | settings.ai · No MCP servers | — | settings.ai · Loading | settings.ai · Read only | settings.ai · Could not load | — | settings.ai · Read only |
| Add a server | Admin | settings.ai · Add a server | — | settings.ai · Listing its tools | settings.ai · Tools listed | settings.ai · Server unreachable | — | — |
| Add a server | Operator | — | — | — | — | — | — | settings.ai · Read only |
