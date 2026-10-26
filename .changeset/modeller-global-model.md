---
"invana": minor
---

The Modeller lands on the global model, and every stitch has a page.

- **Global model** is a full-bleed canvas page: every published model in its own frame, its
  types in the model's colour, stitches dashed between them, a floating info bar, a minimap
  and the union list beside it. Clicking an anchored row or a stitch opens the **stitch
  inspector** — its ends and their records, the rule it joins on, how often queries cross
  it, who declared it, and *Open in a draft* · *Remove stitch*.
- **Stitches** is a Graph-wide list: search, Active and Removed, *Declare a stitch*.
- **One model's page** reads *Open in Schema* · *Versions* · *Export* on its head, four tiles
  in a row and *Records over time*; its outline is one list, one line a row.
- **A type's page** has Properties · Indexes · Constraints · Mappings, and each tab adds and
  removes what it lists.
- The models board's **Model** tab is gone — the global model is its own page, and one
  model's schema opens with *Open in Schema*.
- The engine stores how many edges each stitch has written (`model_links.edges`), recounted
  after every stitch commit and import, and serves a stitch's detail and the removed
  stitches.
