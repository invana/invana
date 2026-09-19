---
"invana": patch
---

An Atlas whose graph connection isn't live no longer reads as an engine crash.

Any thinking step that reaches for the graph can hit `no_connection` or `graph_not_active`. Those raised out of the step and landed on the reader as *"Something went wrong inside the engine while answering"* — a defect message for a fact about the Atlas, with a stack trace in the engine log and nothing to act on in Studio. They now arrive as a `db_unreachable` diagnosis carrying its own sentence ("The graph connection is not active right now.") and the **Check the connection** route. The conversion sits on the runtime's dispatch, so it holds for every task rather than the one that happened to catch it.
