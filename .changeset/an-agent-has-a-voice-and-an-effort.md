---
"invana": minor
---

An agent has a voice and an effort of its own (soul.md · AG16 · EB9 · migration 055).

- `agents.soul` (Markdown) and `agents.soul_traits` (humour · formality · emoji · greeting). An empty soul speaks in Invana's default voice. An unknown dial or value is refused at write, naming it. The voice reaches Understand's question and reason and nothing that decides what runs; humour is off whenever a reply refuses, cannot answer, or reports an error or a pause.
- `agents.effort` (`max_steps` · `max_replans` · `max_clarifications`) is the source for how hard an agent tries. Existing numbers are copied into it by the migration, and `workflow_spec` then `budget` are still read where it is silent, for one release. `max_clarifications: 0` now means *never asks*.
- Saving a soul or its dials emits `agent.soul_set`; effort appears in `agent.update`'s changed fields.
- New routes: `GET …/agents/{id}/skills-and-callables` (skills with the callables their plans need, callables with who needs them), `GET …/agents/{id}/meters` (spend, runs, sessions and reach, each beside its limit), `POST …/agents/{id}/soul/preview` (one ask in the current voice and the draft), and `GET …/sessions?agent_id=`.
