---
"invana": minor
---

**Runs, Approvals and the Ledger are Agents pages, and the assistant opens them filtered.** Every
run — from any agent, schedule, the assistant or a person — is one row on **Agents › Runs**, numbered
per Graph (`#1002`); a run's status is its exit reason once it ends. A run opens as a workbook tab at
any size:

| Page | Tabs |
|---|---|
| A run | Overview · Agents (Tree · By role) · Stages · Assets · Data touched · Ledger |
| Approvals | Waiting (For you · All · Answered) · Alert rules |
| Ledger | Rows · By actor · By record · Refusals · Export |

**Rerun** offers the same run, the agent's current version, or a retune. **Stop run** records who
pressed it and ends the run's children `parent_ended`. Delegation takes **escrow** from the parent's
budget and returns what is left; ceilings (depth, children, agents in all, live at once) and
*may delegate to* on an agent's Access tab bound it, and a child that stops making progress is ended
`no_progress`. Approvals leaves Activity; Activity › Runs opens the Agents run page. The rail carries
the live-run and waiting-ask counts.

**Every act lands in the Ledger** — steps, refused touches, spawns, refusals, escrow returns and
every person's and agent's event — as a hash-chained row per Graph, verified on the clock. Alert
rules watch it. Ask *"show me Route Auditor's failed runs this month"* and the assistant opens Runs
with those chips set.

Engine: `GET …/runs/{id}/overview · agents · stages · assets · touched`; `f.state`, `f.exit_reason`
and `f.origin` on the runs list; `POST …/runs/{id}/rerun` takes `retune`; approvals take `f.view`
and `scope`; `…/ledger` (rows, stats, actor, record, refusals, export, exports, integrity, a row)
and `…/alert-rules` (list, create, update, delete).
