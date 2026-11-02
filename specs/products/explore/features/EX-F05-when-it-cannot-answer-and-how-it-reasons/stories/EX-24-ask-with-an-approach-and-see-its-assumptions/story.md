---
id: EX-24
title: Ask the way a scientist would, with the assumptions shown
feature: EX-F05
status: idea
personas: [analyst, decision-maker, builder]
boards: [explore.ask, explore.board, agents.skills, agents.run.answer]
---

# EX-24 · Ask the way a scientist would, with the assumptions shown

**As** an analyst asking a question I do not fully know how to frame **I want** to ask it the way a scientist, a
designer or an analyst would — the agent proposes the method and its assumptions, and I decide which to keep **so that**
I get their method and see what it rests on before the answer, instead of inheriting it silently.

Tasks: [task.md](task.md) · Feature: [EX-F05](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Pick an approach with *Act as*, remove an assumption before the run, drop one from an answer and re-run; author and publish approaches in Agents › Skills | — |
| Operator | Pick an approach, remove assumptions, drop one and re-run, on their own runs | Approaches listed read-only in Agents › Skills, *+* hidden; with *Can build agents*: author them, as Admin |

## Flow

```mermaid
flowchart TD
  a([The composer]) --> p{"Act as"}
  p -->|"none (or the agent's default)"| plain([Asked as today · no assumptions list])
  p -->|an approach| pre["Its assumptions above the composer · each removable"]
  pre --> ask[Ask]
  ask --> amb{The question is ambiguous?}
  amb -->|yes| cq(["Asked back — EX-23 · never assumed"])
  amb -->|no| run["Planned with the method · the query written from the model alone"]
  run -->|the Graph does not hold what the method needs| ca(["Cannot answer — EX-05 · never an estimate"])
  run --> ans["The answer in the approach's shape"]
  ans --> led["Assumptions: proven · assumed · refused · what changes without each"]
  led -->|drop one| re["Re-run without it"]
  re --> ans
  led -->|a rule contradicts one| dr["Dropped · the rule named"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-24.1 | The composer | the person opens *Act as* | it lists the Graph's published approaches, opening on the agent's default when it has one, else none |
| EX-24.2 | An approach picked | before the question is sent | its assumptions show above the composer, each removable |
| EX-24.3 | No approach picked | the question is asked | it runs as it would without this story, with no assumptions list |
| EX-24.4 | An answer run with an approach | it settles | it carries its assumptions as a table — claim · where it entered (the approach, the question, the model, a rule) · whether the Graph checked it, and by which query · what the answer becomes without it |
| EX-24.5 | An assumption in an answer | the person drops it | the question re-runs without it, and the earlier answer stays |
| EX-24.6 | An approach picked | the plan writes, checks and runs the query | the approach is not passed to those steps, and the check of what the agent may do is the same as without it |
| EX-24.7 | An approach whose method needs what the Graph does not hold | the run settles | the reply is *Cannot answer* (EX-05), never an estimate |
| EX-24.8 | An ambiguous question with an approach | it is understood | the person is asked back (EX-23); the approach never settles what the question means |
| EX-24.9 | Two approaches asked for at once | the question is sent | it is refused: one run, one approach |
| EX-24.10 | An assumption a rule contradicts | the run settles | the assumption is dropped from the list, naming the rule |
| EX-24.11 | The same question on the same data | a different approach is picked | the plan or the assumptions differ |
| EX-24.12 | The approach is changed mid-conversation | the next question is asked | it uses the new one; earlier answers keep the approach they ran under, named in *How it got here* |
| EX-24.13 | An answer run with an approach | the person opens *How it got here* | it names the approach and its version, and its assumptions with the queries that checked them |
| EX-24.14 | A member with *Can build agents* | they open Agents › Skills | they author an approach — name, when to use, method, assumptions each with what changes without it, answer shape — and publish it as a version |
| EX-24.15 | An Operator without *Can build agents* | they open approaches in Agents › Skills | they read them; *+* is hidden and nothing can be edited |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Act as, in the composer | Admin | explore.ask · Act as, none published | — | — | explore.ask · Act as | — | explore.ask · Assumptions before the run | — |
| Act as, in the composer | Operator | explore.ask · Act as, none published | — | — | explore.ask · Act as | — | explore.ask · Assumptions before the run | — |
| The assumptions on an answer | Admin | — | — | explore.board · Working | explore.board · Assumptions | explore.board · Two approaches refused | explore.board · Working | — |
| The assumptions on an answer | Operator | — | — | explore.board · Working | explore.board · Assumptions | explore.board · Two approaches refused | explore.board · Working | — |
| Approaches in Skills | Admin | agents.skills · Approaches empty | agents.skills · Approaches filtered | agents.skills · Loading | agents.skills · Approaches | agents.skills · Failed | — | — |
| Approaches in Skills | Operator | agents.skills · Approaches empty | agents.skills · Approaches filtered | agents.skills · Loading | agents.skills · Approaches | agents.skills · Failed | — | agents.skills · Approaches read only |
| The run's trace | Admin | — | — | agents.run.answer · Loading | agents.run.answer · Approach | agents.run.answer · Step failed | agents.run.answer · Running | — |
| The run's trace | Operator | — | — | agents.run.answer · Loading | agents.run.answer · Approach | agents.run.answer · Step failed | agents.run.answer · Running | — |
