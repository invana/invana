---
name: recommend
description: Raise a recommendation in .claude/team/agents-recommendations.md — anything that should change but is not your task or not a file your role edits (a bug, a missing test, a doc, a security fix, a component, a follow-up) — with one command, never by editing the file. The product manager also uses it to prioritise, take up and close rows. Use whenever you find something outside your task or your edit rights.
---

# Recommend — the one way to ask for a change

Every role edits only its own files (`.claude/team/TEAM.md` §1 *Edit rights*). Anything else you think should change is
a recommendation: one row, raised with `add.py`. Nobody edits `agents-recommendations.md` by hand — the edit-rights hook
refuses it.

## 1. Raise one

```bash
python3 .claude/skills/recommend/add.py add --from <role> --raised-in "<where>" --kind <kind> --severity <severity> \
  --title "<one line>" --description "<what and where · the change recommended>"
```

| Field | Values |
|---|---|
| `--from` | `product-manager` · `project-lead` · `designer` · `coder` · `qa` · `security` · `ravi` |
| `--raised-in` | `session` · `phase <project>/<ID>` (under `/run-project`) · `project <name>` |
| `--kind` | `bug` · `test` · `docs` · `security` · `component` · `debt` · `idea` |
| `--severity` | `blocker` · `high` · `medium` · `low` — your view; the product manager sets the priority |
| `--description` | Where (file:line, criterion ID, board) and the change you recommend, in a line or two |

- It prints the new ID (`R007`). List the IDs under `## Recommendations` in your report.
- A title already in the table is refused with the existing ID — name that ID in your report instead.
- Check first: `add.py list --open` (or `--status taken · declined · done`).

| Raise it | Not it |
|---|---|
| A missing test, an unproven criterion, a doc that is wrong or missing, a fix outside your task, a component the kit lacks, a security fix | A defect in what your task was asked to deliver — that is a *Finding* in your report and goes to a fix round |
| Something only Ravi can decide later | Something your task cannot finish without — that is a *Requests* row (`clarify` · `raise` · `decide`) |

## 2. Take one up — product manager only

```bash
python3 .claude/skills/recommend/add.py take R007 --priority P2 --as "phase specs-accounts/P03"
python3 .claude/skills/recommend/add.py take R008 --priority P3 --as "declined — <reason>"
python3 .claude/skills/recommend/add.py done R007     # its work is done: status done; no row is ever deleted
```

| Priority | Means |
|---|---|
| `P1` | Blocks a story or a release |
| `P2` | This project or the next session |
| `P3` | Later |

*Taken up as*: `session` (a brief to the coder or the designer) · `phase <project>/<ID>` · `project <name>` ·
`declined — <reason>`. A new phase, a new project or a scope change waits for Ravi's yes. The product manager updates
the docs the row needs before the coder builds from them.
