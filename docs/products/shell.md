# Shell — what every product shares

Not a product. The layout and the features that appear in all five. Prototype page: *Shared › In every product*.

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Header

| Slot | What | Rule |
|---|---|---|
| Launcher | 9-dot grid, far left | Opens the five products in path order; switching keeps the open Graph |
| Wordmark | `Invana <Product>` | Names the product; never repeated in the breadcrumbs |
| Graph picker | the open Graph, with a chevron | Name → the product’s landing; chevron → switch Graph. Absent in Datasets (install-wide) |
| Breadcrumbs | levels after the Graph | See [Breadcrumbs](#breadcrumbs) |
| ⌘K | search or ask | Jumps to any record, model, run, schedule, or asks the assistant |
| Notifications | bell with a count | Opens Activity › Inbox |
| Assistant | toggle | Highlighted while the chat is open; opens and closes the chat docked on the right. Can be switched off entirely (user menu) |
| Avatar | user menu | Assistant on/off · tools always shown · theme · profile |

## Breadcrumbs

| Rule | Detail |
|---|---|
| Levels | Graph › section › item › drill-in. An install-wide product (Datasets) has no Graph: `@user` › section › item |
| Links | Every segment but the last links to its level; the last is plain |
| Tabs | Not a level — switching tabs keeps the trail |
| Overlays | ⌘K, notifications, launcher and dialogs keep the trail of the page beneath |
| Depth | More than 4 segments: first · `…` · last two; `…` opens the hidden levels |
| Long names | Truncate with an ellipsis; full name on hover |
| Back links | No in-page “← back” links; the trail is the way up |

## Layout

| Rule | Detail |
|---|---|
| Icon rails navigate | Datasets, Modeller, Projects, Agents have a left icon rail; tooltips name sections |
| Explorer has no rail | Full width; composer plus board |
| Floating toolbar acts | Vertical, top-left on every canvas (Explorer and Modeller) |
| Floating cards hold detail | Legend and inspector float; a docked panel only where editing needs room |
| Assistant docks right | `rightSection`; centred only on an empty board; closable |
| Console docks bottom | `bottomSection` under the canvas only (`bottomSpan: "main"`), resizable — rows, queries and logs. No floating panel for results |
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
| Channels | In app · email · Slack · webhook — used by rules and schedules |

## Features

| ID | Feature | Status | Stories |
|---|---|---|---|
| SH-F1 | Sign in, Graph home, set-up checklist | In Studio | SH-01 · SH-02 · SH-03 |
| SH-F2 | Launcher across five products | New | SH-04 |
| SH-F3 | Breadcrumbs with overflow | New | SH-05 |
| SH-F4 | ⌘K palette | New | SH-06 |
| SH-F5 | User menu: hide assistant, tools always shown | New | SH-07 |
| SH-F6 | Runs journal and the run page | In Studio | SH-08 · SH-09 · SH-10 · SH-11 |
| SH-F12 | Re-run on the same or current versions | New · Blocked · P-17 | SH-18 |
| SH-F13 | First run — three ways in | New | SH-19 |
| SH-F14 | Read-only without the role, acts say who can | New · Blocked · P-18 | SH-20 |
| SH-F7 | Approvals | New | SH-12 |
| SH-F8 | Schedules: instructions, generated plan, delivery, failure rules | In Studio (C05) — the generated plan waits on the engine | SH-13 |
| SH-F9 | Events and the change log, version compare | In Studio (C04) | SH-14 |
| SH-F10 | Notifications inbox, rules, channels | In Studio (C05) | SH-15 · SH-16 |
| SH-F11 | Profile and access tokens | In Studio | SH-17 |

## User stories

| ID | As a | I want | So that | Boards (walk order) |
|---|---|---|---|---|
| SH-01 | member | to sign in with a password or single sign-on | only people with access reach a Graph | `shell.login` |
| SH-02 | member | to pick a Graph from the ones I can open | I start where my work is | `shell.graphs` |
| SH-03 | member with a new Graph | a checklist of what is left to set up | I know what opens each product | `shell.onboarding` |
| SH-04 | anyone | to switch product from the launcher and keep the open Graph | I change job without losing my place | `shell.launcher.open` |
| SH-05 | anyone | breadcrumbs that show where I am and step back a level | I never get lost in deep pages | `shell.breadcrumbs.overflow` |
| SH-06 | anyone | ⌘K to jump to any record, model, run or schedule, or ask | I reach anything without the nav | `shell.command_palette` |
| SH-07 | anyone | to hide the assistant or keep tools always shown | the product works my way | `shell.user_menu` |
| SH-08 | anyone | every run from every product in one journal | I see what happened, wherever it started | `shell.runs` · `shell.activity.runs` |
| SH-09 | anyone | to read a run: tokens, the model version it ran on, timeline, what it touched, its log and each step | I can trust or question it | `shell.run.overview` · `shell.run.touched` · `shell.run.log` · `shell.run.step` |
| SH-10 | builder | a failed run to say which step broke and why | I fix the cause, not the symptom | `shell.run.failed` |
| SH-11 | analyst | to compare two runs of one question | I see what a world or a change did | `shell.run.compare` |
| SH-12 | approver | to see exactly what a run will send before it goes | nothing leaves without a person | `shell.activity.approvals` · `shell.run.approval` |
| SH-13 | anyone | to schedule routine work — a digest, a morning plan — with no project | routine work runs itself and lands where I read | `shell.schedules` · `shell.schedule.new` · `shell.schedule.detail` |
| SH-14 | auditor | every change to anything versioned, with its effect after, and any two versions compared | every change is accountable | `shell.activity.events` · `shell.events.changes` · `shell.change.compare` |
| SH-15 | anyone | one inbox of what needs me across products | I act on what matters first | `shell.notifications` |
| SH-16 | anyone | rules that say which events reach whom, on which channel | failures and slowdowns find the right person | `shell.notifications.rules` · `shell.notifications.rule` · `shell.notifications.channels` |
| SH-18 | anyone | to re-run a run on the exact model version it used, or on the current one | old results can be reproduced after a model upgrade | `shell.run.rerun` |
| SH-19 | first user of a new install | to be asked what I am deciding and offered three ways in | an empty install is a start, not a wall | `shell.first_run` |
| SH-20 | member without a role | to read a product and see who can act, instead of a dead end | I learn what exists and who to ask | `agents.skills.detail.readonly` |
| SH-17 | member | to manage my profile and access tokens | the CLI and API work as me | `shell.profile` · `shell.profile.tokens` |

## CLI

One binary, `invana`, for every product. Prerequisites are in the [README](README.md#prerequisites).

| Convention | Rule |
|---|---|
| Shape | `invana <noun> <verb>` — nouns are the product's records |
| Graph scope | `--graph <user>/<slug>` on anything that lives in a Graph |
| Install scope | datasets and standards are named `<publisher>/<name>[@version]` — no `--graph` |
| Output | human tables by default; `--json` on every command |
| Writes | `--dry-run` on every write; a refused write exits non-zero and prints the rule or guardrail that refused it |
| Usage | token counts only — never currency |

| Command | Does | Status |
|---|---|---|
| `invana start` · `migrate` · `version` · `init` | run the server, migrate the app DB, print the version, create the root user | ✅ exists |
| `invana users create` · `update-password` | provision accounts | ✅ exists |
| `invana login` · `logout` · `whoami` | sign the CLI in with an access token | New |
| `invana graphs list` · `create` · `show` · `archive` | Graphs you can open | New |
| `invana members list` · `add --role` · `remove` | Graph roles: viewer · contributor · builder · modeller · owner | New · P-18 |
| `invana runs list` · `show` · `log` · `cancel` | the journal across products | New |
| `invana runs rerun <id> --same-versions \| --current` | reproduce on the versions it used, or compare on current | New · P-17 |
| `invana schedules list` · `create --file` · `show` · `pause` · `resume` · `run-now` · `delete` | shared schedules, with delivery and missed-firing policy | ✅ B08 |
| `invana approvals list` · `approve` · `decline` | what waits on you | ✅ B08 |
| `invana events list [--changes]` · `tail` | every write; `--changes` is the change log | New · P-09 |
| `invana changes show <record>` · `compare <a> <b>` | a record's versions, and two of them side by side | New · P-09 |
| `invana notifications list` · `read` · `rules list` · `rules apply --file` · `channels list` · `add` · `remove` | the inbox; who hears what, on which channel | ✅ B08 |
| `invana search "<text>"` | the ⌘K search, from the terminal | New · P-18 (access filter) |

## Decisions

| Decision | Detail |
|---|---|
| Schedules are shared | A schedule needs no project; it names an agent + instructions (or a skill), a cron, delivery channels |
| A schedule’s plan | Generated from its instructions, like a skill’s; edits regenerate and are logged |
| Outward actions | Anything sent outside Invana waits for approval unless switched off per schedule |
| Change log | One more kind of event: who, when, why, the diff, the plan diff when there is one, the effect after |
| Restore | Restoring an old version makes a new version; history is never rewritten |
| Approval deadlines | Each approval names its approvers and a deadline; a reminder goes at half-time; at the deadline the run ends *expired, not sent* — never auto-approved — and the Inbox says so |
| Missed firings | Run once on recovery, marked catch-up; the rest are listed as skipped. A schedule can choose *run every missed one* or *skip* |
| Runs record their versions | Every run stores the exact model version, skill and plan revision, world and data versions it used |
| Re-run | Choose *the same versions* (reproduce) or *current versions* (compare); a run on current versions opens the comparison when it finishes |
| Tokens, never currency | Every budget, limit, usage figure and alert is in tokens |
| Search (⌘K) | Covers everything you can open — records, models and types, datasets, projects, branches, findings, agents, skills, runs, schedules — plus actions and *Ask the assistant*. Results are grouped by product and filtered by access, so private projects show only to their people |
| Search ranking | Exact and prefix matches on names and ids first, instant. When they find little, meaning-based matches fill in (vector index where the graph database has one), labelled *related*. Beyond that, *Ask the assistant* |
| Roles per Graph | Viewer (ask, read) · Contributor (projects, observations, schedules) · Builder (agents, skills, evals) · Modeller (models, publish, rules, guardrails) · Owner (members, settings, approving breaking changes). A person may hold several; private projects add their own people on top |
| Without the role | The product opens read-only: actions show disabled with the reason and who can do it. A product a role cannot even read is hidden from the launcher |
| First run | A new install asks *what are you trying to decide?* and offers three paths: connect a graph database (Modeller drafts a model) · start from data (Datasets) · try a sample Graph (airways or arabidopsis, read-only, with a starter project). Every empty state links to the step that unlocks it; the set-up checklist tracks progress |
| A shared page opens inside the product | Every shared page inside a Graph — Activity (runs, approvals, schedules, events, changes), Notifications, onboarding, and the launcher, ⌘K and user-menu overlays — draws inside the product it was opened from: that product's wordmark and `leftNav`, with nothing lit, and no footer of its own. Opened by a direct link or from ⌘K, it uses the product this browser last had open, else the run's origin. Opened from Explorer it has no `leftNav`, because Explorer has none. There is no “Activity” product |
| The Graph’s own URL | `/u/:user/:graph` opens the graph product this browser last had open, else Explorer, at that product’s landing, carrying the query string (`?right=`, `?page=`, `?onboarding=`). An old `?panel=` link resolves to its path first. The last product is a per-browser convenience; with storage blocked the Graph opens Explorer |
| Activity is the shell’s route | `/u/:user/:graph/activity/<tab>[/:run]` belongs to no product: the shell owns the page and the product host draws it in `mainSection`, inside the product as above. The header keeps the bell and the onboarding cap, which are the header’s defaults on every screen inside a Graph. Off a Graph (sign in, the Graph list, first run, profile) there is no product and no `leftNav` |
| One host draws the graph products | Explorer, Modeller, Projects and Agents render one page from the app — the product host — through their slot’s `Page`, because it composes all four (the Workbook, each product’s `leftSection` panel, the assistant, the Console) and a product may not import another. It reads the open product off the route and the open panel off the path; there is no graph page of its own and no product called *Studio* |
| What ⌘K searches today | Only lists the engine already serves, fetched once each time the palette opens and matched in the browser as you type: on a Graph, Explorer's conversations, Modeller's models, the node and edge types of its union, and its worlds, Agents' agents and skills, Projects' projects and todos, and the Graph's last 100 runs (*Activity*); everywhere, the Graphs you can open. Each product hands the shell its list through `search` on its definition. A record with no path of its own (a model, a type, a skill) opens its section. Conversations and runs carry their age beside their kind, since many share a title. The Graph's records themselves (an airport, a gene) are not searched until the engine serves a search over them |
| What ⌘K can do | Each product's rail sections and its `commands` are entries in its group, matched by label and keywords. With nothing typed, the palette lists the open product's entries |
| Ask the assistant from ⌘K | The last entry whenever something is typed on a Graph. It puts the text in the assistant's composer and focuses it — it never sends, so the person still picks the agent and the world before any tokens are spent. On a graph product the chat docks open there; on Activity it opens Explorer. Off a Graph there is no assistant, so the entry is absent |
| Related in ⌘K | A product may mark a hit `related` (matched on meaning); those go in a *Related* group below every product's names. No product returns one until the engine serves a meaning search over a vector index, so the group does not appear yet |
| ⌘K and access | Every list ⌘K reads is already scoped to what the member may open on that Graph. Hiding private projects from people outside them arrives with roles |
| The Inbox | Three kinds of row, in this order: **approvals** waiting on me (`GET …/approvals?mine=true&status=pending`, next step *Review*) · **runs waiting on my answer** (`awaiting_input` in the Graph's last 100 runs — no event says so, so it stays read off the journal; *Answer*) · **notifications** (`GET …/notifications`, newest first; unread ones marked with a dot). Failed runs reach the Inbox only through a rule — the empty state offers *New rule* to add one; the Inbox no longer derives failures from the journal, so nothing shows twice. The bell and the Inbox tab carry one count: unread notifications + approvals waiting + runs waiting. Filters: a product select (only products present) and *Unread*; *Mark all read* marks every unread notification. Opening a notification marks it read and goes to its target — a run's page, a schedule's page, or the approval's review; a notification with no target is marked read in place |
| A row's product | A run's product is read off the run: an import or bulk load is Datasets', a Todo's run Projects', a stitch Modeller's, a typed query (`ql`) Explorer's even when an agent carried it, any other run with an agent Agents', and the rest Explorer's. A notification takes its run's product when the run is among the last 100, else its target's (agent · skill · plan → Agents; model · rule · type → Modeller; project · todo → Projects; dataset · standard → Datasets). A schedule, approval, rule or channel is the shell's and carries no product badge |
| Reviewing an approval | *Review* opens a dialog: the approval's title, **exactly what will be sent** (its payload — channel, recipients, the body), the approvers, the deadline as time left, an optional note, and *Approve* · *Decline*. A decided approval leaves the Inbox. Activity › Approvals as a tab of its own is SH-12's, not built here |
| Activity › Schedules | Two cards. **Coming up** — seven day columns from today, one row per active schedule, a dot on each day its cron fires (read in the browser's zone, day by day); the dot is `--destructive` when the schedule's last firing failed. **Schedules** — every schedule: name, then *cron as words · agent · delivery · next in …*, and *failed last run* or *paused* when so; the row opens the schedule's page. *New schedule* sits on the Schedules card's header. No schedules: *Nothing is scheduled* with *New schedule* |
| New schedule | One dialog, also *Edit*: Name · **What to do** (plain instructions) · **Runs as** (an agent) · **Repeat** (Daily · Weekdays · Weekly on a day · Monthly on a date · Custom cron) and a time · **Time zone** (the browser's, or UTC) · **Deliver to** (In app, and each channel) · **If a firing is missed** (Run once on recovery · Run every missed one · Skip) · **If the last run is still going** (Skip · Run anyway) · **Outward approval** (on: *anything sent outside Invana waits for approval*). No sources, tools or project picker: sources are written in the instructions, tools are the agent's, and a schedule needs no project. A refusal (bad cron, unknown zone, missing agent or channel) shows the engine's reason in the dialog |
| A schedule's page | `/activity/schedules/<id>`, Schedules lit, crumbs *Activity › Schedules › `<name>`*. Header: name · agent · cron as words · *next in …* or *paused*; acts *Run now* · *Pause*/*Resume* · *Edit* · *Delete* (confirmed). Cards: **Instructions** · **Firings** (newest first: when it was due, outcome, *catch-up* or *run now* when so, the reason, *Open run*) · **Delivers to** (In app and each channel, on or off). There is no Plan card: the engine does not generate a plan from a schedule's instructions yet |
| Activity › Rules | The rules, one row each: name · *when* the events (and the status they match) · who hears · badges for In app and each channel · an *enabled* switch. *New rule*; a row opens the rule. No rules: *No rules yet* with *New rule* |
| A rule | One dialog, also *New rule*: Name · **When** (events from the events catalogue, grouped as in Events; a *status* condition when `run.finish` is picked — any · failed · succeeded) · **Tell** (members by name, holders of Graph roles, *whoever the run was for*) · **On** (In app, and each channel) · Delete on an existing rule. `notification_rule.*`, `channel.*`, `delivery.*` and `approval.remind` are not offered: a rule cannot feed itself. There is no metric condition (*p95 above its baseline*) and no *would have fired* preview — the engine matches events only |
| Activity › Channels | *In app* first (always on — the Inbox and the bell), then each channel: name · kind · its masked target · *ready* or why not (*email is not configured on this install*). *Add channel* (Email addresses · Slack incoming-webhook URL · Webhook URL with an optional signing secret); *Remove*, refused while a rule or schedule uses it, saying which. Microsoft Teams is listed *not connected*, with no act. Under the list: *Rules and schedules deliver through these channels* |
| Names for member ids | Rules, schedules and approvals store members by id; Studio names them from `GET …/members`, which carries each member's `user_id`. The signed-in member reads *you* |
| Acts are not pre-disabled by role | Writing a rule or channel is the owner's, a schedule a contributor's; until Studio reads roles (C07) every act shows, and a refused write shows the engine's reason |
| First run | A member with no Graph at all, or anyone at `/graphs?first-run`, sees *What are you trying to decide?* in place of the Graphs list. **Connect a graph database** opens New Graph; **Start from data** opens Datasets; **Try a sample Graph** opens airways or arabidopsis when the member can open one, and otherwise says how to load one. A member whose only Graphs are archived gets the Graphs list, not the first run: the list's *Archived* view is where they are restored. A sample Graph is not read-only until roles exist |
| Old links resolve before any page reads them | Every route on a Graph wraps its page in the shell’s `CanonicalRoute`, which sends `?panel=`, `?settings=`, `?drawer=` and a product’s bare root to their path (`panelPaths`). The redirect table stays for good; the panel keys it reads are never seen by a page |
| The Changes filter | Activity › Events carries a **Changes** chip; on, the tab is the change log at `/activity/events?filter=changes` — the events list read with `changes=true`. A change row reads *when · who · product · record vA → vB · summary · effect after · Compare*. The product badge is where the record lives: skills, agents and plans are Agents, rules and models are Modeller. Effect after is the record's history entry for that version (`effectLine`), tokens only. A first version (*created*) has nothing to compare, so its row has no Compare. A deleted record's history answers 404: its row takes the event's own name snapshot (`details.name`, a rule's `statement`, a plan's `key`), says what the event did in words (*created* · *updated* · *published*), and carries a *deleted* badge — never a raw id or an action key |
| The compare page | `/activity/changes/<kind>/<record>?a=&b=` — inside Activity, Events lit, crumbs *Activity › Changes › `<record name>`* — `<kind>:<short id>` only until the record's history is read, the full id on hover. A header (name · product › kind, the kind left out where it repeats the product as *Agents › Agents* would · by · when · why · `vA → vB`), one card per changed field with before and after side by side (text fields as their unified lines), the plan diff or the schema diff when there is one, and the effect after of each side as tiles (runs · failed · tokens per run). Two versions are picked with two selects from the record's history. It reads; restoring stays on the record's own page (change-log CL10) |
| One compare for every product | Modeller's History tab and *Compare* on a model, and the change rows, all open the shell's compare page — there is no second compare. Datasets keep their own (`/datasets/…/history/compare`), because a dataset belongs to no Graph |

## Not building

| Item | Why |
|---|---|
| A sixth “Activity” product | Shared features live in the shell |
| Per-product notification centres | One inbox, filtered by product |
| Microsoft Teams channel | Listed as “not connected”; no work planned |
