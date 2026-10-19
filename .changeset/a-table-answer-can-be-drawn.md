---
"invana": minor
---

An answer's actions sit on its meta line, and a table answer can be drawn on the canvas
(docs/for-developers/modules/ask/features/the-answer-surface.md · ask-in-natural-language.md).

**The meta line.** `30 records · Everything · 33ms` on the left; on the right *How I got this*, then
Share, Save view, Schedule this and Add to a project as icons. What does not fit folds into `⋯`.
The row of labelled buttons under every answer is gone, and Save view shows only on a reply that
holds a graph or was drawn.

**Load to canvas on a table.** When an ask returns a table of things in the graph, Translate also
writes the same query returning whole nodes. The reply offers *Load to canvas*; a click runs that
query as the next ask and draws what it returns. A count or any other aggregate offers nothing.

Drawing a table no longer switches the composer to Cypher: the query it runs is recorded as a
canvas load, folded into the table's reply. *Load to canvas* sits under the answer, not above it.

**New session.** *New* opens a blank thread with the composer focused, instead of returning to the
session list; a *New session* button sits in the assistant's header. The list opens only from
*Sessions*.

A graph answer counts each node and relationship once, so *Returned N nodes and M relationships*
matches what the canvas draws. A new session's first answer, already drawn, no longer offers
*Load to canvas*.

A clarifying question may describe an option in a sentence under its label, when the label alone
would not tell the person which to pick; most options stay one line.

**Clarifying questions read as a question.** While a run waits, the reply is the question — its
options as rows, a description only where one helps, *Something else — let me type* — not a step
inside *How I got this*. Once answered it folds to *Answered · Most routes*. *Try asking* and
*Load to canvas* are chips in one line. A ranking such as *top 10 airports by routes* can now be
drawn. Studio uses design-kit 0.0.35.

A graph answer no longer repeats its counts in a subgraph card under the reply: the sentence and
the meta line say it, and the canvas shows it.
