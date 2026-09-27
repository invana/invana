---
"invana": patch
---

The engine traces who acted and every run they started.

- A request's span names the caller (`enduser.id`, principal, origin — Studio for a session token,
  API for a personal access token) and the Graph it touched; an unauthenticated one is anonymous.
- Each run is an `invana.run` span under the request that started it, and each step attempt an
  `invana.run.step` span under the run, with the graph queries and model calls it made inside.
- Cannot-answer, small talk and a clarifying question are outcomes, not errors; a failed step is.
- Queue waits are events on the run; a delegated child run links to the run that delegated it.
