---
"invana": patch
---

A stitch is addressed by what makes it unique, which includes its edge type (GV24).

Two links between the same pair of types collapsed onto one address. `Tweet -[LINKS_TO]->
Article` and `Tweet -[ABOUT]-> Article` both resolved to `graph_data/stitch/tweet_article`,
so the participant catalogue returned the row twice and no rule could permit one without
permitting the other — an address that cannot separate two participants is not an
identifier, and [GV4](../docs/for-developers/modules/govern/spec.md) says the address is the
only one there is.

`model_links` has always keyed a stitch on `edge_type` alongside its endpoints, so the
address now carries what the uniqueness constraint carries:

| Kind | Address |
|---|---|
| Anchor — no edge type | `graph_data/stitch/country_country` |
| Relationship | `graph_data/stitch/tweet_article@about` |

The `@` discriminator is the one GV4 already defines for model versions, so the grammar is
unchanged and the existing wildcard reaches the pair: `tweet_article@*` is every link
between those two types, `tweet_article@about` is one of them, and `graph_data/stitch/*`
still names them all.

**A rule that named a bare pair no longer matches a relationship.** Nothing shipped writes
one — the airways demo governs models, not stitches — but a lens authored by hand against
`graph_data/stitch/<source>_<target>` needs `@*` adding to keep its reach.

Found by resolving the catalogue against the airways Graph. Every Govern test built its
`Catalogue` by hand, and a hand-built one never has two links between the same two types.
