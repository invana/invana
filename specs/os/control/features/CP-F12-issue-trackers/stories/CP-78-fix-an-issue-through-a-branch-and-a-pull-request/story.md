---
id: CP-78
title: Fix an issue through a branch and a pull request
feature: CP-F12
status: idea
personas: [builder, admin, decision-maker]
boards: [projects.tasks, inbox, settings.plugins]
---

# CP-78 · Fix an issue through a branch and a pull request

**As** a person on a project **I want** an agent to take an issue — or a task linked to one — to a branch, a fix and a pull request at our code host, answer its checks and reviews, and leave the merge to me **so that** the fix reaches the team through the host's own review, nothing lands on the default branch without a person, and the task settles from what happened there. *The agent proposes → the person merges.*

Tasks: [task.md](task.md) · Feature: [CP-F12](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Everything an Operator on the team can; name a connection's agent prefix and protected paths (Manage on `plugin/<name>`, with the password again) | — |
| Operator | On a project they are on the team of: read a task's branch, pull request, checks and reviews; say *Send it* to an agent's push or pull request; approve or refuse an agent's force push of its own branch; accept a merged task. An agent acts under its own Access Policy | Acts disabled — *Join the team to change it*. Protected paths and the prefix read only — *Needs Manage on the {name} plugin — ask {who can grant}*. Nobody has *Merge* in Invana |

## Flow

```mermaid
flowchart TD
  i([An issue · or a task linked to one]) --> br["An agent creates a branch named from the issue · Ask"]
  br --> fx["It fixes in the task's workspace · the tests run on the worker"]
  fx --> ps{"Push"}
  ps -->|the default or a protected branch · a tag · another branch| rf["Refused, naming the ref · recorded"]
  ps -->|a force push of its own branch| fp["Needs you · a person approves this one push"]
  fp -->|approved · recorded| pu
  fp -->|refused or unanswered| fn(["Nothing pushed · the branch stays as it is"])
  ps -->|a workflow file · a confidential value in the diff| rp["Refused, naming the path or the property"]
  ps -->|its own branch · Ask| pu["Pushed"]
  pu --> pr["It opens a pull request linked to the issue · Ask · text through the outbound check"]
  pr --> ck["The host's checks flow back to the task: name · state · link"]
  pr --> rv["Review comments flow back as outside text · the run that read them asks before any write"]
  rv --> an["The agent answers and pushes a fix · Ask"] --> ck
  ck -->|a check failed| fx
  ck --> mg{"A person merges at the host"}
  mg -->|merged · by anyone, a mapped team member included| cl["The host closes the issue · the task moves to Needs you · Merged · never accepted by the event"]
  cl --> ac(["A person on the team accepts in Invana, one click · Done"])
  mg -->|closed unmerged| cx["The task reads Closed at the host · sent back to a person"]
  ps -->|the host is unreachable| dn["Paused, naming why · the branch stays as it is"]
  pr -->|a public repository · not opted in| pb["Refused — data-bearing text is off for it"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-78.1 | A task linked to an issue on GitHub or Gitea, or an issue read in as a twin | an agent in a run on the project begins the fix | it creates a branch named from the issue — the connection's prefix, the issue number and a slug of its title, such as `invana/42-fix-login-redirect` — from the default branch's head; the act is Ask unless its policy allows it, and the task shows the branch |
| CP-78.2 | A task made in Invana with no issue | an agent or a person chooses *Create the issue* first (CP-73.4) | the branch is named from the new issue; a pull request is never opened for a task with no issue |
| CP-78.3 | A branch | the agent works | it clones the repository into the task's workspace on a worker, edits and runs the tests there, and commits as its bot user with the issue's address in each message; nothing leaves the worker until a push |
| CP-78.4 | An agent | it pushes to the default branch, a protected branch, a tag, or any branch other than the one this task created — or force pushes any of them | it is refused before it leaves, naming the ref and that a push goes only to the task's agent branch (a force push is CP-78.19); the attempt is recorded and a security alert may follow |
| CP-78.5 | A push whose diff touches a protected path — the CI and workflow folders by default — or carries a confidential or personal value | it is made | it is refused, naming the path or the property; an Admin with Manage may name what an agent may change in a protected path, recorded |
| CP-78.6 | An agent's push | it is made | it is Ask by default, showing the branch and the files changed; a run that has read outside text asks whatever its policy says (CP-73.17); to a public repository it is refused until an Admin opts the connection in (CP-73.18) |
| CP-78.7 | A task with no open pull request | the agent opens one | it is linked to the issue so that the host closes the issue when a person merges; its text passes the outbound check; it is Ask by default; a task has one open pull request, and a second is refused, naming it; it counts toward the sixth-create hold (CP-73.9) |
| CP-78.8 | A pull request | the host's checks run | the task shows each check's name, state and link, and the pull request's overall checks state, as the next sync reads them; a check's log text is never stored |
| CP-78.9 | A pull request | a reviewer comments or reviews | each comment appears in the task's thread as outside text — fenced, labelled with its author and link — and the run that reads it is tainted: it asks before any write at the host, showing the exact text (CP-73.17, NFR-SEC-15) |
| CP-78.10 | A review comment | the agent answers or pushes a fix | each is an act under its Access Policy, Ask by default, to the same branch and pull request only |
| CP-78.11 | Any agent, in any run | it tries to merge a pull request, or to delete or close a branch, an issue or a pull request | no such tool is offered; a call by name is refused and recorded (CP-74.1) |
| CP-78.12 | A pull request | a person merges it at the host | the next sync sets it merged, the host closes the issue, the task moves to *Needs you* of the project's people reading *Merged — waiting for your accept*, and History records the host's account that merged it; a merge by a person mapped to a team member does not accept the task, and no outside event ever does — the task is Done only when a person on the team accepts it in Invana with one click, recorded under their name |
| CP-78.13 | A pull request | a person closes it at the host unmerged | the task reads *Closed at the host* and returns to a person; no agent reopens it |
| CP-78.14 | A host unreachable or its connection expired | a push or a pull request is attempted | it is refused naming why; the branch stays as it is; the sync resumes when the host is back (CP-73.10) |
| CP-78.15 | A repository whose default branch is not protected | it is linked | a warning names it and recommends protecting the branch at the host; the link is allowed, since protection is the host's own |
| CP-78.16 | A person who may not read the project | they open the task | the branch, the pull request and its checks are withheld |
| CP-78.17 | An Operator not on the team | they try to say *Send it*, accept or change a connection's paths | it is disabled, naming the permission; the engine refuses the same |
| CP-78.19 | An agent whose own `invana/*` branch needs a forced update — after a rebase, say | it asks to force push it | the guarded `force_push_branch` raises a Needs-you item for the people on the team, showing the branch, the commits it replaces and the files changed; nothing is pushed until a person approves, and an approval covers that one push; a refusal, or no answer, pushes nothing; the push then passes CP-78.5 and the outbound check like any push; History records `control.trackers.force_push_approved` or `control.trackers.force_push_refused`, naming the person, the branch and the commits replaced |
| CP-78.20 | An agent | it asks to force push the default or a protected branch, a tag, or any branch it did not create for this task | it is refused before it leaves, naming the ref, whatever a person might approve; no Needs-you item is raised |
| CP-78.18 | A task | its *How it got here* is opened | it shows the branch, each commit pushed, the pull request, each check and review, who merged it and each Ask and its answer |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A task's branch and pull request | Admin | projects.tasks · Detail · Pull request · None yet | — | projects.tasks · Detail · Pull request · Reading | projects.tasks · Detail · Pull request | projects.tasks · Detail · Pull request · Paused | projects.tasks · Detail · Pull request · Agent working | — |
| A task's branch and pull request | Operator | projects.tasks · Detail · Pull request · None yet | — | projects.tasks · Detail · Pull request · Reading | projects.tasks · Detail · Pull request | projects.tasks · Detail · Pull request · Paused | projects.tasks · Detail · Pull request · Agent working | projects.tasks · Detail · Withheld |
| A push or pull request waiting for a yes | Admin | — | — | — | inbox · Needs you · Push or pull request | inbox · Needs you · Push or pull request · Refused | inbox · Needs you · Push or pull request | — |
| A push or pull request waiting for a yes | Operator | — | — | — | inbox · Needs you · Push or pull request | inbox · Needs you · Push or pull request · Refused | inbox · Needs you · Push or pull request | inbox · Needs you · Push or pull request · Not on the team |
| A review comment | Admin | — | — | — | projects.tasks · Detail · Review comment | — | projects.tasks · Detail · Review comment · Agent answering | — |
| A review comment | Operator | — | — | — | projects.tasks · Detail · Review comment | — | projects.tasks · Detail · Review comment · Agent answering | projects.tasks · Detail · Withheld |
| A force push waiting for a yes | Admin | — | — | — | inbox · Needs you · Force push | inbox · Needs you · Force push · Refused | inbox · Needs you · Force push | — |
| A force push waiting for a yes | Operator | — | — | — | inbox · Needs you · Force push | inbox · Needs you · Force push · Refused | inbox · Needs you · Force push | inbox · Needs you · Force push · Not on the team |
| A merged task | Admin | — | — | — | inbox · Needs you · Merged | — | — | — |
| A merged task | Operator | — | — | — | inbox · Needs you · Merged | — | — | inbox · Needs you · Merged · Not on the team |
| A connection's agent prefix and protected paths | Admin | — | — | settings.plugins · Trackers · Paths · Loading | settings.plugins · Trackers · Paths | settings.plugins · Trackers · Paths · Refused | — | — |
| A connection's agent prefix and protected paths | Operator | — | — | — | — | — | — | settings.plugins · Trackers · Paths · Read only |
