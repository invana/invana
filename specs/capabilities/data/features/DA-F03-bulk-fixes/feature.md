---
id: DA-F03
title: Bulk fixes
product: DA
status: idea
personas: [curator]
stories: [DA-03]
journeys: []
boards: []
depends_on: [DA-F01, DA-F02]
---

# Bulk fixes

> One change made to many records at once — set, clear or map a property — previewed record by record, checked against the model, and written as one run.
> The decision it helps make: *is this change right for every record it touches?*

## User journey

```mermaid
flowchart TD
  start([Records or a Quality rule]) --> sel["DA-03 · The records to change"]
  sel --> ch["DA-03 · Set · clear · map one property"]
  ch --> pv["DA-03 · Preview: before → after, record by record · what the model refuses"]
  pv --> g{Can work on projects · the connection writes?}
  g -->|no| na["Run disabled — the reason"]
  g -->|yes| run{"Run the fix"}
  run -->|written| done(["One run · each record's History names it"])
  run -->|refused| rf["Refused by the model — nothing written · the reason"]
  run -->|fails part way| pf["What was written, what was not · Try the rest"]
```

## Stories

| ID | Story | Status |
|---|---|---|
| DA-03 | [Fix many records at once](stories/DA-03-fix-many-records-at-once/story.md) | idea |

## Rules

| Rule | Detail |
|---|---|
| One property, one change | A fix sets, clears or maps one property across the picked records |
| Previewed before it writes | Nothing writes until the person runs the preview they read |
| Checked by the model | The engine refuses what the published model does not allow, whatever Studio sends |
| One run | The fix is one recorded run; a Cypher database writes it in one transaction, a Gremlin database record by record, stopping at the first refusal and saying what was applied |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Preview a fix | Operator — every member | — |
| Run a fix | `contributor` · shown as *Can work on projects*, on a connection that writes | Disabled — *Ask Priya (owner)*; a read-only connection gives its own reason |

## States

| State | What the person sees |
|---|---|
| First use | No records picked: pick from Records or a Quality rule |
| Empty after a filter | The picked records match nothing to change: the preview says so |
| Loading | The preview builds record by record |
| Has data | Before → after for each record, and what the model would refuse |
| Failed | What was written and what was not, with *Try the rest* |
| Agent working or proposing | — |
| No access | *Run* disabled with its reason; the preview still reads |

## Data touched

| Record | Read or write |
|---|---|
| Nodes and relationships picked | Read · write |
| The published model's keys and constraints | Read |
| The fix's run | Write |

## Decisions

| Decision | Detail |
|---|---|
| A fix is a run | It is in History, on every record it changed, with who ran it and why |
| No undo | A wrong fix is put right by another fix; History keeps both |

## Open questions

| Question | Who answers |
|---|---|
| Writing records needs *Can work on projects* in the engine, as a board's save does (EX-F06); the personas put *loading data* under *Can shape the model*. Recommend: *Can work on projects* for every write here, as the engine enforces | Ravi |

## Not building

| Item | Why not |
|---|---|
| A fix across kinds | One kind at a time keeps the preview readable |
| Scripts or query-shaped fixes | A query that writes is an agent's plan, run under its rules |
