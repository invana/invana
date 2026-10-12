---
"invana": minor
---

A branch can be simulated (docs/for-developers/modules/work/features/simulation.md).

**A simulator is a plugin, and a simulation is a run.** A simulator plugin declares one task type and one packaged `simulate` flow; Invana checks the spec against the fields it declares, resolves and pins every input dataset version (`publisher/name@v`, by hash) and opens a run of that flow — so a simulation has the run page, trace, retry and recorded task version any run has. A plugin that breaks the contract does not load. The first one, `genomic` (extra `sim-genomic`, in `all`), ranks every female × male cross by the share of its progeny predicted to meet every target, from a deliberately simple mid-parent model that says so.

**Nothing is guessed.** An unknown simulator, a spec field missing, mistyped or unknown, an input that does not resolve and a retracted input are refused before a run opens. A parent no input states, or two inputs that disagree, fails the run by name. The same seed reproduces the same result, and a simulation is always `derived` — a prediction, never an observation.

**API and CLI.** `GET /api/v1/simulators` lists what is installed with each spec field; `POST …/projects/{key}/branches/{number}/simulations` returns 202 with the simulation queued; `GET …/projects/{key}/simulations[/{number}]` reads it, with the ranked result off its run once it succeeded. `invana simulate --project --branch --plugin --file spec.json --input publisher/name@v … [--seed]` runs it and prints the ranked crosses; `invana simulations list · show` read them back.
