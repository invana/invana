---
"invana": minor
---

Instructions, pins and evals from the CLI; drift runs follow the changes under them.

- `invana skills list · history · push <skill> --instructions <file> · publish · rollback --to N`. `push` writes the draft and draws its plan; a draw that asks a question exits 2 and prints it.
- `invana agents list · push · publish · pin <agent> --model <address>`. Publish and pin pass the eval gate first, as they do in Studio.
- `invana evals list · run [--draft] · promote <run> --as passing|failing · drift`. A run is worked and scored before the command returns; `run` exits 1 when the gate blocks and 3 when it warns. `invana evals drift` is the nightly pass for an external cron.
- `invana llms list · models <endpoint>` print the addresses a pin takes; `invana plans list · show` read plans.
- Publishing a Graph model and changing a world or guardrail now open the drift pass: a live eval run for every set with active cases.
- `POST …/evals/{skill|agent}/{id}/propose` asks the subject's model for a starter set of up to five cases from its instructions. Each waits as proposed until a person accepts it.
