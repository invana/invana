---
id: AC-38
title: Choose a person's default agent
feature: AC-F03
status: idea
personas: [admin, analyst]
boards: [settings.people, settings.me]
---

# AC-38 · Choose a person's default agent

**As** an Admin **I want** to choose, for each person, the one agent their asks go to when they name none **so that**
each person starts with the agent that fits their work.

Tasks: [task.md](task.md) · Feature: [AC-F03](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read every person's default agent; set it to an agent granted to that person, signing in again | An agent not granted to the person is not offered |
| Operator | Read their own default agent in *You* and everyone's in *Users* | *Change default agent* disabled — *Needs Manage on Access — ask Priya or Lee* |

## Flow

```mermaid
flowchart TD
  p([Users › a person]) --> d["Default agent: where their asks go when they name none"]
  d --> who{"Is the reader an Admin?"}
  who -->|no| ro["Reads · Change disabled, naming the Admins"]
  who -->|yes| pick["Pick from the agents granted to the person"]
  pick -->|an agent not granted| ref["Refused · names the agent"]
  pick --> pw{"Sign in again"}
  pw --> saved(["From their next read · Studio reads again · History"])
  g([AC-39 · a grant taken away]) -->|it was their default| fb(["Falls back to the Assistant · named in the preview · History"])
  me([You · my default agent]) --> mine["Reads its name and links to its policies"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-38.1 | A new person | their account is made | their default agent is the built-in Assistant |
| AC-38.2 | An Admin on a person's page | they set the default agent to one that person may use, signing in again | from the person's next ask, an ask naming no agent goes to it; what they may reach is unchanged; History records who changed it, from what, to what |
| AC-38.3 | An Admin | they pick an agent not granted to the person | it is refused, naming the agent — *{agent} is not granted to {person} — grant it first* |
| AC-38.4 | A person whose default agent's grant is taken away | the take-away is saved | the preview named it first (AC-39); their default falls back to the built-in Assistant, and History records why |
| AC-38.5 | A person | they open *You* | their default agent reads by name, linking to the Access Policies it runs under |
| AC-38.6 | A read on any Studio screen | the default agent's rules refuse it | it is refused, naming the rule and its policy (AC-07), never shown and hidden |
| AC-38.7 | A person without Manage on Access | they open a person's page | the default agent reads; *Change default agent* is disabled, naming Manage on Access and who can grant it; the API refuses the write |
| AC-38.8 | A change of default agent with a key | it is sent | it is refused — it needs a person's session |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A person — default agent | Admin | settings.people · Default is the Assistant | — | settings.people · Loading | settings.people · Default agent | settings.people · Not granted | — | — |
| A person — default agent | Operator | settings.people · Locked · Default is the Assistant | — | settings.people · Locked · Loading | settings.people · Locked · Default agent | settings.people · Locked · Could not load | — | settings.people · Locked · Default agent |
| You — my default agent | Admin | settings.me · Default is the Assistant | — | settings.me · Loading | settings.me · Default agent | settings.me · Could not load | — | — |
| You — my default agent | Operator | settings.me · Default is the Assistant | — | settings.me · Loading | settings.me · Default agent | settings.me · Could not load | — | — |
