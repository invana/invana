---
id: CP-10
title: Add workers on my own machines with one command
feature: CP-F03
status: idea
personas: [admin]
boards: [settings.workers]
---

# CP-10 · Add workers on my own machines with one command

**As** an Admin **I want** to add workers on my own machines with one command, and watch them join **so that**
capacity is a command away, not a code change.

Tasks: [task.md](task.md) · Feature: [CP-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Add workers: pick where, a group (or make one), mint a join key, run the command, watch it join | — |
| Operator | — | *Add workers* disabled — *Needs the Admin role — ask {admins}* |

## Flow

```mermaid
flowchart TD
  s([Control Plane › Workers › Add workers]) --> wh["Where: Docker · Python · Kubernetes"]
  wh --> g{"Group"}
  g -->|existing| ge["Its labels · slots · plugins · runtimes · secret names · outbound domains"]
  g -->|new| gn["Name · labels · slots a worker · plugins · runtimes · secret names · outbound domains"]
  gn -->|a runtime not installed| ri(["Offered disabled · CP-64 · Install it in Plugins"])
  ge --> k["Join key: expiry · cap · shown once"]
  gn --> k
  k --> run["Run it: the command or the manifest"]
  run --> chk{"Joining checks"}
  chk -->|key expired or used up| k
  chk -->|engine not reached| net["Check outbound 443 to the engine"]
  chk -->|plugins, runtimes or labels do not fit| ge
  chk -->|nothing after 2 minutes| cl["What to check"]
  chk -->|first heartbeat| j(["Joined · takes work"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-10.1 | An Admin | they press *Add workers* | a modal opens on *Where*, Docker first, then *Group*, *Join key*, *Run it*, *Joined* |
| CP-10.2 | *Add workers* from a short group | it opens | that group is chosen |
| CP-10.3 | A new group | it is made | it has a name unique for the deployment, labels from `cpu · llm · egress · gpu · code`, slots a worker, plugins, the runtimes it carries, secret names and outbound domains |
| CP-10.4 | A join key | it is minted | it is scoped to the group, with an expiry and a cap; its secret shows once, in the command; afterwards only its prefix reads |
| CP-10.5 | *Run it* | it is read | Docker reads one `docker run` line; Python an install and one command, and a service install; Kubernetes three lines and a manifest to download — each carrying the group, labels and slots |
| CP-10.6 | A worker joining | each check passes or fails | key used · engine reached · plugins loaded · labels fit · first heartbeat show as they happen, each failure with what to check |
| CP-10.7 | Nothing after two minutes | *Joined* waits | a checklist of what to check reads |
| CP-10.8 | A refused join — expired or used-up key, labels outside the group, plugins missing | the worker tries | no worker is made, and the worker is told the reason |
| CP-10.9 | A joined worker | it heartbeats | it takes work its group covers, holding no database credential and no inbound port |
| CP-10.10 | An Operator | they look for *Add workers* | it is disabled — *Needs the Admin role — ask {admins}* |
| CP-10.11 | A key minted or a worker joined | it is done | History records who and when (AC-F06) |
| CP-10.12 | An Admin | they change a worker group — its labels, slots a worker, plugins, secret names or outbound domains | the change is stored and History records who and when (AC-F06); workers that join afterwards take it |
| CP-10.13 | An Operator | they open *Join keys* | every key reads its group, prefix, expiry, how many joined of its cap, and whether it is revoked — never its secret |
| CP-10.14 | A group's runtimes | an Admin picks them | only runtimes installed as runtime plugins are offered; one not installed reads disabled, naming *Install it in Plugins* (CP-64); a group that carries an outside runtime needs the `code` label, or the change is refused, naming it |
| CP-10.15 | A worker joining a group that carries a runtime | the joining checks run | *runtimes loaded* passes only when the worker loaded each runtime the group carries, at a version its plugin allows; else the join is refused, naming the runtime |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Add workers | Admin | settings.workers · Add workers | — | settings.workers · Waiting to join | settings.workers · Joined | settings.workers · Join failed | — | — |
| Add workers | Operator | — | — | — | — | — | — | settings.workers · Read only |
