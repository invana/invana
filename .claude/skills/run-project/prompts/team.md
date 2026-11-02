# Working as a team inside one session

You are the **lead**. You may hand parts of this session to up to **2 sub-agents** (the `Agent` tool), run in parallel in this same checkout and branch. There are no worktrees and no merges: every agent writes straight into the working tree, so the split must keep each file to one writer.

## When to split

| Situation | Do |
|---|---|
| The remaining work touches fewer than ~12 files, or is one surface | Do it yourself; don't split |
| Two or more surfaces (pages, dialogs, tabs) that each live in their own files | Split, one part per surface group |
| Engine work | Split only along modules that import nothing from each other (e.g. `apps/<x>/` vs `server/<y>/`); the lead owns migrations, `schemas.py` shared by both, routes registration and golden files |

## The order

1. **Lead, alone — decisions and the contract.** Read the entry and the decisions its docs record (a coder never writes them — a gap is a recommendation), then write the **shared contract** every part builds against: types, API client, query hooks / engine schemas, route and board registration stubs, and the barrel exports. Run `check-types` (or `ruff` + `lint-imports`) until it is clean. Parts never change the contract.
2. **Lead — the split plan.** Write a table in your own reasoning: part · surface · files it may create or edit (exact paths or one folder it owns) · what it may import · its e2e spec file. **No file appears in two parts.** Prefer one folder per part (`src/<feature>/<surface>/`).
3. **Parts, in parallel.** Launch every part in **one message** (several `Agent` calls). Each part's prompt carries: the entry id and the stories it builds · the decisions it must follow (quote them) · the contract files to read and not edit · its owned files, and *only* those · the rules below · what to return.
4. **Lead — wire and check.** Add the parts' exports to the shared files, then run Biome, `check-types`, unit tests, and the parts' e2e specs. Fix the seams yourself. Only then run the entry's exit checks and write the hand-off note.

## Files only the lead edits

Never give these to a part — they are where parallel edits collide:

| Area | Files |
|---|---|
| Wiring | `product.tsx`, any `index.ts` barrel, `apps/studio/src/host/declaredBoardBody.tsx`, `leftSectionContent.tsx`, `packages/shell/src/boards/boardKinds.ts`, route tables |
| Contract | `types.ts`, `api.ts`, `queries.ts` of the package; engine `schemas.py`, `models.py`, migrations, `server/app.py` |
| Docs and bookkeeping | the project file's Log row and hand-off note, `.changeset/*` — and, in a product-manager phase, the docs it lands |
| Tests shared by all | `e2e/api.ts`, fixtures, golden files, the project's known-failures files |

## Rules every part follows (put them in its prompt)

- Edit only the files you own. If you need a change anywhere else — a new field on a type, a route, an export — **don't make it**; return it as a request and the lead applies it.
- Studio: compose from `@invana/*` and tokens only; follow CLAUDE.md *Design rules*. Engine: follow the module's existing idiom.
- Tokens, never currency. No decision ids in code. Never commit, push, or edit a known-failures file or the project file.
- Run Biome and `check-types` on your own files before you return (or `ruff` for engine files).
- Return: files created/edited · exports the lead must wire · requests for files you don't own · anything you could not finish.

## Fix rounds and QA

| Stage | How to split |
|---|---|
| Fix | Group the findings by the file they touch. Groups with no shared file go to parallel parts (up to 2); findings in lead-only files, or spanning groups, stay with the lead. Then the lead re-runs every failing check. |
| QA pass 2 | The lead captures every screen once (one process drives Studio). Parts of at most 15 screens each compare a disjoint list and return findings rows; each image is viewed once, never re-read. The lead merges them into the one report; the verdict is the lead's. |
