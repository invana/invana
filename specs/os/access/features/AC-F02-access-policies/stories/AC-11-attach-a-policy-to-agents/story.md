---
id: AC-11
title: Attach a policy to agents
feature: AC-F02
status: idea
milestone: MVP
personas: [admin, builder]
boards: [settings.policies, access.signin, flow.attach_policy]
---

# AC-11 · Attach a policy to agents

**As** an Admin **I want** to attach an Access Policy to the agents it should hold for, and take it off, in one place
**so that** I see a policy's reach and change it on purpose.

Tasks: [task.md](task.md) · Feature: [AC-F02](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read the agents a policy is attached to; attach it to an agent; take it off. Each asks them to sign in again | A built-in policy on its built-in agent has no *Take off* |
| Operator | Nothing here without Read on `access/policies`; a person who holds Read but not Edit on Access reads the agents a policy is attached to | *No access* — *Needs Read on Access — ask Priya or Lee*; with Read, *Attach to an agent* and *Take off* disabled — *Needs Edit on Access — ask Priya or Lee* |

## Flow

```mermaid
flowchart TD
  r([A policy › Attached to]) --> t["Each agent · built in or custom · attached by · when"]
  t -->|Attach to an agent| a["Pick an agent · who it changes"]
  a --> pw{"Sign in again"}
  pw -->|right| ok(["Holds for the agent at its next check · History"])
  t -->|Take off| off["Who it changes"] --> pw2{"Sign in again"} --> gone(["The agent loses it at its next check"])
  t -->|built in on its built-in agent| fixed["No Take off · narrow with a Deny policy"]
  t -->|not an Admin| ask["Disabled · names the Admins"]
  ag([An agent's page › Access Policies]) --> t
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-11.1 | A policy | *Attached to* is read | each agent reads with its name, *Built in*, *Shared* or *Personal* and who made it, who attached the policy and when; built-in agents first, then by name |
| AC-11.2 | A person with Read on `access/policies` | an agent's page is open and its *Access Policies* are read | every policy attached to it reads, with a link to each, and *What it may do* (AC-F04); without that Read it reads *No access*, naming Read on `access/policies` and who can grant it |
| AC-11.3 | An Admin | they attach a policy to an agent | *Who it changes* shows for that agent first, with the people and teams granted it; after signing in again, the agent holds it at its next check — or once a second Admin approves, when that is set (AC-04.18) |
| AC-11.4 | An Admin | they take a policy off an agent | *Who it changes* shows first; after signing in again, the agent loses it at its next check — except *Hidden from agents*, which is never taken off any agent, and a built-in policy on its built-in agent (AC-11.6) |
| AC-11.5 | An agent with no policy attached | a step of its run is checked | it is denied — no rule reaches it — and the refusal names the agent and that no policy is attached |
| AC-11.6 | A built-in policy on its built-in agent, or *Hidden from agents* on any agent | *Take off* is sought | there is none, and the API refuses it, naming the policy; *Attach* a custom policy with a Deny narrows the agent |
| AC-11.7 | A policy attached or taken off | History is read | it shows who did it, to which agent, and when (AC-F06) |
| AC-11.8 | A person with Read on `access/policies` but not Edit on Access | they open *Attached to* | every agent reads; *Attach to an agent* and *Take off* are disabled, naming Edit on Access and who can grant it; without Read it reads *No access* |
| AC-11.9 | An attempt to attach a policy to a person, a team or a key | it is made | there is no such act; a person and a team are granted agents (AC-F03), and a key acts as its owner, narrowed |
| AC-11.10 | An Admin | they press *Attach to an agent* | a *Pick a holder* step lists agents only; picking one opens *Who it changes*; *Sign in again* names *Attach* and returns to *Attached*; a wrong password returns to the same *Sign in again*; a refusal reads *Could not attach* with *Back* |
| AC-11.11 | An Admin | they press *Take off* | *Who it changes* shows, *Sign in again* names *Take off* and returns to *Taken off* |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Attached to | Admin | settings.policies · Not attached | settings.policies · Nothing matches | settings.policies · Loading | settings.policies | settings.policies · Could not load | — | — |
| Attached to | Operator | — | — | — | — | — | — | settings.policies · No access |
| Attach to an agent | Admin | settings.policies · Attach | — | — | settings.policies · Attach · Who it changes | settings.policies · Attach · Could not attach | — | — |
| Attach to an agent | Operator | — | — | — | — | — | — | settings.policies · No access |
| Attach · Pick a holder | Admin | — | — | — | settings.policies · Attach · Pick a holder | — | — | — |
| Attach · Pick a holder | Operator | — | — | — | — | — | — | settings.policies · No access |
| Attach · Sign in again | Admin | — | — | — | access.signin · Sign in again · Attach | access.signin · Sign in again · Attach · Wrong password | — | — |
| Attach · Sign in again | Operator | — | — | — | — | — | — | settings.policies · No access |
| Attach · Attached | Admin | — | — | — | settings.policies · Attach · Attached | settings.policies · Attach · Could not attach | — | — |
| Attach · Attached | Operator | — | — | — | — | — | — | settings.policies · No access |
| Take off | Admin | — | — | — | settings.policies · Take off · Who it changes | — | — | — |
| Take off | Operator | — | — | — | — | — | — | settings.policies · No access |
| Take off · Sign in again | Admin | — | — | — | access.signin · Sign in again · Take off | access.signin · Sign in again · Take off · Wrong password | — | — |
| Take off · Sign in again | Operator | — | — | — | — | — | — | settings.policies · No access |
| Take off · Taken off | Admin | — | — | — | settings.policies · Take off · Taken off | — | — | — |
| Take off · Taken off | Operator | — | — | — | — | — | — | settings.policies · No access |
