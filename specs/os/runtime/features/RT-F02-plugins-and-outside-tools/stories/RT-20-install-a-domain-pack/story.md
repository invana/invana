---
id: RT-20
title: Install a Domain pack
feature: RT-F02
status: idea
personas: [admin]
boards: [settings.plugins]
---

# RT-20 · Install a Domain pack

**As** an install admin **I want** to install a Domain pack that brings a domain's model starter, meaning, taxonomies,
standards, rules, agents, skills and project types in one act **so that** a team starts in its domain from a working
whole, and the platform itself stays general-purpose.

Tasks: [task.md](task.md) · Feature: [RT-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every pack and what it adds; install or remove a pack | — |
| Operator | Read every pack, what it adds and whether it is installed | *Install* and *Remove* are disabled, naming the Admin |

## Flow

```mermaid
flowchart TD
  s([Settings › Invana › Plugins]) --> l["Domain packs: Research · Fraud · General · installed or not"]
  l --> p["A pack: each piece and the product that will own it"]
  p -->|Admin · Install| c{"Any piece clashes with one already here?"}
  c -->|yes| x["Names the piece and what it clashes with · nothing installed"]
  c -->|no| i(["Installed · each piece offered in its own product"])
  p -->|without Admin| d["Install disabled · names the Admin"]
  i -->|Admin · Remove| r(["Removed · pieces a person already used stay"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| RT-20.1 | A member | they open *Plugins* | Domain packs list beside the other plugins — Research · Fraud · General — each with its version and whether it is installed |
| RT-20.2 | A pack | it opens | each piece reads with the product that will own it: model starter, meaning, broader kinds, standards and rules (Model) · agents and skills (Agents) · project types and report templates (Projects) |
| RT-20.3 | An Admin | they install a pack with no clashing piece | every piece installs as its product's own record — the starter is offered in *New model*, the project types in *New project*, the agents and skills in the catalogue — and History records who installed it |
| RT-20.4 | A pack with a piece whose name is already taken in its product | an Admin installs it | it is refused, naming the piece and what it clashes with; nothing is installed |
| RT-20.5 | An installed pack | an Admin removes it | its pieces stop being offered; a model, project or agent a person already made from them stays |
| RT-20.6 | An Operator | they open a pack | everything reads; *Install* and *Remove* are disabled, naming the Admin |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Domain packs | Admin | settings.plugins · No pack installed | settings.plugins · No plugin matches | settings.plugins · Loading | settings.plugins · Packs | settings.plugins · Pack clashes | — | — |
| Domain packs | Operator | settings.plugins · No pack installed | settings.plugins · No plugin matches | settings.plugins · Loading | settings.plugins · Read only | settings.plugins · Could not load | — | settings.plugins · Read only |
