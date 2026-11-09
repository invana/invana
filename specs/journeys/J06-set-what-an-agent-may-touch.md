---
id: J06
title: Set what an agent may touch
personas: [owner, builder]
stories: [AC-04, AC-06, AG-21, AC-13, AC-15, AC-14, AC-12]
boards: [settings.access, agents.agent, inbox, agents.run]
---

# Set what an agent may touch

> **Priya**, a Graph owner, decides what an agent may do on its own, what it must ask about, and what it is denied
> — and wants every run to show which of those applied and who set it.

## The journey

```mermaid
flowchart TD
  A([Settings › People and access · or the agent's sheet]) --> B{"How is it set?"}
  B -->|by policy| C["AC-04 · A rule's line: Allow · Ask · Deny"]
  B -->|by hand, one agent| D["AG-21 · What it may do: narrow this agent"]
  C --> E["AC-06 · Who it changes — holders whose value moves"]
  E -->|Save| F
  D -->|looser than the Graph · an access change Allow| DX["Refused, naming the level"] --> D
  D -->|Save| F["AC-13 · What it may touch — each item, every level, who set it"]
  B -->|without the grant| NA["Reads · Ask Priya"]
  F --> G([The agent runs])
  G --> H{"The step's mode"}
  H -->|Allow| I(["It acts"])
  H -->|Ask| J["AC-15 · Waits in Needs you, showing exactly what will happen"]
  J -->|Allow · Send it| I
  J -->|Decline · expires| K(["Not done · the step ends not sent"])
  H -->|Deny| L["AC-14 · Refused · the agent asks for more"]
  L --> M{"AC-15 · whoever may change that mode decides"}
  M -->|Allow · this run, N days or always| I
  M -->|Decline · expires| N(["The step ends refused"])
  I --> T["AC-12 · How it got here names the mode, its level and who set it"]
  K --> T
  N --> T
```

```mermaid
sequenceDiagram
  actor P as Priya
  participant E as Engine
  participant A as Agent
  actor D as Person who decides (Inbox)
  P->>E: sets a mode — a rule's line, or the agent's own
  E-->>P: who it changes, then saved, naming Priya
  A->>E: a step wants to act
  E->>E: when the step runs — the strictest line across the Graph, the agent's own and its caller chain
  alt Allow
    E->>A: it acts
  else Ask
    E->>D: Needs you — exactly what will happen
    D-->>E: Allow · Decline
  else Deny
    E-->>A: refused, naming the mode and who set it
    A->>E: asks for more
    E->>D: Needs you — the mode, its level, who set it
    D-->>E: Allow for this run · N days · always · Decline
  end
  E-->>P: How it got here — each step's mode and who set it
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Set a mode by policy on a rule's line | Settings · People and access | AC-04 | `settings.access` |
| 2 | See who it changes before saving | Settings · People and access | AC-06 | `settings.access` |
| 3 | Narrow one agent by hand | Agents · the agent's sheet | AG-21 | `agents.agent` |
| 4 | Read what the agent may touch, every level at once | Settings · People and access › Agents | AC-13 | `settings.access` |
| 5 | The agent hits Ask and asks | Inbox · Needs you | AC-15 | `inbox` |
| 6 | The agent hits Deny and asks for more | Inbox · Needs you · the run | AC-14 | `inbox` · `agents.run` |
| 7 | Read which mode applied and who set it | The run · How it got here | AC-12 · AC-14 | `agents.run` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | Ask waits in Needs you; Deny refuses and the agent asks for more | AC-15 · AC-14 | `inbox` |
| It fails | A mode looser than the Graph, or an access change set to Allow, is refused in place, naming the level | AG-21 · AC-04 | `agents.agent` · `settings.access` |
| The person has no access | Every mode reads; setting one is shown as *Ask Priya*, naming who can | AC-13 · AG-21 | `settings.access` · `agents.agent` |
| Nobody decides the ask | It expires; the step ends not done, and *How it got here* says so | AC-15 · AC-14 | `inbox` |

## Done when

- Every step of the agent's run names in *How it got here* the mode that applied, its level and who set it, and nothing set to Ask went without a person's yes.
