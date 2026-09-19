# Platform — module spec

How the product is built, styled, installed and run. Nothing here is a user-facing capability on its
own; everything here is why the rest can be built quickly and look like one thing.

| | |
|---|---|
| Index | [§11 · Platform](../../README.md#11--platform) |
| Features | [design-system](features/design-system.md) · [theming](features/theming.md) · [command-line](features/command-line.md) · [logging](features/logging.md) · [telemetry](features/telemetry.md) · [admin-and-health](features/admin-and-health.md) · [setup](features/setup.md) · [runtime](features/runtime.md) |
| Depends on | — |
| Depended on by | every Studio surface, every install, and — through [the runtime](features/runtime.md) — every module that runs anything |

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Design kit** | the shared component packages Studio builds from | a style guide |
| **Theme** | a named palette and density applied across the app | dark mode alone |
| **CLI** | `invana …` — install, run, migrate, import | a deployment tool |

## 2. Studio builds from the kit, never beside it

| Rule | Detail |
|---|---|
| Components come from the kit | If a component does not exist there, it is added there — not rebuilt in Studio |
| Graph rendering is one package | Studio never touches the rendering engine directly |
| A domain type in a component prop is a smell | It means the component belongs in Studio, not the kit |
| Release before consume | The kit ships, then Studio bumps. No local links in a committed manifest |
| A story per state | Empty · loading · streaming · error · dense — not one per boolean |

### Panel composition

The rules every surface follows, so screens look like one product:

| Region | Comes from |
|---|---|
| Panel shell — tab strip, header actions, pinned footer | the kit's tabbed panel |
| Stacked sections with their own collapse | the kit's panel stack |
| A field block | the form package's settings panel, flattened, with no title of its own |

| Rule | Detail |
|---|---|
| One tab strip per panel | Tabs are the panel's views; never a second row inside the body |
| A lone section needs no header | It would repeat the tab label |
| Creating lives in the header | An icon with a tooltip, the way a section header carries its own add |
| A footer bar has two jobs | A decision on what the panel shows, or a commit in an editor. Nothing else |
| Row actions live on the row | Or in the header of the panel that shows that row's detail |

## 2a. The drawn states

Hi-fi, at 1440×900, on the **Hi-fi · finance** page of the *Agents at Work Wireframes* canvas —
`claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4`. Pull them with
`python scripts/design-pull.py --page "Hi-fi · finance"`.

| Artboard | Feature | Shows |
|---|---|---|
| The finance story · every story, the screen that shows it | — | the canvas's own index: which artboard carries which story |
| CLI · the hand-off | [command-line](features/command-line.md) | `invana` at a terminal, and where it stops and Studio starts |
| Graph · settings | [design-system](features/design-system.md) | a settings surface built from the same panel skeleton as every work panel |
| All 42 | [design-system](features/design-system.md) · [theming](features/theming.md) | the shell below — every screen is the same chrome around a different middle |

## 2b. The app shell

Every hi-fi artboard is this shell. It is built once — the kit's primitives, `PanelChrome` for the
bands — and no surface restates it.

| Region | Size | Holds |
|---|---|---|
| Top bar | 38px | the product mark, the person, the Graph, live counts, the assistant toggle |
| Icon rail | 45px | one glyph per surface, dividers between groups, a badge for what is waiting |
| Work panel | 420px | a 30px tab strip, the bands below, and a 28px status line at its foot |
| Splitter | 4px | the drag handle between panel and canvas |
| Canvas | fills | a 30px canvas tab bar, the canvas, and floating legend and footer cards |
| Assistant | 330px | the thread, with the composer pinned at its foot |
| App status bar | 25px | what the canvas is doing, and the version |

Inside a work panel, the bands are the same five everywhere:

| Band | Rule |
|---|---|
| Filter | `status ▾` / `assignee ▾` chips on the left, the count on the right |
| List | a row says what it is, who has it, and what it is waiting on; the status badge holds its own column |
| Detail | the selected element, in stacked sections with 35px headers and a right-hand caption |
| Action bar | one primary, then outlines, then `Archive` / `Retire…` pushed right |
| Status line | 28px — where you are, what is running, and the shortcut |

| Rule | Detail |
|---|---|
| A selection opens a canvas | Picking a row draws its plan, its lineage, its DAG. Closing stays the tab's X |
| Nothing autosaves in an editor | An editing panel buffers, says `unsaved changes` in its status line, and commits on one Save |
| A pulsing dot means running | A static amber dot means stuck and waiting on a person. One glyph for both hides who acts next |

## 3. Theming

| Rule | Detail |
|---|---|
| Light and dark are equal | Neither is an aftertodo; both are checked before a component ships |
| Structure is square, controls are slightly round | One radius token for controls, zero elsewhere |
| Density is a theme concern | A dense inspector and an airy form use the same components at different sizes |
| Colour carries meaning once | Status colour is defined in one place and reused, never re-picked per screen |

## 4. Install and run

| Command | Does |
|---|---|
| `invana start` | Runs the engine, and Studio when bundled |
| `invana migrate` | Applies database migrations |
| `invana version` | Reports the engine version and its connector packages |
| `invana records import` | The import path — [Bring data in](../bring-data-in/spec.md) |

| Rule | Detail |
|---|---|
| Core plus connectors | The engine installs on its own; each database connector is its own package |
| One image or two | Engine and Studio ship together or separately, from the same build |
| Cross-platform by default | A contributor on any OS runs the same commands |
| Migrations are explicit | Nothing migrates itself on boot |

## 5. API conventions

One shape across every route, so a new endpoint needs no new rules.

| Convention | Detail |
|---|---|
| Versioned prefix | `/api/v1/…` |
| Graph scoping | everything about a Graph hangs off `/u/{username}/{graphSlug}/…`; user-level routes live under `/auth/…` |
| Lists are keyset-paginated | a cursor, not an offset — stable under writes |
| Streams are server-sent events | with a `?token=` fallback where a header cannot be set |
| `PUT` is full replace | `PATCH` is partial; a blank secret on `PUT` means "keep the stored one" |
| Deletes are hard, and cascade downward | there is no trash tier |
| `409` for a conflict | duplicate name, editing a published version, deleting something still referenced |
| `422` for a shape the model forbids | a property type the schema cannot hold, a cycle in dependencies |
| Errors name the thing | the field, the step, the bound — never a bare code |
| A mutation answers with `{ message, data }` | the engine writes the success sentence; Studio shows it and never composes its own |
| One gesture, one message | a gesture that fans out into several requests reports once, not once per request |
| The generated client is the contract | Studio types come from the schema; nothing is hand-typed |


## 6. Logs and traces

Two separate things, configured once each at startup.

| | Logging | Telemetry |
|---|---|---|
| What | Human- and machine-readable lines from the engine's own modules | Traces, metrics and log correlation, exported by OTLP |
| Turned on by | One call at startup, with sensible defaults | One idempotent bootstrap; off unless an endpoint is configured |
| Formats | A plain formatter for a terminal, and one JSON object per line for a collector | OTLP over gRPC |
| Overridable | A full configuration dictionary, for an integration or a deployment that needs its own | Endpoint, sampling and resource attributes |
| Dependency stance | Standard library only — no logging framework replaces `getLogger(__name__)` | Optional; the engine runs with telemetry absent |

Instrumentation sits in three layers, so nothing has to be wired per route:

| Layer | Covers |
|---|---|
| HTTP | every route: latency, status, request id |
| Database | app-state queries, with the statement tagged back to the call that made it |
| Business logic | decorated service methods — one for a span, one for a metric |

| Rule | Detail |
|---|---|
| Configure once | Not per module, and never at import time |
| Logs carry the request | A request id ties a log line to the trace and to the event record |
| Metrics are namespaced by domain | API, graph query, app-state query, model operations, generic methods |
| Telemetry is optional | With no collector configured, the engine behaves identically |
| Product metrics are not these | Latency, cost and failure rates a user reads come from the record — see the Operate module |


## 6a. Studio end-to-end tests

Playwright, in `studio/e2e/`, driving a Studio that is already running against a live engine and a
real graph database. Nothing is mocked, and a spec asserts what a reader sees rather than what a
component was called with. `studio/e2e/README.md` carries the two commands that bring the stack up.

| Rule | Detail |
|---|---|
| Real stack, real database | `docker compose up -d`, then a dataset loaded through `invana loader`. A spec that needs data says so and fails loudly without it |
| One sign-in per run | The `setup` project logs in once and saves `storageState`; specs never repeat it. Credentials come from `E2E_USERNAME` / `E2E_PASSWORD`, defaulting to the dev superuser `invana init` provisions |
| Serial by default | One engine, one Graph — parallel files would race each other's sessions |
| Addressed by role, then by seam | A control a person can name is found by its accessible name; a shape that has no name carries a `data-testid` and the fact under test as a data attribute (`data-emission-kind`) |
| First-run state is declared, not dismissed | A tutorial modal or a tour is turned off in setup. A spec never clicks through UI it is not testing |
| Few, and about behaviour | One positive and one negative per surface. A kind with no producer is not covered — feeding it a fixture would test Studio against its own invention |

Not wired into CI: the run needs the compose stack and a loaded dataset, and that job does not exist
yet.

## 7. Cross-feature decisions

| # | Decision |
|---|---|
| PL1 | Studio has no parallel component layer. Gaps are filled in the kit. |
| PL2 | Every component works in light and dark, at every density the app uses. |
| PL3 | Panel composition is a rule, not a per-screen choice. |
| PL4 | Connectors are separate packages; the core never depends on a database driver. |
| PL5 | The CLI is the entry point for anything scripted; Studio is for anything read. |
| PL6 | The generated client is the contract between engine and Studio. No hand-typed shapes. |
| PL7 | Logging is standard-library only, configured once; telemetry is optional and idempotent. |
| PL8 | Success copy belongs to the engine. A mutation returns the sentence it wants shown, and Studio does not write one beside it. |
| PL9 | The shell is built once and shared. A screen chooses its middle, never its chrome. |
| PL10 | Studio's end-to-end tests run against a live engine and a real graph database. A Studio test that mocks the engine tests the mock. |

## 8. Deliberately absent

| Not built | Because |
|---|---|
| A theme editor for end users | themes are shipped and versioned, not user-composed |
| A plugin system for Studio | the kit is the extension point |
| Deployment orchestration | an image and a command; the rest is the operator's platform |
| Per-Graph branding | one product, one look |
| A logging framework that replaces the standard logger | it breaks every `getLogger(__name__)` already in the code |
| Telemetry as a hard dependency | the engine must run with no collector in sight |
