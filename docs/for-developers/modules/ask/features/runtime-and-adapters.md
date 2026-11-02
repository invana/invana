# The runtime

System design: [runtime.md](../../../../../specs/system-design/runtime.md) — the runtime protocol, the in-process executor, reconciliation and what is not built (§ Executor and workers). This file keeps *Today* and one retired row.

## Today

There is one runtime and it is Invana's. No broker, no worker pool, no external scheduler, and no
adapter package — the protocol exists as a seam, not as a shipped integration. The honest description
of what this product does today is: **it orchestrates agents, and it runs them itself.**

## Retired

| Row | Why |
|---|---|
| Not building: *queues, brokers, backfills, fair-share — a scheduler's job* | Pools grant slots fair-share and procrastinate is the chosen queue ([runtime.md](../../../../../specs/system-design/runtime.md)) |
