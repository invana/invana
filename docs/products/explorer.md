# Invana Explorer — ask and look

The simplest product. Prototype page: *Invana Explorer › Ask and look*.

System design: [api-and-cli.md](../../specs/system-design/api-and-cli.md) — the CLI. This file keeps the CLI's build status.

| | |
|---|---|
| For | analysts |
| Scope | One Graph |
| Layout | No product rail. Full width: the board plus the assistant chat. On the board: the mode picker and its tool top-left, the panel rail top-right, the view dock bottom-left — every other action is on right-click |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Features

EX-F1–F3, F6, F8, F9, F11 and F12 are in [EX-F03 · Ask a question](../../specs/products/explore/features/EX-F03-ask-a-question/feature.md) and [EX-F04 · The answer](../../specs/products/explore/features/EX-F04-the-answer/feature.md). EX-F4 — EX-05 · EX-06 — is in [EX-F05 · When it cannot answer, and how it reasons](../../specs/products/explore/features/EX-F05-when-it-cannot-answer-and-how-it-reasons/feature.md).

## CLI — build status

What each command does, and the conventions, are in [api-and-cli.md](../../specs/system-design/api-and-cli.md). This keeps where each stands.

| Command | Status |
|---|---|
| `invana ask "<question>" --graph [--world]` | New |
| `invana query --graph --lang cypher\|gremlin "<q>" \| -f <file>` | New |
| `invana sessions list` · `show <id>` | New |
| `invana views list` · `export <view> --format png\|csv\|md` | New |

`invana views` is `invana boards` in the system design — a saved view is a board.

## Decisions

In [EX-F03 · Ask a question](../../specs/products/explore/features/EX-F03-ask-a-question/feature.md) and
[EX-F04 · The answer](../../specs/products/explore/features/EX-F04-the-answer/feature.md).

## Annotate

In [EX-F06 · Annotate and edit the data](../../specs/products/explore/features/EX-F06-annotate-and-edit-the-data/feature.md).

## Drawn, not built yet

What the prototype draws that Studio does not do yet. Each is a gap, not a non-goal.

| Board | What is missing | Needs |
|---|---|---|
| `explorer.answer.chart` (EX-03) | A chart answer draws on the board; today the emission renders in the chat | The board to host an emission beside the graph |
| `explorer.answer` (EX-02) | Numbered notes the answer pins on the board, and the board tool that adds one | The annotation layer ([§ Annotate](#annotate)) — an answer's notes are annotations by the assistant |
| `explorer.answer.trace` (EX-04) | *Datasets behind the records* under the steps | The run’s dataset bindings on the reply |
| `explorer.home` | The composer’s first chip reads the skill (*Explain*); today it reads the ask kind | The engine picks a skill inside each run from the agent’s bound skills, so nothing names one before the ask; the chip needs the run’s skill exposed on the thread |
| `explorer.board.element` (EX-21) | The Element panel in Studio's board; keys and types from the published model; groups | Studio adopts canvas-ui's `ElementViewPanel` on the Explorer board, fed the model's node and relationship types with their property keys; a group on the board (canvas-ui has none yet) |
| `explorer.board` (EX-18) | Edit and Annotate modes; Export *in view* and Export as CSV; the right-click menus | Data writes from the board (Edit), an annotation layer (Annotate), a viewport export and a CSV export in the engine; canvas-ui context menus |

## Not building

| Item | Why |
|---|---|
| A product rail or docked sidebars | Analysts get the board and the chat; the board’s own panel rail floats on it |
