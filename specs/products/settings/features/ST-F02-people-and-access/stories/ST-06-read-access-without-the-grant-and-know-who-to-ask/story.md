---
id: ST-06
title: Read access without the grant and know who to ask
feature: ST-F02
status: idea
personas: [analyst, builder]
boards: [shell.locked]
---

# ST-06 · Read access without the grant and know who to ask

**As** a member who cannot manage people **I want** to read every access rule and see who can change it, and every
refused act to name what it needs and who holds it **so that** I know who to ask instead of hitting a dead end.

Tasks: [task.md](task.md) · Feature: [ST-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Every act; this story is what the others see | — |
| Operator | Read every rule, person, group, agent and limit | Each write shown as *Ask Priya*, naming someone who holds the grant; a line *You can read every rule. Priya and Ravi can change them* |

## Flow

```mermaid
flowchart TD
  o([An Operator opens People and access]) --> r["Every rule reads · You can look"]
  r --> n["You can read every rule. Priya and Ravi can change them"]
  r --> a["Edit · New rule shown as Ask Priya (can manage people)"]
  a -->|Ask Priya| ib(["Names who to ask — what it sends is an open question"])
  w([Any write without its grant]) --> d["Disabled, never hidden · names the grant and who holds it"]
  w -->|grant lost since the screen loaded| e["The engine refuses · names the grant and who holds it"]
  e --> d
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| ST-06.1 | An Operator | they open *People and access* | every rule, its lines, limits and holders read; a chip says *You can look* |
| ST-06.2 | An Operator | the sheet is read | one line names who can change rules — *You can read every rule. Priya and Ravi can change them* |
| ST-06.3 | Any act whose grant the reader lacks, anywhere in Studio | it is drawn | it is disabled, never hidden; its tooltip and accessible description name the grant and who holds it — *Needs Can manage people — ask Priya* |
| ST-06.4 | The holders named | the reader is one of them, or there are more than three | the reader is left out; past three it reads *Priya, Ravi or 3 others* |
| ST-06.5 | A write whose grant was taken away after the screen loaded | it is tried | the engine refuses it, naming the grant and who holds it, and the act turns disabled |
| ST-06.6 | Studio has not yet learned the reader's grants, or could not | an act is drawn | it is enabled; the engine still checks every write and its refusal names the grant |
| ST-06.7 | An Operator | they search, filter or open any rule, person, group or agent | it works as it does for someone who can manage people; only the writes differ |
| ST-06.8 | A detail surface whose main act the reader cannot do — a skill, an agent, a model, a project | it opens | one line says *You can read this skill. Editing needs Can build agents — ask Ravi* |
| ST-06.9 | An install Admin who is not a member of the Graph | they open its access | they are refused like any non-member — being Admin opens no Graph |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| People and access, read only | Admin | — | — | — | — | — | — | — |
| People and access, read only | Operator | shell.locked · Built in only | shell.locked · Nothing matches | shell.locked · Loading | shell.locked | shell.locked · Grant lost | — | shell.locked |
