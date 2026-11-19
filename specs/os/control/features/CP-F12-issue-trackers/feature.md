---
id: CP-F12
title: Code hosts and issue trackers
product: CP
status: idea
personas: [admin, builder, decision-maker]
stories: [CP-73, CP-74, CP-78]
journeys: [J10, J11, J13]
boards: [settings.plugins, projects.projects, projects.tasks, inbox]
nfrs: [NFR-SEC-1, NFR-SEC-2, NFR-SEC-7, NFR-SEC-8, NFR-SEC-14, NFR-SEC-15, NFR-SEC-16]
depends_on: [CP-F02, PJ-F01, AC-F02, AC-F05, AC-F09, CP-F08]
---

# Code hosts and issue trackers

> Where a project's work meets the code host its team already uses — GitHub or Gitea: its issues, its branches, its pull requests, their checks and their reviews — and the read only sources it learns from: local files and the web.
> When a project is linked, **the tracker is the record of truth** and each issue has an Invana twin that carries its
> runs, checks and context; agents work the host through its own MCP server as their policies allow — branching, fixing,
> pushing and opening a pull request — and nothing ever merges or deletes but a person, at the host. The decision it
> helps make: *what at the host should change, what should merge, and what should go?*

## User journey

Journeys this feature is a step of: [J10 · Fix a reported bug with an agent](../../../../journeys/J10-fix-a-reported-bug-with-an-agent.md) · [J11 · Ideate and run a project with its assistant](../../../../journeys/J11-ideate-and-run-a-project-with-its-assistant.md) · [J13 · Plan and run work from the project graph](../../../../journeys/J13-plan-and-run-work-from-the-project-graph.md)

```mermaid
flowchart TD
  s([Settings › Connections › Trackers]) --> ad["CP-73 · Add a code host: GitHub · Gitea — or a read only source: Local files · Web"]
  ad -->|not Manage on the plugin| na["Disabled, naming the permission"]
  ad -->|cannot reach or sign in| af["Names the address and what failed · nothing stored"]
  ad --> ok["Connected · read only or read and write"]
  ok --> lk["CP-73 · A project is linked to it · its issues become twin tasks"]
  lk --> sy["Fields map · tracker wins a conflict · the thread says what changed"]
  sy --> ag["CP-73 · Agents create · update · comment · close, as policy allows"]
  ag -->|more than 5 creates| ask["Asks a person, naming each"]
  sy --> out["CP-73 · Runs and checks posted out as a summary comment"]
  ag --> br["CP-78 · Branch named from the issue · fix in the task workspace · push to that branch only"]
  br -->|a protected branch · another branch · a workflow file · a force| pr0["Refused, naming it"]
  br --> pr["CP-78 · Pull request linked to the issue · Ask"]
  pr --> rv["CP-78 · Checks and review comments flow back · review text is outside text"]
  rv --> an["The agent answers and pushes fixes · Ask"] --> rv
  rv --> mg{"A person merges at the host · never an agent"}
  mg -->|merged| mgd["The issue closes · the task reads Merged · waiting for your accept"]
  mg -->|closed unmerged| mgc["The task reads Closed · sent back"]
  ag --> wd["CP-74 · Something tagged waiting-deletion"]
  wd --> q["Waiting deletion · and Needs you"]
  q --> d{"A person decides, at the tracker"}
  d -->|deletes| gone(["The twin reads Gone at the tracker"])
  d -->|closes| cl(["Closed · the tag removed"])
  d -->|keeps| kp(["The tag removed · the issue stays"])
  ok -->|unreachable| dn["Sync paused · twins readable · alert to Admins"]
```

## Stories

| ID | Story | Status |
|---|---|---|
| CP-73 | [Connect an issue tracker and link a project to it](stories/CP-73-connect-an-issue-tracker-and-link-a-project/story.md) | idea |
| CP-74 | [Delete an outside issue only by hand](stories/CP-74-delete-an-outside-issue-only-by-hand/story.md) | idea |
| CP-78 | [Fix an issue through a branch and a pull request](stories/CP-78-fix-an-issue-through-a-branch-and-a-pull-request/story.md) | idea |

## Access

Permissions are [the permission catalogue](../../../access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)'s; no act here is new to it. A tracker is a connector, so its connection follows [CP-F02](../CP-F02-plugins-and-outside-tools/feature.md#access).

| Act | Permission | Everyone else sees |
|---|---|---|
| Add, test and remove a tracker connection | Manage on `plugin/<name>`, in a session, with the password again; a second Admin's yes when the deployment asks | Disabled — *Needs Manage on the {name} plugin — ask {who can grant}* |
| Read trackers, their state and their linked projects | Read on `plugin/<name>` | — |
| An agent creating a branch, pushing to its own branch, opening or updating a pull request or commenting on one | The agent's Access Policy: Run on `tool/<host>/<tool>`, on Ask by default | Refused, naming the rule |
| Merging a pull request, deleting a branch, an issue or a pull request | Nobody in Invana — never granted; a person does it at the host | No such tool is offered |
| An agent force pushing its own `invana/*` branch | The agent's Access Policy (Run on `tool/<host>/force_push_branch`) **and** a person on the project's team approving that push in Needs you; no policy, rule or setting skips the approval | Refused, naming that a force push waits for a person's approval |
| Approve or refuse a force push | A person on the project's team | Disabled — *Join the team to change it* |
| Name the protected paths and the agent prefix of a connection | Manage on `plugin/<name>`, in a session, with the password again | Disabled — *Needs Manage on the {name} plugin — ask {who can grant}* |
| Read a task's branch, pull request, checks and reviews | Read on the project | Withheld, as a twin is |
| Accept a merged task | A person on the project's team, as every task | Disabled — *Join the team to change it* |
| Link or unlink a project to a repository or project key a connection may serve | Every person on the project's team | Disabled — *Join the team to change it* |
| An agent creating, updating, commenting on or closing an issue | The agent's Access Policy: Run on `tool/<tracker>/<tool>`, on Ask by default | Refused, naming the rule |
| Name what a connection may serve, its Web hosts or Local files root, and allow data-bearing text to a public tracker | Manage on `plugin/<name>`, in a session, with the password again | Disabled — *Needs Manage on the {name} plugin — ask {who can grant}* |
| Link a project to a remote the connection does not serve | Nobody until an Admin names it | Refused, naming it |
| Deleting an issue | Nobody in Invana — never granted; a person deletes it in the tracker | No delete tool is offered |
| Tag or untag *waiting-deletion*, keep an item | Every person on the project's team, or a run the project's policies let write | Disabled — *Join the team to change it* |
| Read the *Waiting deletion* queue | A person on the project, or with Read on Projects | Items of a project they may not read show as a count, withheld |

## States

| State | What the person sees |
|---|---|
| First use | *No trackers yet* with *Add a tracker* (Admin) · a project: *Not linked* with *Link to a tracker* |
| Empty after a filter | The filter named — tracker, project, tag — with *Clear it* |
| Loading | Trackers or issues reading, nothing guessed |
| Has data | Each tracker with its adapter, state and linked projects; each twin with its issue's address and state |
| Failed | A tracker unreachable or its connection expired, naming why; sync paused; twins stay readable |
| Agent working or proposing | An agent acting on an issue, or a card holding more than 5 creates |
| No access | The act disabled, naming the permission or *Join the team to change it* |

## Rules

| Rule | Detail |
|---|---|
| One adapter interface | Every code host is reached through the engine's `CodeHostAdapter` interface, whose seventeen methods are the only ones offered: `list_issues(since)` · `get_issue` · `create_issue` · `update_issue` · `comment_issue` · `close_issue` · `labels` · `milestones` · `create_branch` · `push_branch` · `force_push_branch` (guarded) · `open_pr` · `update_pr` · `comment_pr` · `get_pr` · `list_checks` · `list_reviews` — implemented by a code-host connector ([CP-F02](../CP-F02-plugins-and-outside-tools/feature.md#rules)) that names its adapter in its manifest. GitHub (`connectors/code_hosts/invana-github`, kind `code_host`) and Gitea (`connectors/code_hosts/invana-gitea`) are the two Invana promises, and both read and write; Jira is Later, and a host the specs do not promise is a connector added later, never a spec change. There is no `merge` and no delete of an issue, a branch or a pull request; `force_push_branch` is the one guarded method — only an agent's own `invana/*` branch, only after a person approves. Local files (a repository's spec files) and Web (pages, for research) are read only sources, reached through the `SourceAdapter` interface; `invana-files` ships bundled, Web and GitHub are installed per need |
| The coding flow | An issue — or an Invana task linked to one — is worked in one path: an agent creates a branch named from the issue, fixes it in the task's workspace, pushes it, opens a pull request linked to the issue, reads the host's checks and review comments, answers them and pushes fixes, and a person merges at the host ([CP-78](stories/CP-78-fix-an-issue-through-a-branch-and-a-pull-request/story.md)); the issue closes at the host and the task settles |
| An agent pushes only to its own branch | A push goes only to a branch the engine created for that task under the connection's agent prefix (default `invana/`); never to the default or a protected branch, to a tag or to any other branch. A push is never forced unless the method is `force_push_branch` and a person has approved that exact push (below). A push whose diff touches a CI or workflow file, or whose files carry a confidential value, is refused before it leaves |
| A force push waits for a person | An agent may force push **only its own `invana/*` branch** (the connection's agent prefix, a branch the engine created for the task), through the guarded `force_push_branch`, and **only after a person approves it**. Each force push raises a Needs-you item showing the branch, the commits it replaces and the files changed; nothing is pushed until a person on the team approves, a refusal or no answer pushes nothing, and an approval covers that one push only. Every other ref — the default or a protected branch, a tag, another branch — is refused whatever is approved. The approved push is recorded as `control.trackers.force_push_approved`, the refused one as `control.trackers.force_push_refused` |
| The tracker is the truth | A linked project's issues are the record; an Invana task is their twin, carrying runs, checks and context. A change to the same field on both sides keeps the tracker's value, and the task's thread says what changed |
| The field map | Title · body · state (open or closed, with a state label) · tags to labels · milestone · assignee (an agent is a bot user of the tracker). Runs and checks go out as one summary comment, through the outbound check; never a run's content |
| Agents act through the tracker's MCP | Create, update, comment and close are the tracker's own MCP tools, called under the agent's Access Policy, on Ask by default as every outside tool is. More than 5 creates in one run waits for a person naming each |
| Deletes and merges are a person's | No agent and no Invana act deletes an outside issue, a branch or a pull request, and none merges one — a person merges at the host. A force push is the one guarded exception, below. A tag *waiting-deletion* puts the item in Settings › Connections and in Needs you; a person deletes it at the tracker, or closes or keeps it, which removes the tag. Only the adapter's seventeen methods are ever offered or granted; every other tool of a tracker's MCP server is Deny, whatever a rule or wildcard says |
| A connection serves only what an Admin names | A connection serves the repositories or project keys an Admin names, none by default; a link outside them is refused. The Admin's token may see more than the connection serves |
| Outside text taints a run | A run that has read an issue, a comment, a review comment, a check's text, a page or a parsed source asks before any write at a tracker, an ask or a proposal, whatever its policy says, and the card shows the exact text ([NFR-SEC-15](../../../../system-design.md#3-non-functional-requirements)) |
| A public tracker gets no data | To a public repository only counts, check names, pass or fail and a link go out; data-bearing comments, created issues, pushes and pull requests are off until an Admin opts the connection in, with a warning shown at that act |
| A fetch goes only where allowed | The Web adapter reaches only the hosts an Admin allows, over https, and Local files only under the Admin's root ([NFR-SEC-16](../../../../system-design.md#3-non-functional-requirements)) |
| A milestone maps to the tracker's own | GitHub's milestone; a tracker with none gets the label `milestone:<name>` as the generic fallback |
| A work connection signs in | A tracker signs in with a work connection ([CP-62](../CP-F02-plugins-and-outside-tools/stories/CP-62-make-a-work-connection-and-attach-it-to-agents/story.md)); the agents' acts use the one attached to them |
| Sync is a pull, then a push | A worker reads a linked project's issues every 60 seconds (or on the tracker's webhook, when it has one) and applies the field map; an act in Invana writes through the adapter first and the twin follows what the tracker returns |
| Backend owns every number | Counts of issues synced, conflicts and items waiting are the engine's |

## Data touched

| Record | Access |
|---|---|
| Tracker connections, branches, pull requests and their checks — connector, address, mode, state; the credential sealed by [CP-F02](../CP-F02-plugins-and-outside-tools/feature.md#engine) | Write · read |
| Tracker links and issue twins | Write · read |
| Tasks and their tags | Write · read ([PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine)) |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `control_trackers` | `name` · `adapter` (`github` · `gitea` · `local_files` · `web` — the id of an installed connector) · `agent_prefix` (default `invana/`) · `protected_paths` (JSON list, CI and workflow folders by default) · `address` · `connector` · `mode` (`read_only` · `read_write`) · `state` (`connected` · `unreachable` · `expired`) · `serves` (JSON list of repositories, project keys or folders) · `allowed_hosts?` (Web) · `root?` (Local files) · `data_text_public` (bool, default false) · `tool_digest` (hash of the pinned MCP server's version and tool schemas) · `created_by_id` | Unique `name`; the credential is the work connection of the plugin, never a column here |
| `control_tracker_links` | `tracker_id` · `project_id` · `remote` (repository or project key, or folder) · `visibility` (`public` · `private`, read at link time and every sync) · `state` (`active` · `paused`) · `last_synced_at?` · `created_by_id` | Unique (`tracker_id`, `project_id`, `remote`) |
| `control_tracker_prs` | `issue_id` · `branch` · `base` · `pr_number` · `pr_url` · `state` (`open` · `merged` · `closed`) · `head_sha` · `checks_state` (`none` · `pending` · `passed` · `failed`) · `merged_by?` (the host's account) · `merged_at?` · `last_seen_at` | One open pull request per issue twin; unique (`issue_id`, `pr_number`) |
| `control_tracker_checks` | `pr_id` · `name` · `state` · `url` · `seen_at` | Names, state and a link only; a check's log text is never stored |
| `control_tracker_issues` | `link_id` · `task_id` · `remote_id` · `remote_url` · `remote_state` · `remote_labels` (JSON) · `remote_hash` · `gone` (bool) · `last_seen_at` | The twin; unique (`link_id`, `remote_id`) |

### Reads

| Record | Owner |
|---|---|
| Tasks, tags (`projects_task_tags`: who tagged, the note), milestones | [PJ-F01 › Engine](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine) |
| Plugins, work connections, the tracker's MCP tools | [CP-F02 › Engine](../CP-F02-plugins-and-outside-tools/feature.md#engine) |
| Asks, the outbound check | [AC-F05](../../../access/features/AC-F05-asks-and-approvals/feature.md#engine) · [AC-F09](../../../access/features/AC-F09-what-left-the-platform/feature.md#engine) |

### Routes

| Route, after `/api/v1/control` | Does | Story |
|---|---|---|
| `GET /trackers` · `POST /trackers` · `DELETE /trackers/{id}` · `POST /trackers/{id}/test` | Trackers by the list contract · add · remove (links and twins stay as records, issues untouched) · test the connection | CP-73 |
| `GET /trackers/{id}/links` · `POST /trackers/{id}/links` · `DELETE /trackers/{id}/links/{link_id}` | A tracker's linked projects · link a project · unlink | CP-73 |
| `GET /tasks/{id}/pull-request` | A task's branch, pull request, checks (name, state, link) and who merged it | CP-78 |
| `POST /tasks/{id}/issue` | *Create the issue* for a task made in Invana | CP-73 |
| `GET /waiting-deletion` | The queue by the list contract: each item's twin, tracker, who tagged it, their note | CP-74 |
| `POST /waiting-deletion/{task_id}/keep` | Remove the tag, keeping the issue | CP-74 |

### Events

| Event | When |
|---|---|
| `control.trackers.add` · `control.trackers.remove` · `control.trackers.state` | A tracker added · removed · its state changed |
| `control.trackers.linked` · `control.trackers.unlinked` | A project linked · unlinked |
| `control.trackers.synced` · `control.trackers.conflict` | A sync settled, with counts · a field kept the tracker's value, from and to |
| `control.trackers.issue_created` · `issue_updated` · `issue_commented` · `issue_closed` | An agent's or a person's act through the adapter |
| `control.trackers.issue_gone` | A linked issue found deleted at the tracker |
| `control.trackers.deletion_kept` | An item kept |
| `control.trackers.branch_created` · `branch_pushed` | An agent branch made · pushed, with the ref and the commit |
| `control.trackers.pr_opened` · `pr_updated` · `pr_commented` | An agent's or a person's act on a pull request through the adapter |
| `control.trackers.checks_changed` · `control.trackers.review_received` | A pull request's checks changed, with counts · a review or a review comment came in |
| `control.trackers.pr_merged` · `control.trackers.pr_closed` | A person merged · closed it at the host, naming the host's account |
| `control.trackers.force_push_approved` · `control.trackers.force_push_refused` | A person approved · refused an agent's force push of its own `invana/*` branch, naming the person, the branch and the commits replaced |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 422 | A tracker that cannot be reached or signs in badly | *{address} could not be reached — {why}.* | CP-73.3 |
| 409 | A write through a read only adapter | *{tracker} is read only.* | CP-73.2 |
| 403 | A policy rule or call that names a code-host tool outside the adapter's seventeen — a merge, a delete | *A merge or a delete at a code host is never granted.* | CP-74.1 |
| 403 | A push to the default or a protected branch, a tag, a branch outside the agent prefix or one this task did not create | *{ref} is not this task's branch — a push goes only to {prefix}….* | CP-78.4 |
| 403 | A push whose diff touches a protected path or carries a confidential value | *{path} is protected — an Admin names what an agent may change there.* · AC-F09's sentence | CP-78.5 |
| 409 | A second open pull request for a task | *{task} already has pull request #{n}.* | CP-78.7 |
| 403 | A link to a remote the connection does not serve | *{remote} is not served by {tracker} — ask {who can grant}.* | CP-73.16 |
| 422 | A source address outside the connection's hosts or root | *{address} is outside what {tracker} may reach.* | CP-73.19 |
| 422 | A fetch that is not https, resolves to a refused address, leaves the root or reads a secret file | *{address} is refused — {why}.* | CP-73.20 |
| 409 | A created issue, or a data-bearing comment, to a public tracker not opted in | *{tracker} is public — data-bearing text is off for it.* | CP-73.18 |
| 409 | A tracker's MCP server whose version or tool schemas changed | *{plugin} is held — its tools changed — ask {who can grant}.* | CP-73.15 |
| 403 | Adding or removing a tracker without Manage on its plugin | *Needs Manage on the {name} plugin — ask {who can grant}.* | CP-73.12 |
| 403 | Linking a project by a person not on its team | *Join the team to change it.* | CP-73.12 |
| 409 | A sixth create in one run before a person says yes | *{n} issues wait for a person to say Create them.* | CP-73.9 |
| 409 | A write while the tracker is unreachable or its connection expired | *{tracker} is {state} — {why}.* | CP-73.10 |

### CLI

| Command | Does |
|---|---|
| — | |

### Mechanisms

| Mechanism | How |
|---|---|
| The adapter interface | `list_issues(since)` · `get_issue` · `create_issue` · `update_issue` · `comment` · `close_issue` · `labels` · `milestones`. There is no `delete`. Each method maps to one tool of the tracker's MCP server; the tool list Invana offers is exactly those tools, every other tool of the server is Deny whatever a wildcard says, and a call by name outside the list is refused and recorded. On connect Invana reads the credential's scopes where the tracker says them and warns on one that could delete, administer or transfer. The MCP server runs in the worker sandbox with a pinned version and hashed tool schemas (`tool_digest`); a change holds the plugin until an Admin approves again |
| Sync | Every 60 seconds, or on the tracker's webhook, per active link: read issues changed since `last_synced_at`, apply the field map to the twin, and where a field changed on both sides keep `remote_*` and write `control.trackers.conflict`. A `remote_id` absent from the read sets `gone` and the twin reads *Gone at the tracker* |
| A write | Through the adapter first, as the actor's connection allows; the twin takes what the tracker returns, never the other way. A run that has read outside text makes every write an Ask showing the exact text and target; to a public tracker a created issue is refused and a comment is the fixed counts template unless `data_text_public` is on |
| Fetching | Web: https only; the host is in `allowed_hosts`; private, unique-local, shared, mapped and metadata addresses refused; every redirect hop re-checked and the checked address used; no credential or cookie; no script; size, time and content-type caps. Local files: a real path under `root`, no symlink or `..`, no secret, key or `.git` config file |
| Milestones | A milestone is written to GitHub's milestone; for a tracker with none the label `milestone:<name>` is the fallback |
| The summary comment | When a twin's run or check settles, one comment on the issue lists the runs and each check's result; the next edits it. Its text goes through the outbound check and is recorded in *What left the platform* |
| Bulk creates | A run's creates — issues, branches and pull requests — through one link are counted; at the sixth the run holds and a card in Needs you names every issue ([CP-76](../CP-F08-the-inbox/stories/CP-76-see-why-an-agent-is-waiting-for-me/story.md)) |
| The coding flow's writes | `create_branch` makes `<prefix><n>-<slug>` from the default branch's head, recorded against the task; the worker clones into the task's workspace and pushes with the connection's credential unsealed for that push only, to that ref only — the check refuses a ref outside the prefix or one this task did not create, a tag, a force and a diff that touches a protected path (the CI and workflow folders, by default, and any an Admin adds) or carries a confidential value (the outbound check, target `code_host`); `open_pr` links the issue so the host closes it on merge, and a task has one open pull request. Each write is an Ask by default and, after outside text, an Ask whatever the policy says |
| Reading a pull request | Each sync reads the pull request's state, head, checks (name, state, link only) and reviews; a review comment is written to the task's thread as outside text, fenced, and the run that reads it is tainted; a merge by anyone sets the pull request merged and its issue closed, and the task reads *Merged — waiting for your accept* in Needs you |
| Waiting deletion | The queue is the tasks of linked projects tagged `waiting-deletion` and not `gone`; a deletion at the tracker sets `gone` and removes the tag |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Three tables in Invana's own store; the credential stays sealed with the plugin's work connection | NFR-SEC-2 |
| § 7 Architecture and components | A tracker adapter per kind, run by the workers; the sync worker; the tracker connector's pinned MCP server, run in the worker sandbox | NFR-SEC-1 · NFR-SEC-14 |
| § 8 APIs and events | The routes and events above, under `control` | — |
| § 10 AI and agents | An agent's act on a tracker is a tool call under its policy; the sixth create holds the run | NFR-SEC-1 |
| § 11 Failure modes and the outside boundary | A tracker down pauses its sync and refuses writes, naming why; twins stay readable; a connection health alert reaches the Admins | — |
| § 12 Qualities | Security: only the adapter's seventeen tools offered, no merge or delete, a force push only of the task's own `invana/*` branch after a person approves; a push only to the task's own agent branch, its diff through the outbound check and protected paths; a summary comment is outbound text through the outbound check; an issue's text is untrusted data and taints the run that reads it; a fetch goes only where an Admin allows | NFR-SEC-7 · NFR-SEC-8 · NFR-SEC-15 · NFR-SEC-16 |

## Decisions

| Decision | Detail |
|---|---|
| The tracker wins | When a tracker is linked, it is the record; Invana's twin carries what the tracker cannot — runs, checks, context |
| A tracker is a connector | GitHub is installed as a connector ([CP-F02](../CP-F02-plugins-and-outside-tools/feature.md#rules)); its connection follows the switches, work connections and Access Policies of every outside tool, and its manifest pins the MCP server it drives and the scopes it needs |
| GitHub and Gitea | Two code hosts are promised; the adapter interface is generic, so another host is a connector installed later, not a change to these stories |
| Deletes are a person's, at the tracker | The only deletion of an outside issue is a person's, there; Invana shows the queue and nothing more |
| Read only adapters | Local files and Web feed the subject model and research; they are never written |
| An issue's text is data | A title, a body or a comment from a tracker is never an instruction to an agent; a run that reads one asks before it writes |
| A poll is 60 seconds | A tracker with no webhook is read every 60 seconds; one with a webhook is read when it calls |
| Only the adapter's tools | The offered tools are an allow-list of the adapter's seventeen methods; a deny-list of names is never the guarantee |
| A person merges | No agent merges, and no setting lets one; the host's branch protection and required reviews stay the team's own |
| A code host, not only a tracker | A connection carries issues, branches, pull requests, checks and reviews through one interface, so the flow from an issue to a merged fix is one path |
| A pull request settles the task only with a person | A merge by anyone — a mapped team member included — moves the twin to *Merged* and the task to Needs you; a person on the team accepts it in Invana with one click, as every task is. Acceptance is never inferred from an outside event |
| A force push waits for a person | An agent may force push only its own `invana/*` branch and only after a person approves that push in Needs you; each approval covers one push and is recorded `control.trackers.force_push_approved` |
| Public trackers get counts, not data | Data-bearing comments and created issues to a public tracker are off by default; an Admin opts a connection in, with a warning at that act |
| A connection serves what is named | An Admin names the repositories or project keys; the link of a person is bounded by it |
| A milestone maps to the tracker's own | GitHub's milestone; the label `milestone:<name>` is the fallback for a tracker with none |

## Open questions

| Question | Who answers |
|---|---|
| Security's medium rows are scheduled with CP-73 and CP-74 and are should-fix before either is `built`: R549 write caps and label pattern · R550 the public tracker's fixed template and the stored comment id · R551 *Closed at the tracker* is not Done, and an assignment never starts a run · R552 webhook signature and no *Gone* on one miss (a 20% brake) · R553 waiting-deletion steering (plain-text note, a grouped card over 5) · R555 the sandbox of the tracker's MCP server · R556 credential hygiene, run id in posted text, a 14-day expiry alert. The coder adds a task for each at the story's `designed` gate | Coder, at build |

## Not building

| Item | Why not |
|---|---|
| Deleting an outside issue from Invana | A deletion is a person's, at the tracker |
| Two-way merge of a conflicting field | The tracker wins; the thread says what changed |
| A tracker of our own | The work is recorded in the engine's tables; a tracker is the team's own |
| Writing to Local files or Web | They are read only sources |
| Jira and Atlassian | Later — a connector added when a team asks; the adapter interface is generic |
| Merging, deleting a branch, closing a pull request; force pushing any ref but an agent's own `invana/*` branch | A person's, at the host |
