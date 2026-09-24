---
"invana": minor
"studio": minor
---

The Explorer now shows only what the picked world holds.

**Type counts are a run under the world.** `GET …/explorer/type-counts?lens_id=` opens `count-types@1`. A type the world denies is absent, every count is taken inside the world's slice, and an edge counts only when both of its ends are in the world. Under *EU · H1 2026* the panel lists 1,283 Deals instead of 4,902. Gremlin connections (ArcadeDB, JanusGraph) now count types too; before, they listed types with no numbers.

**The expand menus offer only the world's types.** The right-click submenus and the fine-tune panel list node types the world holds, and edge types whose both ends it holds.

**A reopened canvas shows only what the world returns.** `POST …/explorer/resolve` opens `resolve-elements@1` under the picked world. It answers *present* (in the graph and in the world) and *missing* (gone from the graph, kept and marked). An element the world excludes is in neither list and is not drawn. The saved snapshot is unchanged, so clearing the world brings it back.

**Fixed:** resolving a reopened canvas matched a property named `id` instead of the element id, so on most graphs every node was reported missing.
