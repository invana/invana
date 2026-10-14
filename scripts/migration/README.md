# Migration runner

Runs [docs/products/migration-sessions.md](../../docs/products/migration-sessions.md) unattended, one session after another.

| Step | Who | What |
|---|---|---|
| Pick | `run.py` | the first `pending` row in the log whose *Needs* are `done` (`--track A` limits to one track) |
| Build | headless `claude -p` | `prompts/build.md` for that session, in a fresh context |
| Team | the build, fix and review sessions | [`prompts/team.md`](prompts/team.md): the lead writes decisions and the shared contract alone, then splits surfaces across up to 3 sub-agents in this checkout, one writer per file; wiring, contract and docs stay with the lead |
| Hand-off | `run.py` | past **300k** context tokens (`INVANA_MIGRATION_CONTEXT_LIMIT`) it asks the agent to stop cleanly and write a hand-off; a new session continues from `prompts/continue.md` |
| Gates | `run.py` itself | lint · types · tests · knip · e2e (Studio) or ruff · tests (engine) |
| Design review | a separate `claude -p` | `prompts/review.md` → `reviews/<ID>.md`, first line `VERDICT: PASS` or `FAIL` |
| Fix | `claude -p` | `prompts/fix.md` with the findings, up to `--max-fix` (3) rounds |
| Close | `run.py` | log row `done`, commit on the session's branch; never pushes |

## Run

```bash
docker compose up -d                                   # Studio on :8300 for the design review
python3 scripts/migration/screen_map.py                # board → route map (re-run after docs change)
python3 scripts/migration/run.py --baseline            # once, on untouched studio/: what already fails
python3 scripts/migration/run.py --dry-run             # what runs next
python3 scripts/migration/run.py --track A             # overnight: the Studio restructure
python3 scripts/migration/run.py                       # everything, stopping on the first blocked session
```

| Setting | Default | Meaning |
|---|---|---|
| `INVANA_MIGRATION_CONTEXT_LIMIT` | `300000` | context tokens before a hand-off |
| `INVANA_MIGRATION_STUDIO_URL` | `http://localhost:8300` | where the reviewer screenshots |
| `INVANA_MIGRATION_ENGINE_URL` | `http://localhost:8200` | engine checked (`/health`) before studio gates |
| `E2E_GRAPH_PATH` | `/u/admin/airways` | the Graph e2e specs open; inherited by headless sessions |
| `INVANA_MIGRATION_USER` / `_PASSWORD` | `admin` / `change_me_please` | Studio sign-in for live shots |
| `INVANA_MIGRATION_GRAPH_DB` | unset | an **isolated** graph database for engine tests, e.g. `bolt://localhost:27687` from `docker run -d --name invana-migration-neo4j -p 27687:7687 -e NEO4J_AUTH=neo4j/testpassword neo4j:5-community`; unset = graph-DB tests are skipped (they flush the database) |
| `INVANA_MIGRATION_SANDBOX` | unset | `1` only inside a disposable container: skips permission prompts entirely |

## Baseline

The gates were not green before the migration started. `baseline.json` lists what knip and e2e already fail on at `pre-products-migrations` (taken by `--baseline`, which refuses if `studio/` has changed). A knip or e2e gate passes when every failure it reports is in the baseline; a session is asked to fix only failures that are new. Keys survive a file move: `e2e › <spec file> › <title>`, `knip › <section> › <symbol>`.

Only the driver changes the baseline. A session that edits `baseline.json` has the edit reverted and is told to fix the failure instead; a session that marks its own row `done` is set back to `in progress` — `done` comes after the driver's gates and review.

Known entry: `plan-page` › *a plan that has run reads across its four tabs* needs an LLM-backed ask to have run; a stack with no LLM provider cannot pass it.

Before studio gates the driver checks the dev stack and runs `docker compose up -d engine studio` if it is down; still down after two minutes, the session is `blocked` without spending a fix round.

A session that recreates the stack runs plain `docker compose up -d …`, never `docker compose -f docker-compose.yml …`. `-f` skips `docker-compose.override.yml`, so Studio loses `INVANA_DESIGN_KIT` / `INVANA_CANVAS` and the `/design-kit` and `/canvas` mounts, and runs on the registry `@invana/*` builds. A review shot on that container compares different kits.

## Seeing the sessions

| Want | How |
|---|---|
| Every Claude session the run started | `.migration-cache/sessions.md` — migration session, step (build · resume · fix · review), `claude -r <id>`, peak context |
| Open one | `claude -r <session-id>` or pick it from `claude --resume` |
| Watch one live | `tail -f .migration-cache/<ID>/<step>.jsonl` — or the transcript `~/.claude/projects/<project>/<session-id>.jsonl`, which is written as it goes |
| Overall progress | `tail -f .migration-cache/run.log` |

## Interrupted?

Run it again. A session left `in progress` or `partial` on its branch resumes from the work on disk and its hand-off notes instead of starting over.

## Outputs

| Path | What |
|---|---|
| `docs/products/migration-sessions.md` | the log and hand-off notes — the run's only state; resumable |
| `scripts/migration/reviews/<ID>.md` | each session's design review (committed) |
| `.migration-cache/<ID>/` | full event streams of every build, fix and review session; before/after screenshots (ignored by git) |

## Stops when

| Condition | Log status |
|---|---|
| A session fails gates or review after 3 fix rounds | `blocked` |
| A session needs more than 8 hand-offs | `blocked` |
| The dev stack is down and will not start | `blocked` |
| The working tree has someone else's uncommitted changes | — (refuses to start) |
| Nothing left whose dependencies are done | — |
