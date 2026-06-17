---
"studio": minor
---

Rebuild the graph connection form (create + edit) on the `@invana/forms` schema-driven `ObjectField`
generator.

Connector, URI, username/password, database version, and the read-only toggle are now declared as a
field config array and rendered full-size (`size="md"`) via `ObjectField`, matching the create-graph
form. The test-connection flow, edit-mode immutable connector, and "leave blank to keep" password
behaviour are preserved.
