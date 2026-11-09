# Shell — what every product shares

Product spec: [Shell](../../specs/os/graph/product.md) — [AC-F01 · Sign in and start](../../specs/os/access/features/AC-F01-sign-in-account-and-sessions/feature.md) · [GR-F02 · Create a graph](../../specs/os/graph/features/GR-F02-create-a-graph/feature.md) · [GR-F03 · Find your way](../../specs/os/graph/features/GR-F03-find-your-way/feature.md). The stories, breadcrumbs, ⌘K, first run, set-up and the decisions that are still true live there. This file keeps the header, layout and Activity of the retired product shell, the CLI, and the rows not moved.

System design: [api-and-cli.md](../../specs/system-design/api-and-cli.md) — the CLI. This file keeps the CLI's build status.

## Header

| Slot | What | Rule |
|---|---|---|
| Launcher | 9-dot grid, far left | Opens the five products in path order; switching keeps the open Graph |
| Wordmark | `Invana <Product>` | Names the product; never repeated in the breadcrumbs |
| Graph picker | the open Graph, with a chevron | Opens the Graphs the person can reach; switching keeps the open product. The owner is not a level. Absent in Datasets (install-wide) |
| Breadcrumbs | levels after the Graph | See GR-09 |
| ⌘K | search or ask | Jumps to any record, model, run, schedule, or asks the assistant |
| Notifications | bell with a count | Opens the tray over the current page; *Open inbox* goes on to Activity › Inbox |
| Assistant | toggle | Highlighted while the chat is open; opens and closes the chat docked on the right. Can be switched off entirely (user menu) |
| Avatar | user menu | Assistant on/off · tools always shown · theme · Graph setup (inside a Graph) · profile. The two switches are per browser; Assistant off hides it in every product |
| Nothing else | — | No theme, fullscreen, set-up or repository buttons in the header; the theme and set-up live in the user menu |

## Layout

| Rule | Detail |
|---|---|
| Icon rails navigate | Datasets, Modeller, Projects, Agents have a left icon rail; tooltips name sections |
| Explorer has no rail | Full width; composer plus board |
| Floating toolbar acts | Vertical, top-left on every canvas (Explorer and Modeller) |
| Floating cards hold detail | Legend and inspector float; a docked panel only where editing needs room |
| Assistant docks right | `rightSection`; centred only on an empty board; closable |
| Console docks bottom | `bottomSection` under the canvas only (`bottomSpan: "main"`), resizable — the canvas's data and the session's queries. No floating panel for results |
| One footer, two zones | Every product. Left: the connection · the page's counts · the message line (a hint, progress, or what the pointer is over — plain text, last, truncated). Right: the page's readouts (selection, zoom, renderer and fps on a canvas; the version elsewhere). With a data canvas in front its counts open the console ([EX-F01](../../specs/capabilities/explore/features/EX-F01-the-board-and-its-canvas/feature.md)); elsewhere they are text. There is no middle zone |
| Artboards | 1920×1080 |

## Activity

| Tab | Holds |
|---|---|
| Inbox | What needs me across products, each with its next step |
| Approvals | Runs waiting on a person, showing exactly what will be sent |
| Runs | Every run from every product, newest first |
| Schedules | Coming up (7 days) and every schedule |
| Events | Every write; the **Changes** filter is the change log |
| Rules | Which events notify whom, on which channel |
| Ledger | Every governed act in this Graph, exportable and provably unedited |
| Channels | In app · email · Slack · webhook — used by rules and schedules |

## User stories

AF-26 is [EX-28 · The assistant opens a list](../../specs/capabilities/explore/features/EX-F03-ask-a-question/stories/EX-28-the-assistant-opens-a-list/story.md).

## CLI — build status

What each command does, and the conventions, are in [api-and-cli.md](../../specs/system-design/api-and-cli.md). This keeps where each stands.

| Command | Status |
|---|---|
| `invana start` · `migrate` · `version` · `init` | ✅ exists |
| `invana users create` · `update-password` | ✅ exists |
| `invana login --url --token` · `logout` · `whoami` | New · P-22 |
| `invana graphs list` · `create` · `show` · `archive` | New |
| `invana members list` · `add --role` · `remove` | New · P-18 |
| `invana runs list` · `show` · `log` · `cancel` | New |
| `invana runs rerun <id> --same-versions \| --current` | New · P-17 (the route ships, the command does not) |
| `invana schedules list` · `create --file` · `show` · `pause` · `resume` · `run-now` · `delete` | ✅ B08 |
| `invana approvals list` · `approve` · `decline` | ✅ B08 |
| `invana events list [--changes]` · `tail` | New · P-09 |
| `invana changes show <record>` · `compare <a> <b>` | New · P-09 |
| `invana notifications list` · `read` · `rules list` · `rules apply --file` · `channels list` · `add` · `remove` | ✅ B08 |
| `invana search "<text>"` | New · P-18 (access filter) |

`invana init` (*create the root user*) is retired — `invana users create --superuser` creates every account. The Graph role `viewer` is `operator` today. Prerequisites are in the [README](README.md#prerequisites).

## Decisions

| Decision | Detail |
|---|---|
| Run pages live in Activity | The journal, a failed run, approvals and re-run are drawn once, on Activity's run page in the Graph the run ran in. The bell, the Builder's Overview and the agent in this Graph link there |
| All Graphs | `/graphs` lists every Graph I am a member of — never one I am not: name and description, pin, database, my role, members, what it holds (or its set-up progress), last opened, and *needs you* · *set-up* · *new*. Mine · Shared with me · All, Active · Archived, database and role filters, search; *New Graph*. Pinned Graphs lead Home's Your Graphs. Drawn as `shell.graphs` |
| A detail page's head is its breadcrumb | One row in Agents, IAM and Modeller: the section's own rail icon in a tile, the section (and any parent) as links back, then the page's name, its chips and acts — `RecordHeader` with `variant="page"`, the section's `icon` (tinted by `iconTone`) and the section as a link crumb; never a second header component. The header then carries only the Graph. A page with no head of its own — a canvas, a modal flow over a list — keeps the header crumb |
| A schedule’s plan | Generated from its instructions, like a skill’s; edits regenerate and are logged |
| Roles per Graph | Viewer (ask, read) · Contributor (projects, observations, schedules) · Builder (agents, skills, evals) · Modeller (models, publish, rules, guardrails) · Owner (members, settings, approving breaking changes). A person may hold several; private projects add their own people on top |
| A shared page opens inside the product | Every shared overlay inside a Graph — Notifications, onboarding, and the launcher, ⌘K and user-menu overlays — draws inside the product it was opened from: that product's wordmark and `leftNav`, with nothing lit, and no footer of its own. Opened from Explorer it has no `leftNav`, because Explorer has none. Activity is a product of its own (below) |
| Activity is a Graph product | `/u/:user/:graph/activity/<section>[/:id]`, in the launcher's *This Graph* group, with its own rail: Runs · Approvals · Ledger │ Schedules · Events · Inbox · Rules · Channels. The bell and *Open inbox* go to its Inbox. The header keeps Notifications, which is the header’s default on every screen inside a Graph; set-up is reopened from the user menu. Off a Graph (sign in, the Graph list, first run, profile) there is no product and no `leftNav` |
| One host draws the graph products | Explorer, Modeller, Projects and Agents render one page from the app — the product host — through their slot’s `Page`, because it composes all four (the Workbook, each product’s `leftSection` panel, the assistant, the Console) and a product may not import another. It reads the open product off the route and the open panel off the path; there is no graph page of its own and no product called *Studio* |
| The tray | The bell opens a popover anchored under it, over whatever page is open — it never navigates. Two sections: **Needs you** (approvals waiting on me — a held agent step, a held delivery, a breaking publish — then runs waiting on my answer; each row says what, where and when it expires, with *Review* or *Answer*) and **Updates** (notifications, newest first, unread with a dot, product badge and age; a click goes to the target and marks it read). Header: the count of what needs me and unread, *Mark all read*. Footer: *Rules* · *Open inbox*. Empty: *Nothing needs you* with *New rule*. It reads the same three lists as the Inbox and carries the same count; the Inbox stays the full, filterable history |
| Reviewing in the tray | *Review* opens the approval inside the tray, with a back arrow: **exactly what will be sent** (the frozen payload — for `mail.send` its To, Subject and body; for a delivery the channel and message), what each choice does (*Approve* — this goes and the run carries on; *Decline* — nothing is sent, the step ends *not sent*), who asked and on whose behalf, the run and step, the approvers, the deadline as time left, an optional note. *Approve* · *Decline* appear only here, never on the list row, so nothing is approved unseen. *Open full review* goes to the run's approval page. A member not named reads it with both acts disabled, naming the approvers; a decision someone made first reads *who · when* in place of the acts (409); past the deadline it reads *expired, nothing was sent* with *Open run* |
| Answering in the tray | *Answer* goes to the run's page and closes the tray. The tray does not draw the question: the run read does not carry the clarification's text or its options, which live on the session message. `shell.notifications.tray.answer` draws the in-place answer for when it does |
| Reviewing an approval | In the Inbox, *Review* opens a dialog: the approval's title, **exactly what will be sent** (its payload — channel, recipients, the body), the approvers, the deadline as time left, an optional note, and *Approve* · *Decline*. A decided approval leaves the Inbox. Activity › Approvals as a tab of its own is SH-12's, not built here |
