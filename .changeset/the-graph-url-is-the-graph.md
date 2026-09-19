---
"studio": patch
---

The graph's URL is the graph — `/explorer` is not a screen.

`/u/:username/:graphSlug` redirected into `/u/:username/:graphSlug/explorer`, which was honest
while the page *was* the Explorer. It stopped being honest when the same component grew to host
ten features: the model, datasets, templates, projects, tasks, agents, workflows and the global
model are all reached without the URL changing, so `/explorer` named the page after whichever
`leftNav` item happened to be first rather than after anything on screen.

The root renders the page now. `/explorer` and `/modeller` redirect to it and **carry their query
string across** — a bookmark is a URL plus its params, so dropping `?settings=agents` would land
the reader on an empty state instead of the thing the link was about. `/modeller` gets there in
one hop instead of two.

The name went with the route in three more places:

- The breadcrumb is `owner › graph › <what is open>`. `Explorer` used to sit in the middle;
  `owner › graph` already says where you are.
- `GraphDetailSection` (`overview | explorer | modeller`) and its `NATIVE_SECTIONS[sectionId]`
  lookup collapse to one flat `PAGE_OWNED_SECTIONS` list. One page, so a record keyed by page with
  one key filled in could only ever return the same answer.
- `SetupRequiredBanner` says *"This graph isn't ready yet"* rather than *"Explorer isn't ready
  yet"*. A missing connection belongs to the graph, not to a surface.

`App.tsx`'s Explorer and Modeller `leftNav` items are deleted. They sat behind a
`/u/:username/:graphSlug` path test that no route under that shell can satisfy, so they never drew.
