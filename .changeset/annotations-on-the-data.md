---
"invana": patch
---

Annotate the data (4.8, slice 1). A contributor writes annotations on the graph's records — a node, a relationship, one of its values, a highlighted set or a named group — and every board that loads those records shows them, whoever wrote them.

The engine keeps them in the app database (never in the customer's graph), against the records' ids: `GET · POST · PATCH · DELETE …/annotations`, with `record` to read what is on given records. A value annotation keeps the value it was written against. Only its writer changes or deletes an annotation; every member reads them.

In the Explorer, Annotate mode has three tools — Annotate, Highlight, Group — and the board draws cards beside their records that follow them through layout, pan and zoom without covering each other. The rail's **Annotations** panel lists what is on this board and what is elsewhere in the graph, opens one record's values to annotate, and one annotation's detail. The Legend gains an **Annotations** section to hide them by author or kind and to show them in full or as badges, saved with the board. A viewer reads them all, with Annotate off and the reason given.
