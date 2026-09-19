---
"invana": minor
"studio": minor
---

A connection names its database (connect-a-database.md C8, CD8–CD9).

A Neo4j server holds many databases. Invana could say which *server* a Graph read, never
which database on it — the connector quietly took its own default, `neo4j`, and the
Connection panel listed Connector, URI and Access with no line telling you which database
you had actually got. Someone pointing a Graph at a second database had no field to say so.

**Database** is now part of the connection: a column on `graph_connections`, a field in the
connection form, and a row beside the URI in the settings panel. Blank means *the
connector's own default* — and blank means that honestly, so unlike a credential it is
never read as "unchanged" (CD8). Editing it re-tests, exactly as editing the URI does
(CD9); the connector is still frozen after the first save (CD3).

```bash
invana loader ./demos/airways --graph ravi/airways            # the Graph's own database
invana loader ./demos/airways --graph ravi/airways --database staging
```

It is not a secret, so `GET …/connection` returns it and `POST …/connection/test` takes it.
Gremlin backends address one graph per endpoint and simply never receive it.

**Test now means what it said.** `verify_connectivity()` proves the server is reachable and
is not bound to a database, so the openCypher health check runs a query through the named
database as well. Until now a misspelt name passed Test, unlocked Save, and failed every
query afterwards — with the error message already claiming it had verified the database
name.
