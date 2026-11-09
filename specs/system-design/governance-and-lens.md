# Governance and the lens

What may take part in a run, what did, and how a person tunes the difference. The **lens** declares what a run may
see, use and send; the **touch record** proves what it did. The run it grounds is [orchestration.md](orchestration.md);
where people set it is [MO-F05](../capabilities/model/features/MO-F05-views-of-the-graph-and-what-must-always-hold/feature.md).
On screen a world is *a view of the graph* and a guardrail is *a rule* ([glossary.md](../glossary.md)).

## What it rests on

| Settled | Means here |
|---|---|
| A lens bounds what a run may **see**, as the envelope bounds what it may **do** | The lens is the governing surface; there is no second bound |
| Bounds narrow, never widen — agent ∩ plan ∩ Todo | Per layer ([Composition](#composition)) |
| *Outside the lens* is a different answer from *not in the graph* | It is the widen signal, and tuning depends on it |
| A narrowed view of the graph is a named **lens** | `subgraph` already means an emission; it is never reused |
| Nothing executes outside the runtime | A scrape, a cache probe and a provider ping are all TaskRuns or recorded on one; there is no ungoverned path |
| A run freezes the plan **and** the world | `plan_snapshot` + `lens_snapshot`; a tuned lens never rewrites what past runs meant |
| Every task run writes `result.json`, assembled by the interpreter | Everything recorded here is a key in that document; no parallel store |
| A band with no record is **absent**, not zero | An unrecorded participant draws nothing — never a zero cost, never *no layers touched* |
| Cost is derived at settle, absent when unpriced | Never estimated silently |

## Layers and the spine

Five governed layers, and the agent as the spine. A layer is governed when a lens could name its members and emptying
it means something other than *nothing runs*.

| Band | Slug | Sublayers | A participant | So it is |
|---|---|---|---|---|
| graph data | `graph_data` | `model` · `stitch` · `dataset` | `graph_data/model/Observations@v2` | Governed |
| llm | `llm` | One per configured provider row | `llm/anthropic/claude-opus-5` | Governed |
| third party | `third_party` | `api` · `app` · `db` · `agent` · `internet` | `third_party/api/clearbit.com/v2/companies` | Governed |
| cache | `cache` | — the four caches | `cache/answer` | Governed |
| human | `human` | `person` · `role` | `human/role/analyst` | Governed |
| agent | `agent` | — | none | The spine — bounded by the envelope and the budget, never by the lens |

| Level | Is | Governed? |
|---|---|---|
| Layer | A class of participant | No — a category is not switched off |
| Sublayer | A grouping inside it; the touch record's `kind` | Yes, as an address prefix |
| Participant | One named member | Yes — the leaf a lens names |

| Rule | Detail |
|---|---|
| One address per participant | `<layer slug>/<sublayer>/<name>`; layer and sublayer are derived from it, never stored |
| `graph data`, not `graph` | The Graph is the container; the layer is the records and models inside it |
| `third party`, not `internet` | The boundary is curation, not the network — a warehouse on the same subnet is as outside the Graph as a public API |
| `layer`, not `lane` | `lane` is one parallel element of a fan-out (`task_runs.lane`) |
| A peer agent stays in `third party` | `third_party/agent/<name>`, not a seventh band. Its response is quoted as data, never executed; its spend is bounded before the call |
| A dark layer was not switched off | Nothing in it was needed, or every participant was outside the lens — the record says which |

## The lens

One record: a list of rules over addresses, plus per-layer settings. A Graph that sets none sees the widest default.

| Field | Is |
|---|---|
| `kind` | `guardrail` · `world` |
| `key` | Null — unnamed, private to its run · set — named, shared in the Graph |
| `scope` | Guardrail only — `graph` or `agent:<id>` |
| `rules[]` | `{match, allow, properties, select, egress}` over addresses |
| `cast` | Role → model address — a resolution, not a bound |
| `as_of` | Transaction time; null is now |
| `cache` | `max_age_s` |
| `human` | `may_ask` · `who[]` · `max_rounds` |
| `egress` | `may_send[]` for any crossing no rule spoke for; default `[]` |

```jsonc
Lens {
  key:  "eu-h1-2026-conservative",
  kind: "world",
  rules: [
    { match: "graph_data/model/Observations@v2", allow: true,
      properties: { exclude: ["revenue"] },
      select: { time: {between: ["2026-01-01", "2026-06-30"]}, geo: {in: ["IE", "DE", "FR"]} } },
    { match: "graph_data/stitch/*",              allow: false },
    { match: "llm/anthropic-prod/*",             allow: true,
      egress: { may_send: ["type_names", "the_question"] } },
    { match: "llm/*/*-haiku-*",                  allow: false },
    { match: "third_party/api/clearbit.com/**",  allow: true,  egress: { may_send: ["entity_keys"] } },
    { match: "third_party/db/**",                allow: false },
    { match: "cache/answer",                     allow: false }
  ],
  cast:   { extract: "llm/anthropic/claude-haiku-4.5", decide: "llm/anthropic/claude-opus-5" },
  as_of:  null,
  cache:  { max_age_s: 300 },
  human:  { may_ask: true, max_rounds: 3 },
  egress: { may_send: [] }
}
```

| Rule | Detail |
|---|---|
| `match` is a glob | `*` is one segment, `**` the rest |
| Deny wins | Over any allow, at any specificity — a narrower allow never punches through a deny |
| Nothing matched is the default | The widest: the whole global model, every configured provider, every third party the agents are credentialed for. No surface grows a required field |
| A model version is pinned, never named | `Observations@v2`, not `Observations` |
| One shape, one freeze, one refusal | Narrowing data, its slice and the model that reads it is one edit; `lens_snapshot` freezes all five layers; a refused endpoint, stitch and year all read *outside the lens* |

### Guardrail and world

One record, one enforcement path, one snapshot, separated by `kind`.

| | `guardrail` | `world` |
|---|---|---|
| Set by | Whoever is accountable, on the Graph or an agent | Anyone who can act in the Graph |
| Meant to be | Always in force, invisible once set | Picked per question, named, compared |
| Surface | Its own route, permission and page | The list of views of the graph |
| In the worlds list | Never | Yes |
| Composition | — | Only narrows a guardrail, never widens it |

| Rule | Detail |
|---|---|
| Naming is sharing | An unnamed lens lives on the runs that used it, seen by whoever ran them; naming it puts it in the Graph's list for everyone. No ownership column, no share action; the field says *Name it to add it* |
| One ladder | unnamed lens → named world → `kind: guardrail`, each one edit, nothing re-authored |
| A guardrail is still an editable row | A bound that must be structurally unreachable would be a second record; this is not it |

| A guardrail's shape | Example | Governs |
|---|---|---|
| Participant | No third party at all · only these two models | What may take part |
| Structural — type | Salary does not exist in this Graph's worlds | What may be read |
| Structural — property | `Deal.revenue` is excluded everywhere | What may be read |
| Extensional | EU regions only, always | What may be read |
| Egress | Never put a property value in a prompt to a hosted model | What may be sent |
| Circumstance | No cached answer older than five minutes · never interrupt a person on an unattended run | How the run behaves |

## Each layer

### graph data

A lens narrows at three grains, and nothing is honoured by filtering afterwards.

| Grain | Removes | Enforced by | *Cannot answer* reads |
|---|---|---|---|
| Type | A model, a type, a relationship | The schema handed to the generating model, and the validator | *this world has no Publisher* |
| Property — `properties.exclude[]` | One property of a type | The same; the validator rejects any reference to it anywhere in a query; the connector rewrites a whole-node return into the permitted projection | *this world does not carry revenue* |
| Records — `select` | Rows | The connector composing the predicate into the query it executes | *outside the slice — H1 2026 only* |

| Rule | Detail |
|---|---|
| Compose, never filter | Rows dropped after return leave counts, aggregates and the schema outside the slice. The generating model is told the slice and the runtime composes it anyway |
| The rewrite is recorded | The trace carries `query.generated` and `query.executed` as two digests |
| Only declared axes are selectable | A model declares its axes on a published version; a lens selecting on an undeclared one is refused naming the model |
| `as_of` and `select.time` are two fields | `as_of` on the lens — transaction time, which versions and stitches resolve. `select.time` on a rule — valid time, a predicate where the model declared that axis. They compose |
| Modelling is a governing act | A property nobody modelled cannot be excluded; an axis nobody declared cannot be sliced |

| Axis | The model declares | A lens selects with |
|---|---|---|
| `time` | Which property carries valid time | `between` · `since` · `at` |
| `geo` | Which property carries the region, and its vocabulary | `in` · `not_in` |
| `dims` | Named properties marked selectable, with their type | `in` · `eq` · `range` |

| You want | The rule |
|---|---|
| Run without links between models | Deny `graph_data/stitch/*` — models in view, cross-model edges not; a question needing a link is *cannot answer* |
| Only certain links | Allow `graph_data/stitch/publisher_sponsor` and `…/article_drug@mentions`. An anchor is its pair of types; a relationship link carries its edge type; `…/article_drug@*` is both |

| `stitch` means two things | Is | A lens can exclude it? |
|---|---|---|
| A declared link between models | Read-time; writes nothing | Yes — it does not resolve |
| The `stitch` step inside an import | Writes edges onto the graph | No — they are records; narrowing them is a `dataset` rule |

### llm

| Rule | Detail |
|---|---|
| The sublayer is the configured provider row | `llm/anthropic-prod/…` and `llm/anthropic-research/…` are different participants with different keys |
| An agent binds no provider | The cast names the model; the Graph resolves the credential from the provider row the address names. An agent's ceiling on models is a lens rule, e.g. `deny llm/**` with two allows |
| No default provider | Providers carry no `is_default`; the cast answers *which model when nobody said*. A default cast ships with the distribution |
| A deleted provider blocks before the run | A cast naming a model whose provider was deleted is refused at start, naming the provider |
| The plan names a role; the lens casts it | A Task carries `role: extract · decide · judge · embed`; the cast binds role → address. Never a model id (not portable) or a tier (does not survive time) |
| Retuning is one line | *Decided by a small model* is fixed by editing the cast and re-running — not the plan, not the agent |
| Two levels | `llm/anthropic/claude-opus-5` one model · `llm/anthropic/*` a provider · `llm/*/*-haiku-*` a family across providers |

### third party

| Rule | Detail |
|---|---|
| Permit or deny, no selector | There is no query to compose a predicate into; `egress.may_send` governs what goes with the call |
| A sliceable third party is a model | Bring it across as a model to get the whole grammar |
| Refused before dispatch | Nothing spent, nothing left — unlike `graph_data`, where a link that does not resolve lets the run continue |
| `third_party/**` denied is useful | Answer from the curated graph alone |

### cache

*A cache that changes what happens next is a node; one that only changes what something costs is a property.*

| Cache | Sits | A hit skips | Recorded as |
|---|---|---|---|
| Answer | Before the whole plan | Every layer — the run ends | A catalogue entry with its own run row, branching the plan |
| Schema | Before a catalogue read | graph data | `result.cache` on the step |
| Result | Before a query execution | graph data | `result.cache` on the step |
| Prefix | Inside the provider's call | Nothing — the call is cheaper | `result.cache` on the step |

| Rule | Detail |
|---|---|
| Freshness | `max_age_s`, per cache |
| Reproducibility | Denying `cache/**` forces every layer to be walked |
| A cache error is a miss | It may change a cost, never an outcome |

### human

| Field | Detail |
|---|---|
| `may_ask` | False turns a clarification into *cannot answer, needs input that may not be requested* |
| `who[]` · `max_rounds` | Who may be asked, and how many times — on the lens, not the plan, because a scheduled run and an interactive one share a plan |

## Egress

Reading a thing and sending it are different permissions: a query may rank by `Deal.revenue` while the number never
enters a prompt.

| Question | Governed by | Denying it means |
|---|---|---|
| What may this run **read**? | allow/deny · `properties.exclude` · `select` | The field does not exist in this world |
| What may it **send**, and to whom? | `egress.may_send` on the rule that matched the destination | Usable inside the deployment; it never crosses |

| Class, narrowest first | Example | Default |
|---|---|---|
| `nothing` | The call carries only its own parameters | — |
| `type_names` | `Company`, `Publisher` | — |
| `entity_keys` | `"Acme Corp"`, an ISO code | Reasonable for an enrichment API |
| `property_values` | `revenue: 4.2M` | — |
| `record_payloads` | The whole node | Never by default |
| `the_question` | The person's own prose | Reasonable for a hosted LLM |

| Rule | Detail |
|---|---|
| Per destination, not per run | An enrichment API, a local model and a hosted model differ |
| An unmatched crossing sends nothing | The lens-level `egress.may_send` defaults to `[]` |
| A hosted LLM is a third party | Anthropic, OpenAI, Google, Azure: governed by `llm/<provider>/<model>` for which and `egress` for what. A local model (Ollama, self-hosted) has no egress to declare — choosing one is a governing act |
| Recorded on every crossing | `sent.classes[]` · `sent.entity_count` · `sent.bytes` · `sent.digest` — an address, never the payload |
| Answerable across the Graph | *Did anything about customer X leave this deployment*, with the runs listed |

## The touch record

One ledger per task run, written by the interpreter at settle — the evidence a person reads to retune.

```jsonc
touches: [
  { "at": "graph_data/model/Observations@v2", "dir": "read", "volume": {"rows": 1284, "ms": 380},
    "select": {"time": {"between": ["2026-01-01","2026-06-30"]}}, "query": "sha256:9f2c…" },
  { "at": "graph_data/stitch/publisher_sponsor", "dir": "refused", "why": "outside the lens - stitches denied" },
  { "at": "llm/anthropic/claude-opus-5", "dir": "call", "role": "decide",
    "volume": {"in": 19300, "out": 840, "cached_in": 18200},
    "sent": {"classes": ["type_names", "the_question"], "bytes": 74210, "digest": "sha256:c4d1…"} },
  { "at": "cache/prefix", "dir": "hit", "volume": {"tokens": 18200} },
  { "at": "third_party/api/clearbit.com/v2/companies", "dir": "read", "volume": {"bytes": 4021},
    "sent": {"classes": ["entity_keys"], "entity_count": 1} },
  { "at": "human/role/analyst", "dir": "ask", "volume": {"rounds": 2}, "ref": "task_prompt:7c1e…" }
]
```

| Field | Holds |
|---|---|
| `at` | The participant's address — the string the lens matches on |
| `dir` | `read` · `write` · `call` · `hit` · `miss` · `ask` · `refused` |
| `why` | Refusals only — which rule refused, in words a person can act on |
| `select` | `graph_data` only — the slice actually composed |
| `role` | `llm` only — which cast entry resolved it |
| `volume` | What the layer reports — rows, tokens, bytes, rounds; absent when none |
| `sent` | Boundary crossings only ([Egress](#egress)) |
| `query` · `ref` | Addresses — a digest, a prompt id — never payloads |

| Record | Carries |
|---|---|
| `TaskStream` | The complete ledger in `seq` order — every touch, the spine included: every dispatch, binding, condition evaluation and roll-up |
| `result.json` → `touches[]` | The five governed layers, plus the spine's decisions — `when` · `until` · `loop`, each with its expression and resolved value. A projection of the stream, not a second record |

| Rule | Detail |
|---|---|
| Addresses, never payloads | A trace row never holds a prompt or rows |
| The interpreter writes it, never a callable | A callable reporting its own touches could under-report |
| A refusal is a touch | `dir: refused` is the widen signal |
| Nothing filtered on write | The stream holds everything; the touches view shows the five layers, the spine a toggle |
| Retention differs | Spine frames age out on their own schedule |

| Reading | Act |
|---|---|
| A model version allowed, touched by nothing across 40 runs | Narrow |
| `refused` on the same link 12 times | Widen, or accept *cannot answer* deliberately |
| `select.time` clipping a query that wanted 2025 | Widen the slice, or confirm it is the point |
| `role: decide` resolved to a small model on the step that wrote the number | Retune the cast, re-run, compare |
| `sent.classes` includes `property_values` unexpectedly | Tighten `egress`; the runs that did it are listed |
| Every llm touch names a hosted provider | Move one role to a local model |

## Composition

A lens may sit on the agent, the plan and the Todo. Every operation narrows.

```
effective.allow  = ∩ allow        every level must permit it
effective.deny   = ∪ deny         any level may forbid it (deny wins at any specificity)
effective.select = the intersection of the slices, per model
effective.cache  = the strictest max_age
effective.human  = may_ask only if all three allow it; the smallest max_rounds
effective.cast   = innermost wins (Todo over plan over agent), then checked against effective allow / deny
```

| Rule | Detail |
|---|---|
| A Todo cannot widen its agent's lens, in any layer | Refused with the bound named |
| The cast is a resolution, not a bound | It does not intersect; a Todo casting `decide → haiku-4.5` is honoured when allowed and refused naming the rule when not |
| A delegated child inherits ⊆ its parent's lens | Including `third_party` and every slice |
| A replan never changes the lens | A different lens is a different run |

| The answer needs | The person is told | Recoverable by |
|---|---|---|
| Something outside the lens | *Grounded in Observations@v2, H1 2026, no links; the answer needs the Publisher link* — naming the rule | Widening the lens and re-running |
| Something not in the graph | *The graph does not hold it* | Bringing data in |

## What it adds to the record

No new table.

| Added | Where | Kind |
|---|---|---|
| `layer` · `sublayer` | Derived from the address | No column |
| `Lens.rules[]` | `Lens` and `lens_snapshot` | JSONB |
| `Lens.cast` · `cache` · `human` · `egress` | `Lens` and `lens_snapshot` | JSONB |
| Declared axes — `time` · `geo` · `dims` | The model, on a published version | Model metadata |
| Predicate composition | The connector contract — `run_query` | Composed into the dialect |
| `role` | `Task` | Text |
| `touches[]` · `sent` | `result.json`, by the interpreter | Document keys |
| `tokens_cached_in` | `result.json` → `tokens` | Int, a fact |
| Cost by layer and participant | `GET …/metrics/cost` | A grouping, no new source |

## Not building

| Not building | Because |
|---|---|
| A second record for governing | Every fact is a key in `result.json` or a field on the lens |
| Payloads in the touch or egress record | `at`, `query`, `ref` and `digest` are addresses |
| A new word for a narrowed view | It is a named lens; `subgraph` already means an emission |
| Selectors on undeclared properties | That is a query; an axis is declared on the model or not selectable |
| Post-filtering to honour a selector | A filter that reaches only the display is not a bound |
| Most-specific-rule-wins | A deny a narrower allow can punch through is not a bound |
| A reason for every layer a step did not touch | Untouched is the complement of touched |
| Estimated savings on a run drawing | A counterfactual drawn as a figure reads as something that happened |
| Automatic model downgrade to save tokens | A silent switch changes what produced an answer; retuning the cast is a person's recorded act |
| Redaction or masking of what leaves | Egress governs whether data goes, not a transformation of it |
| A lens per step | The lens is the run's circumstances; per-step narrowing is the plan's job |
| A DAG editor over the layer flow | The flow draws a record and a validated plan, never a hand-authored graph |
| Alerting when a layer lights unexpectedly | A product surface, not a monitoring platform |
