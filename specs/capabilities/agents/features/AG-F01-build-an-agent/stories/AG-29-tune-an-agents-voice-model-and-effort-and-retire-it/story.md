---
id: AG-29
title: Tune an agent's voice, model and effort, and retire it
feature: AG-F01
status: idea
personas: [builder, admin]
boards: [agents.agent, settings.ai]
---

# AG-29 · Tune an agent's voice, model and effort, and retire it

**As** an agent builder **I want** to set how an agent sounds, the exact model version it thinks with and how hard it
tries — and to pause or retire it with every piece of its open work named first **so that** an agent changes only
when I change it, a provider's release never changes it by surprise, and stopping it never loses what it did.

Tasks: [task.md](task.md) · Feature: [AG-F01](../../feature.md)

## Who can

Tuning and retiring an agent is the Modeller's and the Admin's ([the role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | On any agent not built in: set the voice and its dials, preview it, pin and move a model version, set effort, Pause, Resume, Retire; offer model versions and set the deployment's default model in Control Plane › AI models | A built-in agent's settings read; *Copy* in place of every edit |
| Modeller | Every act an Admin has here, except offering model versions | Offering model versions reads *Ask an Admin* |
| Operator | Read the voice, model version, effort, the versions it has run on and its lifecycle | Every edit and lifecycle act disabled, naming the role — *Needs the Modeller role — ask an Admin* |

## Flow

```mermaid
flowchart TD
  s([The agent · Setup]) --> vo["Voice — four dials, then its own words"]
  vo --> pv["Preview — one sample ask, current voice above, draft below"]
  pv -->|Save| v1(["The next version · the next run speaks with it"])
  s --> mo["Model version — offered versions only · effort"]
  mo -->|move it| ev{Its evals hold on the new version?}
  ev -->|no| evx["Refused, naming the failing checks"]
  ev -->|yes| v1
  mo -->|its pinned version is not offered| px["Runs refuse at open, naming the pin — nothing falls back"]
  s --> lc{Lifecycle}
  lc -->|Pause or Retire| pr["Each run, task, conversation and schedule, with what happens to each"]
  pr -->|confirm| pd(["Paused — Resume is one click"])
  pr -->|confirm with a reason| rt(["Retired — its row and name kept"])
  lc -->|retire the default agent| dx["Refused until an Admin makes another the default"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-29.1 | The agent's Voice | it opens | four dials — humour (off · light · playful), formality (casual · neutral · formal), emoji (off · on), greeting (off · on) — sit above the agent's own words, which are read after the dials and win where they disagree |
| AG-29.2 | An agent with no voice written | Voice opens | it reads *Speaking in Invana's default voice* — warm, plain, brief — shown as the placeholder; saving it empty keeps it empty |
| AG-29.3 | A changed voice | the builder presses *Preview* | one sample ask they may edit is answered twice — current voice above, draft below — stating no fact from the data; nothing is recorded or drawn against any limit |
| AG-29.4 | A voice that says *always search the web* or *never say you can't* | a run meets what its Access Policies do not allow | it is still refused, naming what is missing; only the words around the refusal are the voice's |
| AG-29.5 | Any voice | the agent refuses, cannot answer, fails or pauses at a limit | it says so without humour, whatever the dial reads |
| AG-29.6 | A long voice | it is typed | Voice shows its length in characters, which every ask carries |
| AG-29.7 | A run in flight when the voice changes | it ends | it spoke with the voice it opened with; the next run speaks with the new one; a helper it creates speaks with its voice |
| AG-29.8 | Model version | it opens | it lists only the versions Control Plane › AI models offers, each by the provider's exact name and marked *Local* or *External*; a provider alias cannot be pinned |
| AG-29.9 | A pinned version moved to another | the builder saves | the agent's evals run on the new version first (AG-F10); a failing hard check refuses the move naming it; otherwise the move becomes the next version with its reason |
| AG-29.10 | A pinned version the deployment does not offer | a run opens | the run is refused, naming the pin; nothing calls another model; Control Plane › AI models warns, naming the agents that pin it |
| AG-29.11 | An agent with no pin | it runs | the deployment's default model decides, and the run records the version it called |
| AG-29.12 | A pinned agent | Model version opens | *Versions it has run on* lists each recorded version with its first run, runs, served rate and p95 — the engine's numbers; a set pin can be moved, never cleared |
| AG-29.13 | Effort | it opens | the most steps, replans and questions a run may take, each with the number a run reads; *0 questions* means it never asks, and every reading it picks is a declared assumption shown before the answer |
| AG-29.14 | A live agent | a Modeller or an Admin presses *Pause* | a dialog lists each piece of open work and what happens to it — a run in flight finishes; an open task is blocked, naming the agent; a task in review is unchanged; a conversation with the agent refuses its next ask, naming the state; a schedule that starts it stays on and its firings are refused until it resumes — before *Pause* applies |
| AG-29.15 | A paused agent | a Modeller or an Admin presses *Resume* | it takes work again from now, in one click; nothing is replayed and its blocked tasks unblock |
| AG-29.16 | A live agent | a Modeller or an Admin presses *Retire* | the same list names a task in review as blocked and each schedule that starts it as paused; *Why* is asked and kept in Versions; once retired it never takes work, its row stays so every run, trace and helper resolves, and its name stays taken |
| AG-29.17 | The deployment's default agent | a Modeller or an Admin retires it | it is refused until an Admin makes another agent the default |
| AG-29.18 | A helper an agent created | the work it was made for closes | it retires itself |
| AG-29.19 | A retired agent | it appears in a run's trace | it reads normally, marked *retired*; every act on its sheet is disabled |
| AG-29.20 | An ask to a paused or retired agent | it is sent | it is refused, naming the state, and *How it got here* shows the refused step and why |
| AG-29.21 | An Operator | they open Voice, Model version or Lifecycle | each reads as saved; every edit, *Preview*, *Pause*, *Resume* and *Retire* are disabled, naming the role — *Needs the Modeller role — ask an Admin* |
| AG-29.22 | A paused agent with a run already queued | the run's turn comes | it starts and finishes; only work that arrives after the pause is refused |
| AG-29.23 | A step that calls a model | the run opens | the version is the person's pick for that one question, else the skill version's pin, else the agent's pin, else the deployment's default; one that is not offered refuses the run, naming it — nothing falls back |
| AG-29.24 | The command line | `invana agents pin` moves an agent's model version | the agent's evals run first, as AG-29.9; someone without the Modeller role is refused, naming it |
| AG-29.25 | An Operator | they open Voice, Model version or Lifecycle | each reads as saved; every act is disabled — *Needs the Modeller role — ask an Admin* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Voice | Admin | agents.agent · Default voice | — | agents.agent · Loading | agents.agent · Voice | agents.agent · Could not save | agents.agent · Previewing | — |
| Voice | Operator | agents.agent · Default voice | — | agents.agent · Loading | agents.agent · Read only | agents.agent · Could not load | — | agents.agent · Read only |
| Model version and effort | Admin | agents.agent · No pin | — | agents.agent · Loading | agents.agent | agents.agent · Version not offered | agents.agent · Evals running | — |
| Model version and effort | Operator | agents.agent · No pin | — | agents.agent · Loading | agents.agent · Read only | agents.agent · Version not offered | — | agents.agent · Read only |
| Pinned by | Admin | settings.ai · No pins | — | settings.ai · Loading | settings.ai | settings.ai · Pin not offered | — | — |
| Pinned by | Operator | settings.ai · No pins | — | settings.ai · Loading | settings.ai | settings.ai · Pin not offered | — | settings.ai · Read only |
| Pause and Retire | Admin | — | — | agents.agent · Reading open work | agents.agent · Retire | agents.agent · Default cannot retire | — | — |
| Pause and Retire | Operator | — | — | — | — | — | — | agents.agent · Read only |
| A retired agent | Admin | — | — | — | agents.agent · Retired | — | — | — |
| A retired agent | Operator | — | — | — | agents.agent · Retired | — | — | agents.agent · Retired |
