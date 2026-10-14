---
"invana": minor
---

Pin the model version an agent or a skill thinks with, and re-run an ask on the versions it used.

- `PATCH …/agents/{id}` takes `model_pin`, a model address `llm/<provider>/<model id>`. Sending `null` hands the choice back to the cast. Moving the pin mints an agent version, and the change log shows the before, the after and the why.
- `PATCH …/skills/{id}/draft` takes `model_pin`. It publishes with the version and carries over to the next draft. A rollback restores the pin with the text.
- A pin is refused if it is an alias (`*-latest`) or a model the graph does not offer. A pin the run's lens denies refuses the run and names the rule. A run never falls back to another model.
- Every run records `model_version`, the provider's version name it called.
- `POST …/runs/{id}/rerun` `{versions: same | current}` opens a new run of a settled ask, linked by `rerun_of_run_id`. `same` calls the recorded version and is refused, naming it, when the graph no longer offers it.
