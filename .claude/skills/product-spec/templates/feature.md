---
id: XX-F01
title: Feature name
product: XX
status: idea
personas: []
stories: [XX-01]
journeys: []
boards: []
depends_on: []
---

# Feature name

> One or two lines: what the feature does for a person, and the decision it helps them make.

## User journey

How a person moves through this feature, every story on it. Each node a story covers carries its ID.

```mermaid
flowchart TD
  start([Where the person starts]) --> s1["XX-01 · First step"]
  s1 --> d1{A decision}
  d1 -->|happy path| done([What they end with])
  d1 -->|no access| na["Disabled — Ask Priya (owner)"]
  d1 -->|fails| f1["Says why · the next act"] --> s1
```

When an agent, a background run or a permission ask is involved, add the timing between the person, Studio, the
engine and the agent:

```mermaid
sequenceDiagram
  actor P as Person
  participant S as Studio
  participant E as Engine
  participant A as Agent
  P->>S: the act
  S->>E: the request
  E->>A: the work
  A-->>P: proposes, or asks permission (Inbox)
  P->>A: decides
  A-->>S: the result, with its trace
```

## Stories

Each story is a folder under `stories/` — `story.md` from `templates/story.md`, `task.md` from `templates/task.md` —
listed here in the order the user journey reaches them.

| ID | Story | Status |
|---|---|---|
| XX-01 | [Story title](stories/XX-01-story-slug/story.md) | idea |

## Access

Each act in this feature and the role that may do it — the code's view of every story's *Who can*.

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| | `modeller` · shown as *Can shape the model* | Disabled — *Ask Priya (owner)* |

## States

What each state means across this feature's screens.

| State | What the person sees |
|---|---|
| First use | Nothing exists yet: why, and the one act that starts it |
| Empty after a filter | Nothing matches: the filter named, and how to clear it |
| Loading | |
| Has data | |
| Failed | What failed, in a sentence, and the next act |
| Agent working or proposing | What the agent is doing, and the decision it brings back |
| No access | Hidden, disabled with its reason, or *Ask <owner>* |

## Rules

| Rule | Detail |
|---|---|
| | |

## Data touched

| Record | Read or write |
|---|---|
| | |

## Decisions

| Decision | Detail |
|---|---|
| | |

## Open questions

| Question | Who answers |
|---|---|
| | |

## Not building

| Item | Why not |
|---|---|
| | |
