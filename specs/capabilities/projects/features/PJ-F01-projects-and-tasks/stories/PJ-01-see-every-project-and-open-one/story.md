---
id: PJ-01
title: See every project and open one
feature: PJ-F01
status: idea
personas: [decision-maker, analyst]
boards: [projects.list, projects.project]
---

# PJ-01 · See every project and open one

**As** a decision maker **I want** every project I can see in one list, and each one's own page stating its purpose
and facts **so that** I see what is open, what is archived and who owns it, and can correct the purpose in place when it
is mine.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* is *Acts* for every role in the [role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table);
a project's settings are its owners' ([AC-F07](../../../../../../os/access/features/AC-F07-ownership/feature.md)).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every project they can see, open its page, edit its name and purpose in place, archive and unarchive it | A private project they are not on is absent, as for anyone |
| Operator | Read every project they can see, its heading, Details and counts; edit, archive and unarchive the projects they own; a Modeller the same | On a project they do not own: *Edit*, *Archive* and *Unarchive* disabled, naming its owners — *Ask {owner}* |

## Flow

```mermaid
flowchart LR
  s([Projects]) --> any{"Any projects?"}
  any -->|none| e["No projects yet · New project (PJ-02)"]
  any -->|some| l["Every project the reader can see: name · type · counts · archived badge · people only"]
  l --> o["Open a project"]
  o --> h["Heading: name · owners · created · purpose, three lines"]
  h -->|Show more| h2["Full purpose"]
  h --> d["Details: key · purpose · status · owners · created · updated"]
  d -->|Edit — an owner or an Admin| ed["Name and purpose become fields"]
  ed -->|Save| d
  ed -->|Cancel| d
  ed -->|refused| r["Names the field and why · nothing saved"] --> d
  d -->|Archive| ar["Archived · tasks read only · a running run finishes"]
  ar -->|Unarchive| d
  d -->|not an owner| na["Edit, Archive disabled, naming its owners"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-01.1 | No project the reader can see | they open Projects | it reads *No projects yet* with *New project* |
| PJ-01.2 | Projects the reader can see | they open Projects | each row shows its name, type, the engine's counts of branches, open tasks and tasks running, and a muted *archived* badge beside the name when archived |
| PJ-01.3 | A private project the reader is not on | the list loads | it is absent from the list as if it did not exist; a person on it sees *people only* beside it |
| PJ-01.4 | A project's page | it opens | the heading shows the name, its owners, the created time and the purpose clamped to three lines with *Show more*; the breadcrumb is the only way back |
| PJ-01.5 | A project with no purpose written | its page opens | the heading drops the paragraph; Details reads *No purpose written yet* and offers *Edit* to its owners |
| PJ-01.6 | A project whose creator was removed | its page opens | *created by* reads *unknown*, never a bare id; its owners read as they are now |
| PJ-01.7 | An owner of the project, or an Admin | they press *Edit* on Details | name and purpose become fields in place; key, owners and times stay facts; *Save* writes both and *Cancel* leaves them |
| PJ-01.8 | An edit with an empty name | *Save* is pressed | it is refused, naming the field; nothing is saved |
| PJ-01.9 | An active project | an owner or an Admin presses *Archive* | the project reads archived, its tasks go read only, a run already going finishes, and History records *archived* |
| PJ-01.10 | An archived project | it opens | Details shows every field read only and offers its owners *Unarchive*; pressing it makes the project active and History records *unarchived*, a separate row from *archived* |
| PJ-01.11 | The list or a project's counts | they load | every count is the engine's; none is added up in the browser |
| PJ-01.12 | The list failing to load | the request fails | it says why, with *Try again*; rows already on screen stay |
| PJ-01.13 | An Operator or a Modeller who does not own the project | they open its Details | *Edit*, *Archive* and *Unarchive* are disabled, naming its owners — *Ask {owner}* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Projects | Admin | projects.list · No projects yet | projects.list · Nothing matches | projects.list · Loading | projects.list | projects.list · Could not load | projects.list · Tasks running | — |
| Projects | Operator | projects.list · No projects yet | projects.list · Nothing matches | projects.list · Loading | projects.list | projects.list · Could not load | projects.list · Tasks running | — |
| A project and its Details | Admin | projects.project · No purpose written | — | projects.project · Loading | projects.project · Details | projects.project · Could not load | projects.project · Tasks running | — |
| A project and its Details | Operator | projects.project · No purpose written | — | projects.project · Loading | projects.project · Details | projects.project · Could not load | projects.project · Tasks running | projects.project · Details · Not an owner |
| Editing Details | Admin | — | — | — | projects.project · Details · Editing | projects.project · Details · Save refused | — | — |
| Editing Details | Operator | — | — | — | projects.project · Details · Editing | projects.project · Details · Save refused | — | projects.project · Details · Not an owner |
| An archived project | Admin | — | — | — | projects.project · Archived | projects.project · Archived · Could not unarchive | — | — |
| An archived project | Operator | — | — | — | projects.project · Archived | projects.project · Archived · Could not unarchive | — | projects.project · Archived · Not an owner |
