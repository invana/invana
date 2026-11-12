# Spec site

A browsable site over `specs/` for the team — every spec as a page, with its mermaid diagrams and what the graph
parser (`scripts/specs/check.py --graph`) reads from it. It is team tooling: it is never published, and it copies
nothing — `docs_dir` is `specs/` itself, so a page is always the `.md` as it stands.

## Run it

Needs [uv](https://docs.astral.sh/uv/) (it fetches Python and the two packages on first run). From the repo root:

| OS | Serve on http://127.0.0.1:8000 |
|---|---|
| macOS · Linux | `uv run --project scripts/specs/site mkdocs serve -f scripts/specs/site/mkdocs.yml` |
| Windows (PowerShell or cmd) | `uv run --project scripts\specs\site mkdocs serve -f scripts\specs\site\mkdocs.yml` |

`mkdocs serve` rebuilds when a spec changes. To build the static site into `scripts/specs/site/build/` (gitignored),
use `mkdocs build --strict` in place of `mkdocs serve`. Another port: add `-a 127.0.0.1:8010`.
Set `NO_MKDOCS_2_WARNING=1` to hide Material's end-of-life notice.

## What the site adds

| Where | What |
|---|---|
| Every spec page a node is parsed from | A *Graph* section: tabs *Depends on* (its outgoing edges), *Used by* (incoming), *Gaps* (its gaps, blockers, loops, chains, dangling references, orphan flag) and *Neighbourhood* (a one-hop mermaid diagram). A page holding many nodes — `system-design.md`, `personas.md`, a `task.md` — has one collapsible block per node |
| A page at `status: placeholder` | A *Placeholder* banner under its title |
| Every page | Tags for its kind, status and personas; the *Tags* page lists them |
| `/loops/` · `/gaps/` · `/orphans/` | The parser's `analysis`, listed with links: loops and the longest chains; feature gaps, blockers and dangling references; nodes with no edge |
| Every mermaid diagram | Zoom: the `+` `−` `1:1` `⤢` buttons, Ctrl/⌘ + wheel, and drag to pan |

The page runs edge to edge. Nav is a left tree over the folders, titled from front-matter (`AC-F04 · What an agent may
touch`, never a slug): a product or feature is a section whose label opens its page, a story is one entry (its
`task.md` is linked from it), `features/` and `stories/` fold away — every section collapsible, only the open page's
branch expanded, breadcrumbs above each title; drag the tree's right edge to widen it (the width is
remembered per browser). `specs/_stale/` is left out. Search, light and dark follow the docs site's theme.

## How it is built

| File | Does |
|---|---|
| `mkdocs.yml` | Theme, markdown extensions, plugins; `docs_dir: ../../../specs` |
| `hooks.py` | Runs the parser once per build and renders the panels, banners, tags and analysis pages. The analysis is the parser's — the hook never recomputes it |
| `overrides/` | `main.html` loads `assets/spec-site.js` (diagram zoom, the nav's resize grip); `assets/spec-site.css` styles them and the edge-to-edge layout. `mkdocs serve` may not pick up an edit here — touch `mkdocs.yml` to rebuild |
| `pyproject.toml` · `uv.lock` | The site's own environment, separate from the engine and the docs |

Its tests are `scripts/specs/test_site.py` (`python3 -m unittest discover -s scripts/specs`) and, for the diagrams,
`graph/src/diagrams.test.ts`: every mermaid block in `specs/` must parse with mermaid 11, the major the site loads
(`pnpm --dir scripts/specs/site/graph exec vitest run`) — a diagram that fails shows an error box on its page while
the build stays green. The end-to-end specs, `graph/e2e/`, run over the built site (`pnpm build` in `graph/`, build
the site, then `pnpm --dir scripts/specs/site/graph exec playwright test`): the left tree and the sitemap, the graph
page and what it draws, and its telemetry against a collector routed in the browser — never a port on the machine.
