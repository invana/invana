---
"invana": patch
---

A projected return keeps the clause that follows it, so a governed question with a `LIMIT` runs (CC21).

Driving the first four governed asks against `admin/airways` found it. A world that excludes a
property rewrites a whole-node return into the permitted map projection — and the rewrite was
welding its alias to whatever came next: `MATCH (d:Deal) RETURN d LIMIT 5` became
`… AS dLIMIT 5`, which Neo4j rejects as a syntax error. The reader that finds a return item's
span ends it at the **next clause's keyword**, so the last item owns the whitespace in front of
`LIMIT` / `ORDER BY` / `SKIP`, and an edit that replaced that span whole took the separator with
it. Every edit the compiler makes now stops where the text it is replacing stops.

It was invisible because every projection test wrote a query that ended at its `RETURN`. The two
new ones do not — the same lesson a fourth time: what the fixture builds by hand is what the
fixture cannot check.

**The consequence was not a wrong answer but no answer.** A run under a world that excludes a
property failed as *I couldn't turn that into a query the graph accepts* on any question with a
`LIMIT`, which is most of them. `Price-blind` now answers with `revenue` and `contract_value`
absent from the result, and the result is still a node.
