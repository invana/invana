# Handoff — continue the lens work

Paste the whole of this file as the first message of a new session.

---

Continue the Invana lens work. Everything is committed on `main` (`80bbb4a0`); working tree clean.

**P1 is done.** The connector composes, projects and rejects — the phase the whole slice was gated
on. Four commits landed it plus the ground it needed:

```
80bbb4a0  feat(graph): a world that narrows actually narrows      <- P1.1-P1.7
53ba1325  feat(graph): the lens contract, ahead of its enforcement
f2243ea2  fix(docker): the graph databases report their own health
489aec83  feat(graph): every supported database is actually supported
```

Read first, in this order:

```
docs/for-developers/building-engine/lens-migration.md   - P0-P6, and the P1 phase table inside P1
docs/for-developers/modules/govern/spec.md              - GV1-GV18, the one record
docs/for-developers/orchestration.md section 0.9        - how a lens composes and freezes
docs/for-developers/modules/graph-connectors/features/the-connector-contract.md
                                                        - CC1-CC20, what P1 settled
```

**Start with P0, not P2.** P1 did not need it — the connector takes *resolved property names*, so
Govern resolves the axis upstream and the connector never sees one. But P2 cannot be written without
it: `Lens.rules[].select` is `time` / `geo` / `dims`, and GV14 says a lens naming an axis the model
never declared is refused *naming the model and the axis*. There is nothing to validate against
until `axes` exists, and a bound that accepts what it cannot check is the exact failure this slice
exists to prevent.

P0: `axes` on the published model version in `engine/src/invana/apps/modeller/`, migration
`44_a_model_declares_its_axes` (latest is `43_canvases_are_boards`), and a decision in
`connect-and-model/features/domain-models.md`. Engine half only — P0's Studio column (an **Axes**
section in the model editor) belongs in the Studio pass; P2 only needs the field to exist and be
validated.

**One thing to settle before writing the migration:** does `axes` validate against the version's
declared properties *at publish time*, so an axis naming a property the model does not have is
caught when the model is published rather than when a lens uses it? I would say yes, same fail-closed
logic — but it is a decision for `domain-models.md`, not an assumption.

Then P2: the `Lens` record, `effective = agent n plan n todo`, frozen once at run open onto
`task_runs.lens_snapshot`.

Before writing code: do the module pass (README > *How a module gets built*). Test against real
databases, not mocks (CLAUDE.md rule 7). Write a changeset.

---

## Five things to carry in

**The databases are all up and all honest now.** `docker compose --profile extra-dbs up -d` gives you
Neo4j, Memgraph, ArcadeDB and JanusGraph. `engine/tests/graph/connectors/backends.py` is the
registry; both the openCypher and Gremlin conftests parametrize over it, so a test written once runs
on every backend of its language and skips (naming the compose command) on ones that are not up.
Both healthchecks were lying and are fixed — ArcadeDB's ran `curl`, which is not in the image;
JanusGraph's ended in `|| exit 0` and could not fail.

**The fixtures flush the databases.** openCypher teardown is `MATCH (n) DETACH DELETE n`, Gremlin's
is `g.V().drop()`. Running `tests/graph/` empties the local dev Neo4j and Memgraph. Fine when
intended, worth knowing before an unprompted run.

**`elementId()` is not universal, and that seam is load-bearing.** Memgraph has `id()` and no
`elementId` at all. `OpenCypherQueryBuilder.ELEMENT_ID` is the one name; the connector picks the
builder; `coerce_id` / `coerce_element_id` are the single boundaries an element id crosses in each
direction. The lens compiler reads `ELEMENT_ID` off the connection's own builder — hardcoding it
would be a bound failing **open** on exactly one vendor. Anything new that writes Cypher goes
through the builder, not around it.

**The OpenAPI golden is a real guard, not a snapshot to refresh.** `tests/golden/test_openapi.py`
says *stop, do not regenerate* — and it caught the lens digests leaking onto the frontend contract
via `ResultMetadata`, which is serialised to the browser inside `GraphResponse`. `Field(exclude=True)`
does **not** keep a field out of the schema; `PrivateAttr` does. That is the pattern for anything
internal riding on a wire model.

**Still open, none of it blocking P0.** `building-studio/code-shape.md` section 5.2 contradicts
itself on route-vs-`?panel=` — it says the query string wins, then four lines later *"the rail
switches routes, not a param"*, under a heading called *a route per screen*. Settle before P6.
`docs/rfcs/` (17 files) and `docs/internal/` (50) are on main against CLAUDE.md's *there is no RFC
tree*; that needs its own turn, not a sweep into other work. G40 — a skill row vs a plan row,
prose-over-sans vs key-over-mono — is designed but never drawn, and belongs to P6. The design
canvases are still machine-local: `8591piJHezfLsUoSZXn3z8` (governance, 7 artboards) and
`7c565h2z9irbFBwu1S1ebH` (skills + rail, 6); `.design/` is gitignored by design, but the generators
exist only on this machine.
