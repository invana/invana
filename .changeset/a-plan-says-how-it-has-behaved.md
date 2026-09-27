---
"invana": patch
---

A library plan can say how it has behaved. `GET …/task-plans/{key}/performance?window=7d|30d|90d`
returns the plan's tiles (runs, served, elapsed and work p50, cost per run, failed, each beside the
window before), runs a day, each step's p50, p95, failures and retries, where it fails, how often
its retry bound was used and exhausted, and each step's three slowest runs.
`GET …/task-plans/{key}/runs` lists every run of the plan, newest first, including runs of skills
that inlined it. You can filter by status, caller and agent, and each failed row names the step it
failed at and why. It replaces the old list of recent runs at the same path.
