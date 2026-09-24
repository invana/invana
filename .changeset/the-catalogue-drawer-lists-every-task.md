---
"invana": patch
---

The Catalogue drawer lists every task a plan may name (7.6).

`GET …/catalogue` renders the runtime's closed catalogue — each entry's bound, one-line summary,
arguments, outputs (with how they roll up across lanes), what must come before it, and how many of
this Graph's reusable plans name it. Studio's Library › Catalogue drawer groups them by the bound
they spend, searches them, and opens an entry's contract in the drawer. It is read-only.
