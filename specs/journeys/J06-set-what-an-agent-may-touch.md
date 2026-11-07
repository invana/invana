---
id: J06
title: Set what an agent may touch
personas: [owner, builder]
stories: [ST-02, ST-05, AG-21, ST-30, IN-01, ST-31, ST-07]
boards: [settings.access, agents.agent, inbox, agents.run]
---

# Set what an agent may touch

> **Priya**, a Graph owner, decides what an agent may do on its own, what it must ask about, and what it is denied
> — and wants every run to show which of those applied and who set it.

## The journey

```mermaid
flowchart TD
  A([Settings › People and access · or the agent's sheet]) --> B{"How is it set?"}
  B -->|by policy| C["ST-02 · A rule's line: Allow · Ask · Deny"]
  B -->|by hand, one agent| D["AG-21 · What it may do: narrow this agent"]
  C --> E["ST-05 · Who it changes — agents whose mode moves"]
  E -->|Save| F
  D -->|looser than the Graph · an access change Allow| DX["Refused, naming the level"] --> D
  D -->|Save| F["ST-30 · What it may touch — each item, every level, who set it"]
  B -->|without the grant| NA["Reads · Ask Priya"]
  F --> G([The agent runs])
  G --> H{"The step's mode"}
  H -->|Allow| I(["It acts"])
  H -->|Ask| J["IN-01 · Waits in Needs you, showing exactly what will happen"]
  J -->|Allow · Send it| I
  J -->|Decline · expires| K(["Not done · the step ends not sent"])
  H -->|Deny| L["ST-31 · Refused · the agent asks for more"]
  L --> M{"IN-01 · whoever may change that mode decides"}
  M -->|Allow · this run, N days or always| I
  M -->|Decline · expires| N(["The step ends refused"])
  I --> T["ST-07 · How it got here names the mode, its level and who set it"]
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
  E->>E: tightest mode across the Graph and the agent
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
| 1 | Set a mode by policy on a rule's line | Settings · People and access | ST-02 | `settings.access` |
| 2 | See who it changes before saving | Settings · People and access | ST-05 | `settings.access` |
| 3 | Narrow one agent by hand | Agents · the agent's sheet | AG-21 | `agents.agent` |
| 4 | Read what the agent may touch, every level at once | Settings · People and access › Agents | ST-30 | `settings.access` |
| 5 | The agent hits Ask and asks | Inbox · Needs you | IN-01 | `inbox` |
| 6 | The agent hits Deny and asks for more | Inbox · Needs you · the run | ST-31 | `inbox` · `agents.run` |
| 7 | Read which mode applied and who set it | The run · How it got here | ST-07 · ST-31 | `agents.run` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | Ask waits in Needs you; Deny refuses and the agent asks for more | IN-01 · ST-31 | `inbox` |
| It fails | A mode looser than the Graph, or an access change set to Allow, is refused in place, naming the level | AG-21 · ST-02 | `agents.agent` · `settings.access` |
| The person has no access | Every mode reads; setting one is shown as *Ask Priya*, naming who can | ST-30 · AG-21 | `settings.access` · `agents.agent` |
| Nobody decides the ask | It expires; the step ends not done, and *How it got here* says so | IN-01 · ST-31 | `inbox` |

## Done when

- Every step of the agent's run names in *How it got here* the mode that applied, its level and who set it, and nothing set to Ask went without a person's yes.
