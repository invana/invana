# Migration runner

Runs [docs/products/migration-sessions.md](../../docs/products/migration-sessions.md) unattended, one session after another.

| Step | Who | What |
|---|---|---|
| Pick | `run.py` | the first `pending` row in the log whose *Needs* are `done` (`--track A` limits to one track) |
| Build | headless `claude -p` | `prompts/build.md` for that session, in a fresh context |
| Hand-off | `run.py` | past **300k** context tokens (`INVANA_MIGRATION_CONTEXT_LIMIT`) it asks the agent to stop cleanly and write a hand-off; a new session continues from `prompts/continue.md` |
| Gates | `run.py` itself | lint · types · tests · knip · e2e (Studio) or ruff · tests (engine) |
| Design review | a separate `claude -p` | `prompts/review.md` → `reviews/<ID>.md`, first line `VERDICT: PASS` or `FAIL` |
| Fix | `claude -p` | `prompts/fix.md` with the findings, up to `--max-fix` (3) rounds |
| Close | `run.py` | log row `done`, commit on the session's branch; never pushes |

## Run

```bash
docker compose up -d                                   # Studio on :8300 for the design review
python3 scripts/migration/screen_map.py                # board → route map (re-run after docs change)
python3 scripts/migration/run.py --dry-run             # what runs next
python3 scripts/migration/run.py --track A             # overnight: the Studio restructure
python3 scripts/migration/run.py                       # everything, stopping on the first blocked session
```

| Setting | Default | Meaning |
|---|---|---|
| `INVANA_MIGRATION_CONTEXT_LIMIT` | `300000` | context tokens before a hand-off |
| `INVANA_MIGRATION_STUDIO_URL` | `http://localhost:8300` | where the reviewer screenshots |
| `INVANA_MIGRATION_USER` / `_PASSWORD` | `admin` / `change_me_please` | Studio sign-in for live shots |
| `INVANA_MIGRATION_GRAPH_DB` | unset | an **isolated** graph database for engine tests, e.g. `bolt://localhost:27687` from `docker run -d --name invana-migration-neo4j -p 27687:7687 -e NEO4J_AUTH=neo4j/testpassword neo4j:5-community`; unset = graph-DB tests are skipped (they flush the database) |
| `INVANA_MIGRATION_SANDBOX` | unset | `1` only inside a disposable container: skips permission prompts entirely |

## Seeing the sessions

| Want | How |
|---|---|
| Every Claude session the run started | `.migration-cache/sessions.md` — migration session, step (build · resume · fix · review), `claude -r <id>`, peak context |
| Open one | `claude -r <session-id>` or pick it from `claude --resume` |
| Watch one live | `tail -f .migration-cache/<ID>/<step>.jsonl` |
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
| The working tree has someone else's uncommitted changes | — (refuses to start) |
| Nothing left whose dependencies are done | — |
