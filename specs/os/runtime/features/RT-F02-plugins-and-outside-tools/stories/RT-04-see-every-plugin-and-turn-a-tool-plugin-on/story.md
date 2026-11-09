---
id: RT-04
title: See every plugin and turn a tool plugin on
feature: RT-F02
status: idea
personas: [admin]
boards: []
---

# RT-04 · See every plugin and turn a tool plugin on

**As** an install admin **I want** every plugin the install carries — its functions with their versions, its skills
and plans — and to turn a tool plugin on deliberately **so that** agents reach the web, mail or a science source only
when I have said they may.

Tasks: [task.md](task.md) · Feature: [RT-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every plugin; turn a tool or MCP plugin on or off | — |
| Operator | Read every plugin, its functions, versions, skills and plans, and whether it is on | The switch is disabled, naming the Admin |

## Flow

```mermaid
flowchart TD
  s([Settings › Invana › Plugins]) --> l["Every plugin: core · tool · simulator · MCP · on or off"]
  l -->|filter| f["No plugin matches"]
  l --> p["A plugin: its functions and versions · skills · plans"]
  p -->|core or simulator| always(["Always on · no switch"])
  p -->|tool, not installed| ni["Names the extra that installs it"]
  p -->|tool or MCP · Admin| sw{"Turn on?"}
  sw -->|on| on(["Agents may call it · from the next step"])
  sw -->|off| off(["Steps calling it are refused, naming who can turn it on"])
  p -->|without Admin| ro(["Switch disabled · names the Admin"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| RT-04.1 | A member | they open *Plugins* | every plugin reads — core and simulator, Invana's own; tool plugins, each an MCP server shipped with Invana or added by an Admin — with its version and whether it is on |
| RT-04.2 | A plugin | it opens | its functions read with their versions and what each does, sends or reads, and its skills and plans |
| RT-04.3 | A core or simulator plugin | it is read | it is on and has no switch |
| RT-04.4 | A new install | Plugins opens | every tool plugin is off |
| RT-04.5 | A tool plugin whose extra is not installed | it is read | it says it is not installed, naming the extra; it cannot be turned on |
| RT-04.6 | An Admin | they turn a tool plugin on | agents may call its functions from the next step, with no restart; runs already waiting pick it up |
| RT-04.7 | A plugin turned off | a step calls one of its functions | the step is refused, saying the plugin is off and who can turn it on |
| RT-04.8 | A function that sends — `mail.send` — reached only by a starting line other than the Owner's | a step calls it | it is Ask: the run waits for a yes in Needs you (AC-15); a no fails the step as *not sent* |
| RT-04.9 | A tool step and no worker free | it waits past its allowance | it fails, saying no worker took it |
| RT-04.10 | A function needing a secret the workers do not hold | a step calls it | it is refused, naming the setting the workers need |
| RT-04.11 | A web page whose robots.txt disallows it | a web tool would read it | nothing is read, and the step says so with the address |
| RT-04.12 | A run | it records a step | it records the function's version it ran |
| RT-04.13 | An Operator | they open Plugins | everything reads; the switch is disabled, naming the Admin |
| RT-04.14 | A plugin turned on or off | it is done | History records who did it and when (AC-F06) |
| RT-04.15 | A plugin's functions | they are read | each shows its mode for this Graph — Allow · Ask · Deny — and who set it |
| RT-04.16 | A plugin's functions | one is opened | its inputs and outputs read as their JSON Schema |
| RT-04.17 | A tool plugin Invana ships — web, mail, a science source | it is read | it is an MCP server run on the workers; its tools are frozen and versioned like an added server's (RT-02.6), and the same switch turns it on |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Plugins | Admin | — | — | — | — | — | — | — |
| Plugins | Operator | — | — | — | — | — | — | — |
| A plugin | Admin | — | — | — | — | — | — | — |
| A plugin | Operator | — | — | — | — | — | — | — |
