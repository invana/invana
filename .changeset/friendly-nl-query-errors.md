---
"invana": patch
---

Sessions: show friendly guidance when a natural-language ask fails to execute, instead of the raw database error.

When the LLM mistranslates a question (e.g. `show only 5` leaking into Cypher), Neo4j rejects it with a parser error like `Neo.ClientError.Statement.SyntaxError`. NL-mode asks now surface backend-owned copy keyed off the failure category — syntax → "I couldn't turn that into a query I can run. Try rephrasing…", timeout → "That took too long to answer…", anything else → a generic retry hint (RFC-028). QL-mode asks are unchanged: the user wrote the query, so the real driver error still shows so they can fix it.

Connectors now classify query failures into a coarse `QueryErrorCategory` (syntax / timeout / unknown) carrying the raw vendor code, and the driver round-trip span records the exception (`invana.error.code` / `invana.error.category`) — so every failed translation stays fully reviewable in OTel and the `query.execute` audit event while the user only sees the friendly message.
