---
"invana": minor
"studio": minor
---

Settings is three tabs, and a graph has no goals of its own (graph-detail-page.md G23–G24,
objectives-and-criteria.md D1).

The settings panel was one flat form of everything: a graph's name sat above a connection
string sat above a ceiling on concurrent thinkings, three unrelated questions saved by two
different buttons. It read as a junk drawer, which is what a settings screen becomes when
the word means "everything configurable".

It is three tabs now, one per question a person actually arrives with:

| Tab | Answers | Holds |
|---|---|---|
| Basic | what is this graph called, and what is it for | name · description · instructions · archive |
| Graph | what database does it read | the connection, with its own test-gates-save chip |
| Agents | how hard may they run here | concurrency |

The tab **is** the group, so no tab wraps its fields in a collapsible section any more —
a group that is the only thing in its tab is a title over a title. What survives of the
group header is its one-line rule, and the connection's state chip beside it. `?tab=`
carries the open tab, so a setup step opens the field it is asking for rather than the
panel and a second click: *Connect a database* lands on Graph, *Write the instructions* on
Basic.

**`objectives` and `success_criteria` are gone from the Graph.** They belong to a Project —
a Graph is a bounded domain and has no goals of its own (D1) — and the two columns were
written by this one form and read by nothing: not the runtime, not a prompt, not a list.
Migration `000000000036` drops them.

`instructions` is not one of these and stays — the runtime hands it to the LLM as the
graph's standing guidance, and it is one of the two required setup sections. It sits on
Basic, saved with the name and the description: what a graph is called, what is in it and
what it is for are the same answer written at three lengths.
