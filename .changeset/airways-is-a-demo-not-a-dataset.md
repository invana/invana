---
"invana": minor
---

Airways is a demo now, not three datasets in a drawer (stitch-models.md, Fixtures).

air-routes, news-articles and twitter only mean something together: one is the network
airlines fly, one is what gets written about it, one is what gets said about that. Sitting
in `datasets/` beside the movies graph they read as three unrelated samples, and the thing
they were built for — stitching three models nobody authored together — was documented in a
table you had to already know to look for.

They move to **`demos/airways/`**, with a walkthrough that runs start to finish: create a
user, create a Graph and attach its connection, bulk-load the route network, import and
publish three models, import two record sets through the journal, then declare the ten
stitches and watch a question cross all three. Every command and every count in it was run
against a live engine, not written from memory.

`datasets/` keeps movies and drug-interactions, which really are standalone samples, and
points at the new home.

Nothing about the data changed — same records, same models, same ten stitches. The
generators and the shared emit helpers moved with them and resolve
their neighbours by relative path, so they work unchanged.
