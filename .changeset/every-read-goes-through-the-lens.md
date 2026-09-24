---
"invana": minor
---

Two more graph reads now go through governance.

**Clarification options are read under the run's lens.** When the model asks back and grounds its choices in a query, that query now runs inside the run's graph crossing, with the run's lens composed in and the read recorded as a touch. A query that writes is never sent, and a refused or failed read falls back to the fixed options. A world that excludes a value never offers it as a choice.

**Previewing a stitch is a run.** The declare card's count (`POST …/model-links/preview`) and `invana stitches resolve` open `stitch-preview@1` under the Graph's guardrails. A rule naming a type or key the guardrails deny is refused with the reason (`409 preview_refused`, or `refused — …` in the terminal), never counted around it. The preview response is unchanged.
