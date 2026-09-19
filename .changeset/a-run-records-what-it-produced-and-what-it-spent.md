---
"invana": patch
---

A run records what it produced and what it spent.

Three bands of the run and task dashboards drew nothing, and all three for the same reason: the
surface was built and no record stood behind it. A dashboard that omits a band says *nobody has
recorded this*, which was true — so the fix is the record, not the panel. None of the composers
changed.

**`result.json` is written, and the interpreter writes it.** A catalogue entry returns its result
and nothing else; the interpreter turns the settled row into the document — status, the entry's
**declared** outputs, artifacts, timing, tokens, error — with every key omitted when there is
nothing to put in it. The filter is the point: a key a step recorded about itself stays off the
document, so `result.json` is a contract rather than a dump of internals, and a new entry ships one
by existing. A run's own is a roll-up — one line per task, its tasks' artifacts in order — not a
copy of documents that are already addressable one click away.

It is written at **every** settle point. A step that failed, one that asked back and one that judged
the ask outside the graph each leave a document behind, because a reader opening any of them is
asking the same question.

**A load lists the files it read.** `validate_records` and `check_bundle` record each file as they
touch it, which is what the Artifacts panel lists. The list rides the step's context rather than its
return value, so a step that stops to ask a question still keeps the four files it had already read.

**Cost is recorded, and unknown is not zero.** `task_runs.cost_usd` is derived when a row settles,
from the tokens it spent and the model's rate. A rate is a fact about a vendor's model rather than
state a Graph owns, so it is a list that ships with the distribution, narrowed by an endpoint's own
contract rate in `guardrails.pricing`. A model nobody has published a rate for leaves the column
unset and the Cost tile absent — never `$0.00`, which would claim the run was free. A local model is
priced at zero, which is a fact; a subscription is unpriced, because a call on a plan is neither
metered per token nor free.

**The ceiling rides the trace with the spend.** `GET …/runs/{id}/trace` now carries `cost_usd` per
step and, on the run, the spend and the agent's effective `max_tokens` and `max_cost_usd` — so the
dashboard reads `8.2k of 40k` and `$0.04 of $2.00` with a meter instead of a bare total. Reading a
ceiling is not enforcing one: pausing at it is a budget approval, and is not part of this.

**An LLM step records its exchange.** The prompt as it was actually sent and the completion as it
came back are written to the step's `output`, so the step dashboard draws them as an exchange rather
than falling back to the recorded document. They are deliberately **undeclared**: declaration is
what makes an output bindable, and a plan that binds a raw prompt has reached into a step's
internals. Both sides are truncated on write, with the cut stated in the text.
