# Working as a team inside one session

You are the **lead**. You may hand parts of this session to up to **3 sub-agents** (the `Agent` tool), run in parallel in this same checkout and branch. There are no worktrees and no merges: every agent writes straight into the working tree, so the split must keep each file to one writer.

## When to split

| Situation | Do |
|---|---|
| The remaining work touches fewer than ~8 files, or is one surface | Do it yourself; don't split |
| Two or more surfaces (pages, dialogs, tabs) that each live in their own files | Split, one part per surface group |
| Engine work (B) | Split only along modules that import nothing from each other (e.g. `apps/<x>/` vs `server/<y>/`); the lead owns migrations, `schemas.py` shared by both, routes registration and golden files |

## The order

1. **Lead, alone — decisions and the contract.** Read the entry, write the feature-file decisions (steps 0a/0b), then write the **shared contract** every part builds against: types, API client, query hooks / engine schemas, route and board registration stubs, and the barrel exports. Run `check-types` (or `ruff` + `lint-imports`) until it is clean. Parts never change the contract.
2. **Lead — the split plan.** Write a table in your own reasoning: part · surface · files it may create or edit (exact paths or one folder it owns) · what it may import · its e2e spec file. **No file appears in two parts.** Prefer one folder per part (`src/<feature>/<surface>/`).
3. **Parts, in parallel.** Launch every part in **one message** (several `Agent` calls). Each part's prompt carries: the entry id and the stories it builds · the decisions it must follow (quote them) · the contract files to read and not edit · its owned files, and *only* those · the rules below · what to return.
4. **Lead — wire and check.** Add the parts' exports to the shared files, then run Biome, `check-types`, unit tests, and the parts' e2e specs. Fix the seams yourself. Only then run the entry's exit checks and write the hand-off note.

## Files only the lead edits

Never give these to a part — they are where parallel edits collide:

| Area | Files |
|---|---|
| Wiring | `product.tsx`, any `index.ts` barrel, `apps/studio/src/host/declaredBoardBody.tsx`, `leftSectionContent.tsx`, `packages/shell/src/boards/boardKinds.ts`, route tables |
| Contract | `types.ts`, `api.ts`, `queries.ts` of the package; engine `schemas.py`, `models.py`, migrations, `server/app.py` |
| Docs and bookkeeping | `docs/products/migration-sessions.md`, feature files, module specs, `for-developers/README.md`, `the-screens.md`, `terminology.md`, `.changeset/*` |
| Tests shared by all | `e2e/api.ts`, fixtures, golden files, `scripts/migration/*` |

## Rules every part follows (put them in its prompt)

- Edit only the files you own. If you need a change anywhere else — a new field on a type, a route, an export — **don't make it**; return it as a request and the lead applies it.
- Studio: compose from `@invana/*` and tokens only; follow CLAUDE.md *Design rules*. Engine: follow the module's existing idiom.
- Tokens, never currency. No decision ids in code. Never commit, push, or edit `baseline.json` or the log.
- Run Biome and `check-types` on your own files before you return (or `ruff` for engine files).
- Return: files created/edited · exports the lead must wire · requests for files you don't own · anything you could not finish.

## Fix rounds and review

| Stage | How to split |
|---|---|
| Fix | Group the findings by the file they touch. Groups with no shared file go to parallel parts (up to 3); findings in lead-only files, or spanning groups, stay with the lead. Then the lead re-runs every failing check. |
| Review | The lead shoots every board once (`shoot.mjs --live` and `--proto`, so Studio is driven by one process). Then up to 3 reviewer parts each compare a disjoint list of boards and return findings rows. The lead merges them into the one report; the verdict is the lead's. |
