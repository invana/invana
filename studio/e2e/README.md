# Studio end-to-end tests

Playwright, against a Studio that is **already running** and talking to a real
engine and a real graph database. Nothing is mocked (CLAUDE.md rule 7), so the
stack has to be up and the Graph has to hold data before a run.

```bash
docker compose up -d                       # engine · studio · postgres · neo4j
cd engine && uv run invana loader ../demos/airways/air-routes \
  --uri bolt://localhost:7687 --username neo4j --password testpassword \
  --connector invana_neo4j.Neo4jConnector
cd studio && pnpm exec playwright install chromium   # first run only
pnpm test:e2e
```

| Command | Does |
|---|---|
| `pnpm test:e2e` | Runs the suite headless — the one CI would run |
| `pnpm test:e2e:ui` | Playwright's UI mode: pick a spec, watch it drive the browser, step through the trace, re-run on save. Use it while writing a spec or reading a failure |
| `pnpm test:e2e:report` | Opens the HTML report of the last run |

In UI mode, check the `Projects:` line under the filter box — it remembers what
was ticked last time, and with only `setup` ticked the list shows one test
(`signs in`), because every spec belongs to the `chromium` project. Expand that
row with the `›` chevron beside the filter box and tick `chromium`.

UI mode needs the full browser, not only the headless shell — `pnpm exec playwright
install chromium` installs both.

| Variable | Default | What |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:8300` | Where Studio is served |
| `E2E_GRAPH_PATH` | `/u/admin/air-routes-graph` | The Graph the specs ask against |
| `E2E_USERNAME` · `E2E_PASSWORD` | `admin` · `change_me_please` | The dev superuser `invana init` provisions |

The sign-in runs once, in the `setup` project, and every spec reuses its
`storageState`. Specs run serially: they drive one engine and one graph
database, and parallel files would race each other's sessions.

## What is covered

| Spec | Asserts |
|---|---|
| `answer-surface.spec.ts` | A result renders as a `table` emission with its citation · zero rows render as the `empty` emission and no table beside it · a `subgraph` states what it added once it lands |
| `explorer.spec.ts` | The workflow's steps paint as the run goes · a session comes back after a reload and its answer does not, which is the seam AS10 names · a rejected query is a diagnosis with no emission card beside it |

A run leaves its sessions behind in the Graph — the specs ask real questions and
nothing cleans up after them. `metric`, `chart` and `prose` are not covered: no step produces them yet, and
feeding them a fixture would test Studio against its own invention.
