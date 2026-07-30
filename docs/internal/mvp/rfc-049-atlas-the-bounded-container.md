# RFC-049 — Atlas: naming the boundary of thinking

| | |
|---|---|
| **Status** | Accepted (vocabulary decision). Not implemented. |
| **Decision** | The top-level container is an **Atlas**, not a Graph. |
| **Definition** | **An Atlas is a bounded knowledge graph your agents can reason over.** |
| **Supersedes** | RFC-017's use of `Graph` as the container noun. RFC-017's *structure* (one container, 1:1 connection, binary membership) is unchanged. |
| **Affects** | Every doc, route, table, and UI string that says "Graph" meaning *container* |

---

## 1. Why rename

`Graph` names four different things, and users meet all four:

| Where it appears | What it means |
|---|---|
| `/graphs`, "create a Graph" | the container |
| `GraphConnection` | the database |
| GraphModel · GraphVersion | the schema |
| the canvas | the rendered picture |

Second problem: it was the only non-human noun left. The vocabulary is now **Thought · Thinking ·
train of thought · Skills · Instructions** — and then a data-structure term at the top.

Third, and the one that decided it: **the container's job is to declare a boundary.** "When the graph
can't answer, the system says so" is only meaningful if there is a declared edge. `knowledge_graph`
implies the opposite of an edge — completeness, a graph of all knowledge. An **atlas** is bounded by
nature: a bound collection of maps of *one* territory, and maps have margins.

---

## 2. What Atlas is, precisely

| Aspect | |
|---|---|
| One-liner | An Atlas is a bounded knowledge graph your agents can reason over |
| Holds | a data-source binding · models · datasets · standing instructions · skills · LLM bindings · agents · canvases · thoughts · members |
| Boundary means | inside the Atlas, answers are grounded and traceable; outside it, the system says it cannot answer |
| Cardinality | a user owns many Atlases; each has one connection (1:1 in MVP) and binary membership |

---

## 3. What is renamed, and what deliberately is not

**Renamed — "Graph" in the *container* sense:**

| Was | Becomes |
|---|---|
| `Graph` entity · `graphs` table | `Atlas` · `atlases` |
| `GraphMember` · `graph_members` | `AtlasMember` · `atlas_members` |
| `graph_id` (FK on every scoped table) | `atlas_id` |
| `GraphConnection` · `graph_connections` | `Connection` · `connections` — the parent already scopes it |
| `GraphConnectionManager` | `ConnectionManager` |
| `/api/v1/graphs`, `/u/{username}/{graphSlug}` | `/api/v1/atlases`, `/u/{username}/{atlasSlug}` |
| route param `graphSlug` | `atlasSlug` |
| `require_graph_member` · `get_graph_membership` · `require_graph_setup_complete` | `require_atlas_member` · `get_atlas_membership` · `require_atlas_setup_complete` |
| "graph-scoped" (skills, LLM providers, agents, datasets, events…) | "atlas-scoped" |
| `Graph.instructions` · `Graph.slug` · `Graph.status` | `Atlas.instructions` · `Atlas.slug` · `Atlas.status` |
| UI: "Create a Graph", graph switcher, graph settings | "Create an Atlas", Atlas switcher, Atlas settings |

**Not renamed — "graph" in the *data-structure* sense.** This is the point of the exercise: the word
is freed up to mean exactly one thing.

| Stays | Because |
|---|---|
| graph database · graph DB connectors · `invana.graph` (connector SPI) | it genuinely is a graph database; the SPI path is public API for `invana-{db}` packages |
| `GraphModel` · `GraphVersion` · graph model / schema | it models a graph |
| `graph.delta` emission · `GraphResponse` | the payload is graph data |
| the rendered graph · `@invana/canvas` · `ExplorerCanvas` | it draws a graph |
| "knowledge graph" as the explanatory phrase | it's the category, and it's what makes Atlas legible |

---

## 4. Teaching cost

Near zero, for three reasons:

| # | Reason |
|---|---|
| 1 | **Atlas isn't a redefined word.** It already means "a bound collection of maps". Contrast the terms that *do* cost teaching — *Thinking* as a noun, *Skill*, *train of thought*. |
| 2 | **The boundary has to be taught either way.** `Graph`/`knowledge_graph` don't teach it; they suggest the opposite. Atlas *reduces* the total teaching. |
| 3 | **It teaches itself where it matters** — the cannot-answer path. |

Where the teaching happens — copy, not onboarding:

| Moment | Copy |
|---|---|
| Create | "An Atlas is everything Invana can reason about for one domain." |
| Setup wizard | Frame it as *drawing the boundary* (connection · model · datasets · instructions), not as chores |
| Empty state | "Nothing in this Atlas yet." |
| **Cannot answer** | "That's outside this Atlas." ← where the concept lands |

Product voice: distinctive noun in-product, category phrase in the first sentence —
**"An Atlas is a bounded knowledge graph your agents can reason over."**

---

## 5. Alternatives considered

| Option | For | Against | Verdict |
|---|---|---|---|
| **Atlas** | bounded by nature · frees "graph" · real instance noun · short in URLs | MongoDB Atlas collision (mild — ours is a noun *inside* the product) | **Chosen** |
| `knowledge_graph` | zero teaching · industry-legible | implies completeness, not boundary · keeps the four-way overloading · it's the *category*, awkward as one row in a list | Rejected; kept as the explanatory phrase |
| `Graph` (status quo) | no rename cost | the overloading, and the odd noun out | Rejected |
| `Brain` | best coherence with Thought/Thinking · memorable | reads playful in procurement | Runner-up |
| `Workspace` | zero teaching · unambiguous | generic; says nothing about knowledge or boundary | Rejected |
| `Mission` | goal-oriented | removed in RFC-017; implies completable | Rejected |
| `Territory` / `Realm` | bounded, no collision | colder / gamier | Fallback if the collision bites |

---

## 6. Open

| # | Question |
|---|---|
| 1 | Plural in UI copy — "Atlases" (correct) vs "Atlas" as a mass noun in nav. Pick one and hold it. |
| 2 | Whether the top-level list route is `/atlases` or stays `/` with the thinking-first home (separate decision). |
| 3 | Whether reusable bindings (LLM providers, skills) move to the **account** level with per-Atlas override — a real friction fix, since today the same API key is configured once per Atlas. Not part of this RFC. |
