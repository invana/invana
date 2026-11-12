---
id: J03
title: Give an agent work and decide on the result
personas: [decision-maker]
stories: [PJ-01, PJ-16, PJ-12, PJ-15, PJ-18, GR-16, AC-15, AG-24, PJ-17, PJ-06, PJ-07, PJ-14]
boards: [projects.list, projects.project, projects.task, projects.task.thinking, inbox, projects.finding, projects.decide, projects.report]
---

# Give an agent work and decide on the result

> **Ana**, a decision maker, hands a piece of her inquiry to an agent and wants to decide on what it brings back —
> never to find it acted without her.

## The journey

```mermaid
flowchart TD
  A([Projects]) --> B["PJ-01 · Open the project"]
  B --> C["PJ-16 · Say what done means"]
  C --> D["PJ-12 · Write a task · assign it to an agent"]
  D --> D2["PJ-18 · It waits on what it depends on"]
  D2 --> E["PJ-15 · The agent picks it up — assigned, asking first, or on its own"]
  E --> F{"The agent works"}
  F -->|needs a helper| G["AG-24 · Hands part to a helper, within its bounds"] --> F
  F -->|outside what it may do| R["Refused before it starts, naming the bound"]
  F -->|wants to send or change| H["AC-15 · GR-16 · Asks in the Inbox, showing exactly what will happen"]
  H -->|Send it| F
  H -->|Not this time| F2["Nothing sent · the step ends not sent"]
  F -->|needs input| NI["Needs input · Ana answers in the thread"] --> F
  F -->|fails| FL["Failed · says why · re-run"]
  F -->|result posted| I["PJ-12 · In review · How it got here"]
  I --> J{"PJ-17 · Ana decides"}
  J -->|reject| E
  J -->|accept| K["PJ-06 · Weigh the finding and its records"]
  K --> L["PJ-07 · Record a verdict and a decision the rules check"]
  L --> M(["PJ-14 · Publish what we decided"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Open the project | Projects · list | PJ-01 | `projects.list` |
| 2 | Say what done means | Projects · project | PJ-16 | `projects.project` |
| 3 | Write a task and assign it to an agent | Projects · task | PJ-12 · PJ-18 | `projects.task` |
| 4 | The agent picks it up and works, handing parts to helpers | Projects · task thread | PJ-15 · AG-24 | `projects.task.thinking` |
| 5 | Decide what the agent asks before it acts | Graph · Inbox · Needs you | AC-15 · GR-16 | `inbox` |
| 6 | Review the result | Projects · task | PJ-12 · PJ-17 | `projects.task` |
| 7 | Weigh the finding | Projects · finding | PJ-06 | `projects.finding` |
| 8 | Record the decision | Projects · decide | PJ-07 | `projects.decide` |
| 9 | Publish it | Projects · report | PJ-14 | `projects.report` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | The agent asks in the Inbox and waits; *Not this time* sends nothing | AC-15 | `inbox` |
| It fails | The task reads *Failed* with why; a re-run starts it again | PJ-12 | `projects.task` |
| The person has no access | Without *Can work on projects*, Ana reads the project; writing, assigning and deciding name who can | PJ-12 · PJ-07 | `projects.task` |
| Outside what the agent may do | Refused before it starts, naming the bound; nothing is spent | AG-24 | `projects.task.thinking` |
| The agent needs input | The task reads *Needs input*; Ana answers in its thread | PJ-12 | `projects.task.thinking` |

## Done when

- The agent never marks its own task done: Ana accepted its result, and the decision is recorded with its evidence and published.
