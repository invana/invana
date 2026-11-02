# One list contract

System design: [api-and-cli.md](../../../../../specs/system-design/api-and-cli.md) — the list contract: request, `Page[T]`, rules, the lists and their filters, the engine pieces and what is not built. This file keeps one plan row.

## Not building — plan

| Not building | Because |
|---|---|
| The assistant opening a list with filters | The assistant's function lands with Runs and the assistant (F05); this feature gives it the contract and the `?via=assistant` mark |
