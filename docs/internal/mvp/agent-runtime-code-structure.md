# Engine code structure — the layered layout for the agent runtime

Companion to [RFC-048](rfc-048-agent-runtime-on-prefect.md). That RFC decides *what* the agent
runtime is; this document specifies *where the code lives*, so placement is a rule rather than a
judgement call per file.

- **Status:** Target design.
- **Vocabulary:** a query is a **Thought**; machines do the **Thinking**. See RFC-048 → *Vocabulary*.

---

## 1. The organising principle

One question decides every placement:

> **Does this code have to run inside a worker, with no HTTP request and no ASGI app?**

If yes it goes *down* (`core/`, `tasks/`, `agents/`); if no it goes *up* (`api/`). That is not
aesthetics — a task executing in a Prefect worker has no `Request`, no `app.state`, and no route to
raise an `HTTPException` into. Code that assumes otherwise cannot be composed into a thinking.

The dependency graph is one-way, and **lint enforces it** rather than trusting good intentions:

```
core  →  tasks  →  agents  →  runtime  →  api | worker
```

```
┌─────────────────────────────────────────────────────────────────┐
│ api/                    worker/                                 │  ← knows about HTTP / hosting
│ FastAPI, routes,        task host, credential                   │
│ SSE, admin              exchange                                │
├─────────────────────────────────────────────────────────────────┤
│ runtime/    Runtime protocol · inline adapter · discovery        │  ← the ONE orchestrator seam
├─────────────────────────────────────────────────────────────────┤
│ agents/     trains of thought (specs) + interpreter             │  ← how to think
├─────────────────────────────────────────────────────────────────┤
│ tasks/      typed units of work, deps via TaskContext           │  ← the moves
├─────────────────────────────────────────────────────────────────┤
│ core/       models · stores · schemas · llm · events · errors    │  ← state; runs anywhere
└─────────────────────────────────────────────────────────────────┘
        graph/   connector SPI — public API, sits outside the stack
```

Three rules, all machine-checked (`TID251`, see §7):

1. `core`, `tasks`, `agents` never import `fastapi` or `starlette`.
2. Nothing under `invana` ever imports `prefect`.
3. Nothing below `api` imports `invana.api`.

---

## 2. Target tree — moved

The package tree, the CLI command surface, and the CLI-only dataset decision now live in
[`engine.md`](engine.md) § 1.6 – § 1.8, alongside the rest of the backend architecture. This document
keeps what is specific to the agent runtime: the connector SPI's placement (§ 3), where the
Thought/Thinking domain sits (§ 4), the `TaskContext` contract (§ 5), process ownership (§ 6), and
how the layering is enforced (§ 7).

### Why two distributions, not six

`invana` + `invana-prefect`. At ~25k LOC the boundary that matters is import *direction*, and a lint
rule enforces that as well as a package boundary would — without six `pyproject.toml`s, six venvs,
and cross-package version churn during a restructure. Prefect is the one dependency genuinely worth
isolating: heavy, optional, and it must not be importable from the API. So it — and only it — gets its
own distribution, registered exactly like a graph connector:

```toml
# integrations/invana-prefect/pyproject.toml
[project.entry-points."invana.runtimes"]
prefect = "invana_prefect:PrefectRuntime"
```

The engine never names the adapter; `INVANA_RUNTIME=prefect` resolves it, and startup fails loudly if
the entry point isn't installed. `INVANA_RUNTIME=inline` (the default) needs no orchestrator at all,
which is what keeps `pip install invana && invana start` honest.

---

## 3. Why `invana.graph` sits outside the layers

It looks like the most obviously "core" package in the tree, and it deliberately isn't one.

All six connector distributions import it directly:

```python
# integrations/invana-neo4j/…
from invana.graph.connectors.cypher.connector import OpenCypherConnector
from invana.graph.connectors.base.data_types.schema_elements import ...
from invana.graph.types.capabilities import ...
```

That makes `invana.graph.*` **public API**, not an internal path — the SPI third-party connectors are
written against. Putting it under `core/` would make every connector's import path an internal detail
we could not change without breaking separately-installed packages. The layering guarantee is preserved
the way that actually matters: lint forbids `invana.graph` from importing `api`.

---

## 4. Where the Thought/Thinking domain lives

The vocabulary maps onto the layers cleanly, which is a decent sign it's the right decomposition:

| Concept | Module | Kind |
|---|---|---|
| **Thought** — the ask | `core/thoughts/models.py` | table `thoughts`, immutable |
| **Thinking** — one pass at it | `core/thoughts/models.py` | table `thinkings`, FK → thought |
| **Thought stream** — the trace | `core/thoughts/models.py` + `core/events/notify.py` | table `thought_stream`, append-only, broadcast |
| **Train of thought** — how to think | `core/thoughts` (`agents.workflow_spec`) + `agents/spec.py` | data, validated by `agents/` |
| **Agent** — a way of thinking | `core/thoughts/models.py` (bindings) | bindings: skills · llm config · policy |
| **Task** — a move | `tasks/*.py` | code |
| Posing / rethinking | `api/thoughts/routes.py` | HTTP |
| Thinking it through | `agents/interpreter.py` driven by `runtime/` | execution |

`core/thoughts/` holding both `Thought` and `Thinking` is deliberate: they are one aggregate (you
never load a thinking without its thought), and splitting them buys nothing but a join.

---

## 5. The `TaskContext` contract

Every task needs the same ambient things — a DB session, the graph, a live connector, an LLM, the
grounding schema, who is asking. Passing them as arguments means every signature grows the same tail
and every new caller has to know to thread it. `TaskContext` is that tail, named once.

| Kind of argument | Where it goes |
|---|---|
| genuine inputs (a query, a prompt, a page size) | the task's typed `InModel` |
| ambient dependencies (db, connector, llm, schema) | `ctx.resources` |
| identity of the work (thinking, thought, graph, actor) | `ctx.thinking` |
| anything the user should see | `ctx.emit` |

```python
@dataclass(frozen=True)
class ThinkingRef:
    """Who is thinking about what. Stamped once, carried everywhere."""
    thinking_id: str
    thought_id: str
    agent_id: str
    atlas_id: str
    actor_id: str


class Resources(Protocol):
    """Everything a task may reach for — and, by construction, the only thing it can."""

    db: AsyncSession                                    # app DB, *task*-scoped
    graph: Graph                                        # the resolved container

    async def connector(self) -> BaseConnector: ...     # live graph connection
    async def llm(self, *, purpose: str) -> LLMCall: ...  # provider resolved, key already applied
    async def schema(self) -> GraphVersion | None: ...  # grounding context (render_model_context)
    async def record(self, action: str, **details) -> None: ...   # domain audit event


class TaskContext(Protocol):
    thinking: ThinkingRef
    resources: Resources
    emit: Emitter          # async (Emission) -> None — appends to the thought stream
    logger: Logger
```

Four things this shape buys:

**1. `llm()` hands back a bound call, never a key.** Today `nl_to_query` takes both `provider` and
`encryption_key` and forwards them to `complete_tool`, which decrypts per call — so the Fernet key
travels through the translation layer. `resources.llm()` resolves the provider (explicit → graph
default → error) and returns something already able to make the call. The key never enters a task.
Under D8 (workers hold nothing) this stops being hygiene and becomes structural: a worker is handed a
*usable client*, not a credential.

**2. `connector()` is awaitable.** A synchronous accessor only works against a pool some process
warmed at startup; a worker has no such pool at first touch, so acquisition has to be awaitable. See
§6 — connection ownership is the sharpest problem in this design.

**3. `db` is task-scoped, not request-scoped.** A request-scoped session reads `app.state`; a task's
session lives as long as the task. Same factory, different lifetime — which is why the request-scoped
accessor lives in `api/deps.py` while the factory itself stays in `core/db.py`.

**4. `emit` replaces `return` for anything user-facing.** A task emits progressively and returns only
what the next task needs. Two obligations on the emitter: batch (`graph.delta` carries ~500 elements,
never one row) and carry an idempotency key (a retried task must not double the stream).

**Why `Protocol` and not a base class.** The inline runtime and a Prefect worker build *different*
concrete `Resources` — in-process manager lookup versus credential exchange over `/internal/…` — and a
task must not be able to tell which it got. Structural typing keeps that honest; inheritance would
invite a task to reach for a subclass detail.

**What must stay out.** No `Request`, no `app.state`, no `settings` read, no `HTTPException`, no
constructing a connection. A task that needs something absent from `Resources` is telling you either
that `Resources` is missing a capability, or that the code isn't a task.

---

## 6. Orchestration: which process owns what

Two questions decide the runtime, and only one of them is about Prefect.

### Who runs the interpreter?

**One thinking = one flow, interpreter inside it.** The worker loads the train of thought and drives
the whole loop, pushing step transitions to the engine as it goes. The alternative — the engine
driving task-by-task, submitting each task separately — turns a 5-task thinking into 5 submit/pickup
round-trips, and the latency D1 already accepted would be multiplied by the step count. It would also
put the interpreter's loop state on the wire between every step.

Consequence to accept: a thinking's *step* granularity is visible to the engine only because the
worker reports it (D5), and Prefect sees one task per interpreter dispatch rather than a hand-authored
DAG. That is the trade for keeping the composition in data (D2).

### Who owns the graph connections? — **the hardest question in this design**

A graph connection is not a stateless resource you open per call. The connection manager is a
**stateful, long-lived service**:

| Responsibility | Implication |
|---|---|
| Holds one live connector per graph | pooling — connect cost is paid once, not per query |
| Runs a health loop with backoff retry | a background task, owned by some process |
| Detects + persists server version / compatibility | **writes to the app DB** |
| Runs auto-introspection | **writes to the app DB** |

The last two are what make this sharp: they are writes, so **two owners is a data race**, not a
performance question. Whoever executes a query needs a connector; that forces a decision before any
task touches a graph:

| Option | How | Cost |
|---|---|---|
| **A — worker owns a manager** | Worker constructs its own manager at startup | Needs DB credentials + the encryption key in the worker, contradicting **D8**. Worse: **two health loops** poll the same graph DB and two writers race on version-persist / auto-introspection |
| **B — no pool in the worker** | Per-thinking credential exchange (D8), build a connector, use, close | Clean security, honest with D8 — but pays a graph-DB connect per thinking, on top of submit→pickup latency. Interactive queries feel it twice |
| **C — leased pool, single health owner** | Worker caches connectors per graph with a TTL; credentials arrive per-thinking from `/internal/…/resources`; the **engine is the only** health-checker/introspector; a dead connector is a retryable failure | More moving parts, and a stale-credential path to get right |

**C is the shape that fits the decisions already taken** — it keeps D8 (no standing credentials),
avoids paying connect cost per thinking, and preserves the invariant that matters most: **health
checking and introspection have exactly one owner.** Recorded as the recommendation; not yet a decision.

The `inline` runtime sidesteps all of it: it executes in the API process, which already owns the
manager. Connection ownership is a cost of `INVANA_RUNTIME=prefect` alone — a good argument for
shipping on `inline` first and turning Prefect on once the seam has proven itself.

---

## 7. Enforcement

In `engine/pyproject.toml` — the rules travel with the repo, so a future contributor (or agent) can't
quietly undo the layering:

```toml
[tool.ruff.lint.flake8-tidy-imports.banned-api]
"prefect".msg     = "The engine never imports prefect (RFC-048). The Prefect adapter is a separate
                     distribution: integrations/invana-prefect, via the `invana.runtimes` entry point."
"fastapi".msg     = "Web framework is confined to invana.api (RFC-048) — core/tasks/agents must run
                     unchanged inside a worker. Raise a domain error and let the route translate it."
"starlette".msg   = "Web framework is confined to invana.api (RFC-048). See the fastapi note."
"invana.api".msg  = "Lower layers must not import the control plane (RFC-048). Pass it in via
                     TaskContext.resources instead."

[tool.ruff.lint.per-file-ignores]
"src/invana/api/**"    = ["TID251"]   # the API layer *is* the web layer
"src/invana/worker/**" = ["TID251"]   # hosts agents; legitimately reaches for runtime + control plane
"src/invana/cli/**"    = ["TID251"]   # boots uvicorn / the app
"tests/**"             = ["TID251"]   # exercise routes through the real app
```

Failing from `core` without FastAPI is what `core/errors.py` is for: raise `NotFound("…", id=…)` and
`api/errors.py` maps it to the same `{"detail": {"error": …}}` body the route produced before, so no
client or test sees a difference.

---

## 8. Open questions

| # | Question | Blocks |
|---|---|---|
| Q-CLI | Does the CLI stay **co-located** (direct `core/` access — needs DB + object-storage reach) or become **remote-capable** (token auth over HTTP, so an operator can import from a laptop against a Dockerised engine)? Co-located is the MVP assumption; remote is additive but brings back `POST /datasets` and upload endpoints. | S6d |


Scoped to code that exists. Anything requiring a module that isn't written yet is out of scope here.

- **Who owns graph connections in a worker** (§6, options A/B/C). The one decision that must land
  before a task touches a graph, because health-checking and introspection cannot have two owners.
- Whether `core/thoughts/` should split into `core/thoughts/` + `core/thinkings/` once the retention
  and stream code grows. Start joined; split on evidence, not anticipation.
- Whether `api/routes/` (modeller + events) becomes `api/modeller/` + folds `events.py` into a domain
  package, for consistency with the other `api/<domain>/` packages.
- Whether `expand` and `shape` are separate tasks or one. They are one function in
  `explorer/services.py` today; splitting is a guess about future composition, so start by extracting
  faithfully and split only if a train of thought actually needs them apart.
