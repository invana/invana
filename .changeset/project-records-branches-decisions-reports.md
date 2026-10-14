---
"invana": minor
---

Projects pursue a question: types, branches, findings, decisions, proposals, reports and private projects.

- A project has a `type` (`research · policy · general`), a `question` and a `visibility` (`graph · private`). The type sets its words — `ProjectRead.words` — and changing it only relabels. Every project starts with one branch.
- `…/projects/{key}/branches` lists the tree; `POST …/branches/{n}/fork` forks a branch into children that inherit its findings by reference.
- `POST …/branches/{n}/findings` adds a finding with a stance (`supports · contradicts · context`) and cites (`record · dataset · run`); a dataset cite resolves to its version. A person's finding is reviewed by them; an agent's waits for `POST …/findings/{n}/review`.
- `POST …/branches/{n}/decisions` records a verdict and a decision (`pursue · park · drop · merge`). The verdict must address every contradicting finding; a decided branch takes a new decision only as one that supersedes the last and cites newer evidence. A merge carries findings into another branch by reference.
- Rules can now check the decide act: `evidence.reviewed` and `evidence.not_retracted`, at install, Graph or project scope. A blocking rule refuses with 409 naming the evidence that broke it, and nothing is written; a warning comes back on the decision.
- Agents propose forks and decisions (`POST …/branches/{n}/proposals`); a person accepts or rejects them (`…/proposals/{n}/accept · reject`). Accepting a decision runs the rules as that person.
- `GET …/decisions` lists every decision in the Graph the reader may see.
- `…/projects/{key}/report` drafts a report from the records, edits it, publishes frozen versions that cite their dataset versions, and exports Markdown; a version citing retracted data says so.
- A private project is seen only by the people staffed on it: absent from lists, todos, decisions and search, and 404 by key. The last person cannot be unstaffed.
- `invana projects · branches · findings · proposals · reports` do the same from a terminal.
