---
"invana": minor
---

**Workers join from any machine with one command.** Agents › Workers lists every pool, every worker
and the step it runs, where steps wait for want of workers and how many workers would clear them.
*Add workers* walks Docker, Python or a Kubernetes manifest to a join token shown once and checks
the join live; *Run it* starts the engine's own image, `invana/worker:<engine version>`. A worker dials out over HTTPS — `invana worker --engine <url> --token <join> --pool
<name>` — and holds no database credential; a worker silent 30 s is lost and its steps are
redelivered. Tool steps queue by the labels they need, and a pool runs the steps its labels cover.
`invana worker` no longer reads the database directly.
