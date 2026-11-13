---
id: J06
title: Set what an agent may touch
personas: [admin, builder]
stories: [AC-03, AC-04, AC-06, AC-11, AC-08, AC-13, AC-15, CP-36, AC-14, AC-12]
boards: [settings.access, inbox, agents.run]
---

# Set what an agent may touch

> **Lee**, an Admin, decides with Access Policies what an agent may Read, Write and Run on its own, what it must ask
> about and what it is denied — and wants every run to show which rule applied and who set it.

## The journey

```mermaid
flowchart TD
  A([Settings › Invana › Access Policies]) --> R["AC-03 · Read every Access Policy and the agents it is attached to"]
  R --> B["AC-04 · Write a rule: Allow · Ask · Deny × Read · Write · Run × type/name, for a team or everyone"]
  B -->|a built-in policy| BX["Copied to change, never edited"] --> B
  B --> C["AC-06 · Who it changes — agents that gain, agents that lose, skills and workflows that break"]
  C -->|Save| D["AC-11 · Attach the policy to agents"]
  D --> T["AC-08 · Can someone do this? — a person, through an agent, on a resource"]
  T --> F["AC-13 · What it can do — every rule that applies, and who set it"]
  F --> G([The agent runs, for a person])
  G --> H{"The strictest rule for this step"}
  H -->|Allow| I(["It acts"])
  H -->|Ask| J["AC-15 · CP-36 · Waits for the agent's named approvers, showing exactly what will happen"]
  J -->|Allow · Send it| I
  J -->|unanswered| J1["Reminds · goes to the agent's owners and the Admins"] --> J
  J -->|Decline · expires| K(["Not done · nothing it held went"])
  H -->|Deny · no rule reaches it| L["AC-14 · Refused · the agent asks for more"]
  L --> M{"A named approver decides"}
  M -->|Allow · this run, N days or always| I
  M -->|Decline · expires| N(["The step ends refused"])
  I --> X["AC-12 · How it got here names the rule that applied, its policy and who set it"]
  K --> X
  N --> X
  A -.->|without the Admin role| NA(["Reads every policy · writing one names the Admins"])
```

```mermaid
sequenceDiagram
  actor L as Lee (Admin)
  participant E as Engine
  participant A as Agent
  actor D as Named approver (Inbox)
  L->>E: writes a rule on an Access Policy, attaches it to agents
  E-->>L: who it changes, then saved, naming Lee, in History
  A->>E: a step wants to Read, Write or Run a resource, for a person
  E->>E: every rule on the agent's policies, narrowed to the person's teams and the caller chain — default deny, the strictest wins
  alt Allow
    E->>A: it acts
  else Ask
    E->>D: Needs you — exactly what will happen
    D-->>E: Allow · Decline (unanswered: remind, escalate, expire refused)
  else Deny
    E-->>A: refused, naming the rule and who set it
    A->>E: asks for more
    E->>D: Needs you — the rule, its policy, who set it
    D-->>E: Allow for this run · N days · always · Decline
  end
  E-->>L: How it got here — each step's rule and who set it
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Read every Access Policy and what it is attached to | Access Plane · Access Policies | AC-03 | `settings.access` |
| 2 | Write a rule — effect, verb, resource, and a team when it holds for one | Access Plane · Access Policies | AC-04 | `settings.access` |
| 3 | See who it changes before saving | Access Plane · Access Policies | AC-06 | `settings.access` |
| 4 | Attach the policy to agents | Access Plane · Access Policies | AC-11 | `settings.access` |
| 5 | Check whether a person, through an agent, may do something | Access Plane · Access Policies | AC-08 | `settings.access` |
| 6 | Read what an agent can do, every rule at once | Access Plane · What an agent may touch | AC-13 | `settings.access` |
| 7 | The agent meets Ask; a named approver decides | Access Plane · Asks and approvals · Control Plane · Inbox | AC-15 · CP-36 | `inbox` |
| 8 | The agent meets Deny and asks for more | Access Plane · What an agent may touch | AC-14 | `inbox` · `agents.run` |
| 9 | Read which rule applied and who set it | Control Plane · Runs › How it got here | AC-12 · AC-14 | `agents.run` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | Ask waits for the agent's named approvers — never the person it benefits; Deny refuses and the agent asks for more | AC-15 · AC-14 | `inbox` |
| It fails | A rule naming a resource that does not exist, or a built-in policy edited in place, is refused, naming why | AC-04 | `settings.access` |
| The person has no access | Every policy and rule reads; writing, attaching and deciding name the Admins or the named approvers | AC-03 · AC-13 | `settings.access` |
| Nobody decides the ask | It reminds, goes to the agent's owners and the Admins, then expires refused; the step ends not done, and *How it got here* says so | AC-15 · AC-14 | `inbox` |
| A rule names a team | It applies only to runs whose person is on that team | AC-04 · AC-12 | `settings.access` |
| The agent delegates | The helper runs with what both agents may do and what the person's teams allow, never more | AC-13 | `settings.access` |

## Done when

- Every step of the agent's run names in *How it got here* the rule that applied, its Access Policy and who set it, and nothing a rule set to Ask went without a named approver's yes.
