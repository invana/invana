# Milestones — Invana's own roadmap

Invana's roadmap is **milestones**. There is no *release*: the word is not a term here ([glossary](glossary.md) › Milestone) — say *milestone*.

## What this file is

| Point | Detail |
|---|---|
| It is generic | A milestone here is Invana's own generic [Milestone](glossary.md): a group with a goal, a *done when*, optional dates, what it covers on the map and a person's accept ([PJ-26](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-26-make-a-milestone-from-a-selection/story.md)). It `covers` any subject node and `waits on` a milestone ([PJ-F07](capabilities/projects/features/PJ-F07-the-project-graph/feature.md#rules)) |
| Invana's specs are worked as a Software project | A story is a subject node; the milestone covers stories; tasks roll up to their story through `about` |
| Where it goes | When Invana's own roadmap moves into an Invana project, this file becomes a parse of that project's milestones |

## Milestones

| ID | Name | Waits on | Done when | Journeys |
|---|---|---|---|---|
| MVP | MVP | — | Every journey listed passes end to end | *Confirmed:* [J07](journeys/J07-ready-a-deployment.md) · [J01](journeys/J01-from-a-fresh-deployment-to-a-first-answer.md) · [J02](journeys/J02-ask-and-trust-the-answer.md) · [J03](journeys/J03-give-an-agent-work-and-decide-on-the-result.md) · [J06](journeys/J06-set-what-an-agent-may-touch.md). J01 does not include CP-27 (drop files), a parked story (`later`) that carries no milestone |

## How a story and a journey join a milestone

| Rule | Detail |
|---|---|
| A story's milestone | Optional front-matter `milestone: <ID>` — one value, an ID in the table above. Absent means the story is *unplanned* |
| A journey's milestone | Derived, never typed: a journey is in a milestone when every story it touches is in it |
| A parked story | A story whose `status` is `later` carries no milestone |
| A listed journey | Every story of a journey the milestone lists is in that milestone |
| Boards | A board, flow board and frame shows a milestone badge derived from the stories it cites ([design-language §7](design-language.md#7-naming-boards)); the MVP is confirmed, so its badge reads *MVP* |
