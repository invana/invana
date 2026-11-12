# Glossary — the words a person reads

The words Studio shows, and the ones it never shows. Specs, boards and UI copy use these; acceptance criteria are
checked against *Not on screen* by `scripts/specs/check.py`. Code, the API, the CLI and developer docs keep the domain
terms in [Domain terms](#domain-terms) — the third column names the one each screen word stands for.

## On screen

### Places

| Word | Means | Domain term |
|---|---|---|
| **Graph** | The bounded domain a team curates — its connection, models, data, agents and work. Always capitalised | Graph |
| **graph database** | The Neo4j, Memgraph, JanusGraph or other database a Graph binds to | graph database |
| **Explore · Model · Projects** | The three modes of the workspace, named in the wordmark | — |
| **Records · Agents · Inbox · Settings** | What is summoned over the work, as a modal or a sheet | — |
| **This graph · Invana · You** | The three parts of Settings: the open Graph, the install, the person's own account | Graph settings · install settings · profile |
| **Board** | A named, saved working surface — drawn on a canvas, or a dashboard of panels | Board (`renders: canvas · declared`) |
| **canvas** | The pannable drawing of nodes and relationships on a board | canvas |
| **Assistant** | The one conversational surface, on the right of every mode | Assistant |
| **Console** | The rows behind a drawing, and the query that drew them, under the canvas | Console |

### Data and models

| Word | Means | Domain term |
|---|---|---|
| **Model** | The kinds of node and relationship a Graph holds, and their properties | Domain model |
| **Kind** | One type of node or relationship in a model | node type · edge type |
| **Draft** | Unpublished changes; a floating bar says how many | Draft |
| **Publish** | Make a draft the model everyone asks against | Publish |
| **Link between models** | A declared meeting of two models — the same entity, or a relationship across them | Stitch · anchor · relationship link |
| **Constraint** | One property's range with a unit, or one standard's values, on one kind — Reject or Flag for review when a record breaks it | Property constraint (validation rule) |
| **What the database holds** | The kinds, properties and counts read from the graph database, with when — compared with the model, never the model | Physical mirror · introspection |
| **Records** | The Graph's nodes and relationships, each one of a kind in a published model; *Records* lists them by kind; only structured rows that fit a kind become records | Instance — node · relationship |
| **Version** | One immutable, hashed state of a model, standard, skill or agent | Version |
| **Sensitivity** | public · internal · confidential · personal — on a property of a kind | Sensitivity |
| **Undone** | A load a person took back: its records removed, the load kept, and everything citing it flagged | Undo a load |
| **Standard** | A shared, versioned set of terms, allowed values and required fields a kind or property is held to | Standard |
| **Checks** | How a load's records score against the constraints and standards their model holds them to, with what breaks them | Conformance · validation report |
| **Meaning** | A tab on a kind: what the kind and each property mean — definitions, synonyms, units, and the outside terms they are the same as | Meaning · IRI · sameAs |
| **Broader kind** | A kind another kind is a narrower case of — for meaning only; records and questions stay on the kind itself | Taxonomy · subclass |
| **Derivation** | A rule that adds facts from facts already in the Graph | Derivation rule · inference |
| **Derived** | A fact a derivation added, or a simulation's result — never an observation; it shows its rule and premises in *How it got here* | Derived fact |
| **Change log** | Every version of a record — who, when, why, the difference, the effect after | Change log |
| **Load** | One bringing-in of records into one model — by upload, the CLI or the API; a run, each record checked and reported, with a stable id, its file's hash and its licence; what cites it is flagged if it is undone | Load · import run · `kind = import` |
| **Bulk load** | A load that writes without checking and keeps no provenance, listed among loads as such | `invana loader` · `kind = bulk` |
| **What was rejected** | The records a load refused, grouped by reason, each naming its field | Validation report |
| **Provenance** | Where each value came from: the load, edit, person or agent that wrote it, and when — and the file and run behind it | Provenance stamps |

### What may happen

| Word | Means | Domain term |
|---|---|---|
| **A view of the graph** | What agents may see when answering — picked per question, compared, shared by name | World (a named lens) |
| **Rule** | A statement that must always hold — on the install, a Graph or a project — checked block · warn · report | Rule · guardrail · invariant |
| **Request** | What a person or an agent asked of the model — a rule refused it, the Graph could not answer it, or *Ask for a change* — kept until someone who can shape the model allows, drafts or declines it | Request |
| **Retune** | Narrow or widen the view of the graph from a run, then ask again | Retune |
| **What it may do** | The functions an agent or plan may run, with what arguments, each with its mode | Envelope |
| **Access rule** | Who may do what, as sentences: *Can ask*, *Can change data* | Policy |
| **Allow · Ask · Deny** | The value on every line of an access rule, for people, agents and keys alike — it acts · it waits for a yes in the Inbox · it is refused, naming the line and who set it. What no line reaches is denied; where lines disagree, the strictest wins. Set only by a person, by hand on an item or on a rule's line | Mode · permission |
| **Asks first** | An act a line sets to Ask — a person's or an agent's — waits in the Inbox, showing exactly what it will do, for someone who holds Allow on it | Approval |
| **Token budget** | The tokens an agent, schedule or eval set may spend in a period — never currency | Budget |
| **Workers · runs at once** | The machines that run work, and how many runs a Graph may have going | Pool · lane · worker |
| **Worker group · Join key** | Workers that share labels and run the same kinds of step · the key a new worker joins a group with, shown once | Worker pool · join token |
| **Coordinator** | The engine service that hands a run's steps to workers; a lost one's runs move on | Orchestrator |

### People and access

| Word | Means | Domain term |
|---|---|---|
| **Admin** | The person who runs the install | `is_superuser` |
| **Operator** | A member who can look and ask | Graph role `operator` ([GR-F04 › Mechanisms](os/graph/features/GR-F04-this-graph/feature.md#mechanisms)) |
| **Can work on projects** | Projects, tasks, findings, decisions | `contributor` |
| **Can build agents** | Agents, skills, tests, plans, templates | `builder` |
| **Can shape the model** | Models, links between models, rules, views of the graph, loading data | `modeller` |
| **Owner** | The Graph's settings, connection and AI providers, and the three grants above | `owner` |
| **Can manage people** | Members, groups, access rules, other people's keys | `iam-admin` |
| **Member** | A person or an agent with access to a Graph | Member · agent binding |
| **Key** | A long-lived credential a member mints for themselves, or for a service account; it acts as its holder, may be narrowed, expires, and is shown once | Personal access token |
| **Built in · Custom · A person's own · A key's own · An agent's own · For everyone** | The kinds of access rule: the six grants, with their starting lines shown · one written here · one that narrows a single person · one that narrows a single key · one that narrows a single agent, from its sheet · the most anyone in the Graph may do, held without being given | Managed · custom · inline · boundary policy |
| **Who holds it** | The people, groups, agents and keys an access rule reaches, and how — directly, via a group, for a run | Held by · attachments |
| **Who it changes** | Before an access rule is saved: who gains, who loses, which skills would break | Impact |
| **What it can do** | What an agent may actually do once every check is applied, with why not for each refusal | Effective access |
| **Can someone do this?** | A check of whether a person, agent or key may do something to something, and which check decides; nothing runs | Test access |
| **Service account** | A member with no sign-in that owns keys for scripts; its keys start marked *agent-operated*, held to the rules agents are | Service account |
| **Group** | People and agents in one Graph that hold access rules together | Group |
| **Sign out here · Sign out everywhere** | End this device's session · every session of the account | Revoke refresh token(s) |

### Asking and agents

| Word | Means | Domain term |
|---|---|---|
| **Conversation** | A named thread of questions to the assistant | Session |
| **Answer** | What a question produced: words with citations, a drawing, a table, a chart | Emissions |
| **Why?** | The peek behind a citation: words → query → records → load | Reasoning trace |
| **How it got here** | An agent result's steps, sources and assumptions, each marked *Challenge this* | Trace · run frames |
| **Cannot answer** | The Graph does not hold it — said plainly, with who can help; never a failure | Cannot answer |
| **Third-party** | From beyond the Graph — the internet, an outside service, the model's own knowledge — always with its reference | Third party |
| **Search provider** | A web search service a Graph adds, each an address a rule can name | Search provider |
| **Act as · approach** | A method picked for one question — a scientist, a designer — with the assumptions it brings, shown before the run | Stance |
| **Assumptions** | What an answer rests on that the Graph did not prove: proven · assumed · refused, each with what changes without it | Assumption ledger |
| **Fork from here** | A new conversation from one reply, with the turns and the board as they stood there | Fork a session |
| **Recall** | A run's step that reads prior records in the Graph and cites them | Recall step |
| **Evidence** | What runs show about a skill, plan, rule or criterion — counts over a stated window, each opening its runs | Evidence |
| **Suggested change** | A new version of a skill, plan, rule, criterion or template, with its evidence, waiting for a person in *Needs you* | Proposal (memory) |
| **Annotation** | What a person or the assistant says about records, kept with the Graph | Annotation |
| **Walkthrough · Presenting** | A board's answers replayed one step at a time; presenting is its read-only mode | Walkthrough |
| **Agent** | A colleague that takes work, answers in threads and acts only as far as a person allows | Agent |
| **Skill** | A playbook an agent may be offered, written as instructions | Skill |
| **Function** | One operation a plan may call, from a plugin; read-only in Studio | Function (`namespace.verb`) |
| **Plan · its steps** | How an agent carries work out, generated from instructions or packaged | Flow · Task |
| **Run** | One execution of a plan, with its time and tokens | TaskRun |
| **Voice** | Who an agent is and how it speaks, in plain words, read only by the steps whose words a person reads | Soul · voice dials |
| **Effort** | How hard an agent tries before it stops — steps, replans, questions back | Effort |
| **Helper** | An agent another agent makes for one piece of work, inside that agent's bounds; it retires when the work closes | Ephemeral child agent · spawn |
| **Outside agent** | An agent outside Invana, added by its agent card, that an agent may hand a task to | Remote agent · A2A |
| **May delegate to** | The agents an agent may hand work to — Allow · Ask · Deny for each | `may_delegate` |
| **Evals** | Fixed questions with checks, replayed before a skill or agent is published | Eval set |
| **Model version** | A provider's exact model name, pinned by an agent or skill | Pin |
| **Schedule** | An agent and instructions on a cron, with where the result goes | [Schedule](#projects-and-schedules) |
| **AI models** | The LLM providers and model versions the install offers | LLM providers |
| **Plugin** | A versioned package of functions, skills and plans an Admin enables | Plugin |
| **MCP server** | An outside server whose tools agents may call as functions, frozen as an Admin saw them | MCP plugin |
| **This graph's MCP server · Served** | The Graph's own endpoint for Claude Code and other callers · an agent or function a builder lets callers reach | MCP server · `mcp_served` |
| **Withdrawn** | A model version something still pins that the install has stopped offering | `no longer offered` status |
| **Packaged · generated · promoted** | Where a plan comes from: shipped with Invana or a plugin · written for one piece of work · kept from a run that served | Flow origin |
| **Promote this plan** | Keep a plan a run wrote and that served, as a reusable plan named by what it is for | Promote |
| **Run a plan · Dry run** | Start a published plan by name with its arguments · check it and project its tokens without starting a run | Start by key · dry run |
| **What it touches** | A function's bound: reads the graph · writes the graph · changes the model · brings data in · calls a model · hands out work · reaches outside · nothing outside | Bound |
| **Offered · applied · the gap** | A skill given to a step · the step reported using it · offered less applied, per version | Offered · applied |
| **Too few to read · No data yet** | A count below the floor that makes it readable · a skill nothing was offered — neither is a zero | Enough to read |
| **Functions it needs** | The functions a skill's plan calls — declared, never granted | Needs |
| **Draw this · Redraw** | Draw a skill's plan from its instructions, as written | Draw |
| **A person does this** | A step of a plan no function can do | Human task |
| **When things go wrong · Exceptions · Adopt** | The section of instructions whose lines guard steps · what runs met and how they handled it · write a handler runs keep improvising into the draft | Handler |
| **Test run** | A real run marked *test*, paid from the eval token budget | Test run |
| **Hard check · Judged score** | A counted check that blocks publishing · a rubric score from another model version that only warns | Check · judge |
| **Promote to eval** | Turn a run's answer into a passing or failing eval case | Eval case |
| **Tools they call** | The functions skills call, listed by where they come from — a plugin or a library | Catalogue |

### Work

| Word | Means | Domain term |
|---|---|---|
| **Project** | A piece of work inside a Graph; experimental | [Project](#projects-and-schedules) |
| **Task** | One piece of work a person or an agent takes, as an issue thread | Todo |
| **Project type** | What a project is deciding, and so its words inside the project: `research` (Study · Task) · `investigation` (Case · Action) · `policy` · `general` (Project · Task). It relabels Project, Task, Branch, Finding and Decision inside a project only and carries defaults — rules, suggested agents and skills, a report template. Types come built in or from a Domain pack; never authored in Studio. |
| **Branch** | A line of inquiry in a project; forked, merged, parked or dropped | [Branch](#projects-and-schedules) |
| **Finding** | Evidence on a branch that supports, contradicts or gives context | [Finding](#projects-and-schedules) · stance |
| **Verdict · decision** | Whether a branch held up, and what to do: pursue · park · drop · merge | Project decision |
| **Proposal** | An agent's suggested fork or decision, which a person accepts or rejects | [Project proposal](#projects-and-schedules) |
| **Report** | A project written up from its records and published as frozen versions | Project report |
| **Simulation** | A simulator run on a branch over pinned loads — always labelled derived | [Simulation](#projects-and-schedules) |
| **Impact** | What a branch's option reaches over the graph, hop by hop | Impact |
| **Objective · criterion** | A project's goal as one statement · how *done* is checked — by a query, an agent or a person | Objective · criterion |
| **Met · unmet · needs a person** | A criterion's outcome on a result; *needs a person* when its check could not run | Criterion outcome |
| **Accept · Send back** | A person closes a task on its result · reopens it, the note on the failing criterion | Accept · reject |
| **A pass to judge · Good enough · Go again** | A loop's pass waiting on a person · settle it · run another, the note its input | Verdict (runtime) |
| **Pick-up · Allow · Ask · Deny** | How agents take a project's tasks — the mode for starting one: on their own, where a person set and confirmed it · asking a person first · only when assigned | Pick-up mode |
| **Claimed** | A task an agent has taken by pick-up, for a while; a lapsed claim returns it | Claim |
| **Order** | A project's tab of its tasks in waves, by what each waits on | Plan canvas |
| **Open · Assigned · In progress · Needs input · Blocked · In review · Done · Failed · Cancelled** | A task's state, read off its latest run; only the last three are written, by a person | Todo status (derived) |
| **Needs you · Running · History** | The Inbox's three parts: what waits on the person, what runs, what people and agents did | Approvals and notifications · runs · ledger and events |
| **Updates** | The notifications a rule sent the person, in the Inbox beside Needs you; they never toast | Notification |
| **Done** | The Inbox's runs that ended today, beside Running | Settled runs |
| **Send it · Not this time · Allow · Decline · Allow always · Decline for N days** | The acts on an ask: a send · access, budget or a delegation · a delegation for good · an ask for more, kept from coming back for up to 90 days | Approve · decline · scope always |
| **Expired, not sent** | An ask nobody decided by its deadline, or whose run ended; nothing it held went | Expired approval |
| **Notification rule · History alert** | Which events reach whom, in the Inbox and on which channels · which acts in History tell whom, in the Inbox | [Notification rule](#projects-and-schedules) · alert rule |
| **Channel** | Where a notification leaves Invana — email, Slack or a webhook; *In app* is the Inbox, not a channel | Notification channel |
| **Changes · Compare · Effect after** | History narrowed to new versions · two versions side by side · the runs, failures and tokens on a version | Change log · compare · effect |
| **Experimental** | Shown and labelled, not launched | — |

## Not on screen

| Not on screen | Say instead |
|---|---|
| Modeller · Agent Builder · Fleet · IAM · Activity · Graph settings | Model · Agents · Settings › Workers · Settings › People and access · Inbox · Settings › This graph — product names are never places |
| Access policy · policy statement · policy effect | Access rule · *Can ask*, *Can change data* — *Policy* is shown only as a project type |
| viewer · contributor · iam-admin | *Operator* · *Can work on projects* · *Can manage people* |
| World | A view of the graph |
| Guardrail · invariant | A rule (*must always hold*) |
| Envelope | *What it may do* |
| Ledger | History (*what people and agents did*) |
| Pool · lane · worker-seconds | Workers · *runs at once* |
| Stitch | Link between models |
| Binding · dataset · dataset version | A load |
| Semantics · taxonomy | Model · *Meaning* · *Broader kind* — *ontology* too, except in *From an ontology*, which names an outside file |
| Task plan · frontier · step envelope | Its steps |
| TaskRun · Todo | Run · Task |
| Thought · Emission | Question · Answer |
| Mission · Atlas | Graph |
| Job · job run | Run |
| Wizard · setup wizard | *Create a graph*, in steps |
| Graph admin | Owner · Can manage people |
| Personal access token · access key · API key | Key |

## Domain terms

The words code, the API, the CLI and developer docs keep — the right-hand column of the tables above names the one
each screen word stands for. Engine and Studio names follow these; a person never reads them unless the table above
puts them on screen.

### How a feature is named

**A feature is named for what a person does. A term is named for what the thing is.**

| Rule | |
|---|---|
| The name is a **verb phrase** | *Author an agent* · *Bring data in* · *Offer a skill to an agent* · *Promote a plan*. If it reads as a noun, it is probably the table |
| Or a **plain statement of the moment** | *When it cannot answer* · *Inspect what landed* · *How many run at once* — a situation a person is in, not an object |
| The **object keeps its noun here** | Envelope, budget, binding, lineage, library, projection, emission are real things with precise meanings. They live in this part and in the code; they are not what a feature is *called* |
| A **defined term may keep its name** | Where the noun *is* the concept and renaming it would cost precision — `Rules`, `Projections`, `Delegation`. Plainness never buys vagueness |

### How a package is named

**Every part of Invana is one package, with one name from its spec folder to its boards.** The operating system's
parts are `graphs` · `access` · `runtime`; the capabilities are `semantics` · `records` · `agents` · `explore` ·
`projects`. The names and the form each takes in every layer are
[System design § 8 › One name across layers](system-design.md#8-apis-and-events) — the only source.

| Rule | |
|---|---|
| A **package** is named for the part, a **feature** for what a person does | `access` holds *Sign in*; `records` holds *Bring records in*. A verb phrase is a feature's register, never a package's |

### The container and what it holds

| Term | Means |
|---|---|
| **Graph** | The bounded domain and the reasoning boundary. An agent never crosses it. One Graph binds to exactly one graph database. |
| **Graph settings** | The open Graph's own settings — **General** · **Connection** · **Members** (people and agents) · **Usage** — part of Graph (`graphs`), shown as *Settings › This graph*. [GR-F04](os/graph/features/GR-F04-this-graph/feature.md) |
| **Install settings** | The install's configuration, off any Graph — each Graph's limits, AI models, plugins, MCP servers and outside agents — shown as *Settings › Invana*. Limits, models and plugins are Runtime's (`runtime`); outside agents are Agents' (`agents`) |
| **Operating system** | What runs every install: Graph · Access · Runtime — the packages `graphs` · `access` · `runtime`. A vision and docs word; in code its parts are packages beside the capabilities |
| **Capability** | The level under a pillar — what a person works in: Semantics · Records · Agents · Explore · Projects, the packages `semantics` · `records` · `agents` · `explore` · `projects`. In Studio Semantics is the **Model** mode and Records the **Records** summoner. The word in prose and docs; in the spec tooling its synonym is **product** — `product.md`, the `product:` key — and those files keep their names |
| **Worker pool** | The install's workers, in groups that share labels — Runtime (`runtime`), [RT-F03](os/runtime/features/RT-F03-workers-and-the-queue/feature.md). On screen *Workers*. How each agent is doing is Agents' (`agents`), never the pool's |
| **Rule** | One statement that is always true, scoped `install`, `graph` (an **invariant**) or `project` (a **working** rule). Offered to steps; a rule with a **check** is also enforced `block · warn · report` at the acts the check names. |
| **Library** | The **definitions** a run is built from: reusable **flows**, the closed **catalogue** of functions, and projection **templates**. One `leftNav` item, three sections. Never the journal — that is **Runs**. |
| **Skill** | A playbook an agent may be offered — named, described, with a "when to use". Offered, never forced. On disk it is an **Agent Skills folder** — `SKILL.md` plus `references/`, `scripts/`, `assets/` — stored whole per version, and it is the source. It runs **planned** — drawn into a plan before anything runs, the plan a cache compiled from its text, never edited or exported — or **guided**, with no plan, the model following its instructions with the functions its agent may use. |
| **Versioned record** | A record whose published form is immutable, so a change mints a new **version**: a skill, a rule, a plan, an agent, a model, a standard. A draft is not a version. |
| **Change log** | Every version of every versioned record — who, when, why, the diff, the effect after. It is the Events list narrowed to the events that mint a version, never a second record. A **change** is one such event. Never "audit log" for this narrower list, never "revision history". |
| **Instructions** | A skill's or agent's `instructions.md` — the prose a person writes and owns. A flow is generated from it; nobody draws one. |
| **Packaged flow** | A flow that ships with Invana or a plugin, `origin = packaged`: seeded, read-only; the list is [AG-F06 › Rules](capabilities/agents/features/AG-F06-plans-and-functions/feature.md#rules). The other two origins are `generated` and `promoted`. On screen, *Packaged plans*. |
| **Eval set** | A skill's or agent's fixed questions, each with **checks**: rule checks are hard and counted; a **judged** score comes from a pinned judge model and is labelled, never mixed with them. |
| **Pin** | An exact model version name an agent, skill version or judge thinks with — `claude-opus-5-5`, never an alias. Moving one is a change. |
| **Graph connector** | The package that speaks to one graph database — `invana-neo4j`, `invana-janusgraph`. Always qualified. |
| **Setup** | The *sequence* a Graph walks from created to answering — four required steps and two optional ones, derived from facts and never ticked. [GR-F02](os/graph/features/GR-F02-create-a-graph/feature.md) |
| **Onboarding wizard** | The *surface* that walks it: the stepper and the selected step's lesson, on the graph page. Reopened any time from the graduation cap in `header.right`. Setup is the state; the onboarding wizard is where you walk it. Never "the setup wizard", never "the tour", never "onboarding flow" |
| **Setup step** | One of them. `done · next · todo · blocked · skipped · broken`. |
| **Gate** | A group of setup steps, named for what it unlocks: **Connected** · **Grounded** · **Answering**. |
| **Ready** | A Graph whose required setup steps are done. It can be asked a question. The word in the UI is **ready** — never "graduated", "complete", "live" or "onboarded". *Graduation* is the onboarding cap's metaphor and nothing else: it names no state, no badge and no API field |
| **Team** | A Graph's members and its bound agents, shown together in New Graph's *Team* step. A surface word: a person's membership holds Graph roles; an agent's membership holds none — what it may do is its access rules ([GR-F04 › Decisions](os/graph/features/GR-F04-this-graph/feature.md#decisions)). |
| **Graph role** | What a member may change: `operator` (ask) · `contributor` (projects, tasks) · `builder` (agents, skills, evals) · `modeller` (models, rules, guardrails) · `owner` (members, settings). A member holds a set; `owner` implies the rest. In UI copy *role* alone is fine; in code it is `GraphRole`, because a run's `role` is another thing. |
| **Install Admin** | The person who administers the install — install rules, standards, Domain packs. `is_superuser` in code. Never a way into a Graph. |

### Models and data

| Term | Means |
|---|---|
| **Domain model** | A model authored against a domain, not a Graph — so it exports, imports and upgrades. One published version at a time. |
| **Publish review** | What a **breaking** publish goes through: a preview **migration run**, then another owner's **approval**, then the migration run that publishes. An **additive** change publishes without one. Breaking means removed or narrowed, never added. |
| **Migration run** | The run a publish review is: `model-migration@1`. Previewing, it counts what a breaking change touches and which records would fail; applied, it publishes the version and lists the records that fail. **It never rewrites a record.** |
| **Anchor** | A declared link saying two types are the same entity (`Publisher.code ≡ Sponsor.publisher_code`), resolved by a key on each side. It links; it never merges. |
| **Relationship link** | A declared cross-model edge type (`Article -[MENTIONS]-> Drug`). Its endpoints come from a key on each side *or* from a load — never both. Never inferred. |
| **Global model** | The read-time union of every published model plus its links. Derived, never stored, never edited. The **widest** grounding context — what a run sees when no lens narrows it. |
| **Lens** | What a run may **see**, **use** and **send** — pinned for one run and frozen onto it. It narrows **five layers**: `graph data` (model versions, stitches, and slices of them), `llm` (which models, bound to roles by a **cast**), `third party` (apps, APIs, databases, peer agents — and what may be sent to each), `cache` and `human`. One record with two jobs, told apart by `kind`: a **guardrail** is pinned on the Graph or an agent and always in force; a **world** is named and picked per question. Naming an unnamed lens is what shares it. Never "scope" — `rules.scope` is a different thing; never "ground" — *Grounded* is a setup gate. |
| **World** | A **named** Lens — a reusable narrowing people pick per question and compare. Never a *subgraph* ([Words code and docs do not use](#words-code-and-docs-do-not-use)). |
| **Guardrail** | A Lens pinned on the Graph or an agent, always in force, on its own surface. A world narrows it and can never widen it. Not a permission on a person. |
| **Layer** | One of five classes of participant a run may engage. Never a **lane**, which is one parallel element of a fan-out. |
| **Participant** | One named member of a layer, addressed `<layer>/<sublayer>/<name>` — `llm/anthropic-prod/claude-opus-5`. |
| **Cast** | The binding of a plan's **role** (`extract` · `decide` · `judge` · `embed`) to a model address. A resolution, not a bound — the rules are what narrow. |
| **Touch** | One recorded engagement with a participant: address, direction, volume, and what was sent. Not a log line. |
| **Stitch** | A link between models: declaring that two published models meet, and the Studio surface that holds them — a section in the Model view panel. An anchor and a relationship link are the two kinds. **Committing a link writes its relationships, marked with the link; removing it withdraws what it wrote.** A [lens](#models-and-data) that denies a link leaves it unresolved for the run and its relationships unread. The `stitch` *step inside an import* is a different act — it writes edges as records, and only a rule on the load narrows them ([SE-F09 › Engine](capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md#engine), [SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md)). |
| **Physical** | The introspected mirror of what the database actually holds. |
| **Query shape** | A query with its literal values replaced by parameters — a thousand calls of one generated query are one shape. What the model page's Performance tab groups by. Not a saved query. |
| **Records** | Externally produced data, conforming to exactly one model, handed to Invana. They are the model's — there is no record between the model and its data. |
| **Load** | One bringing-in of records into one model, by upload, the CLI or the API — the citable anchor: a stable id, the file's content hash, a licence, the run that wrote it. Exported with its provenance; undoing it removes its records, keeps the load and flags what cites it. [RC-F02](capabilities/records/features/RC-F02-bring-records-in/feature.md) |
| **Derived fact** | A fact a derivation added by inference, stored as a record labelled `derived` with its rule and premises; written back to the graph database only where the rule opts in. [SE-F08](capabilities/semantics/features/SE-F08-inference/feature.md) |
| **Domain pack** | A plugin of kind `pack` bundling a model starter, meaning, taxonomies, standards, rules, agents and skills, and project types with report templates; each piece stays owned by Semantics, Agents or Projects. [RT-F02](os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md) |
| **Standard** | A versioned, install-wide set of terms, each with a type, whether it is required, and its allowed values; a pack or org-authored. A kind or property **is held to** one pinned version. |
| **Conformance** | A load's score against the standards its model's kinds are held to — conforming records over all — with its violations. |
| **Semantic import** | Reading a published vocabulary or ontology (JSON-LD, Turtle, RDF/XML) into Invana's own records: a **SKOS** concept scheme becomes a standard, an **RDFS/OWL** ontology becomes a draft model. Never a load of records — that is an **import run**. |
| **Import report** | What a semantic import says back: what mapped, what was **skipped and why**, the notes (broader kinds kept as meaning, merged ranges) and, for an ontology, the stitch **suggestions** a person confirms. The preview and the real import return the same one. |
| **Source IRI** | The IRI a standard's term or value, or a model's type or property, was imported from. Kept on the record; never its identity. |
| **Import run** | One load into a model — a **TaskRun** of a Flow with `kind = import`. It inherits the runtime, trace, retries and failure vocabulary. |
| **Bulk run** | One `invana loader` load — a TaskRun of a `kind = bulk` flow with a single `graph.write.bulk` Task. Validated per record and traceable to a source record is what an **import** is; a bulk run is neither, and the kind is what says so. |
| **Bundle** | A folder of files that belong together, with `stitches.json` naming them and the rules between them. Loading one is a flow, not a new kind. |
| **Validation report** | Per-record accept/reject with reasons. Rejects are never silent. |

### Asking and answering

| Term | Means |
|---|---|
| **Todo** | What a person wrote — the only thing a user authors; defined in [Projects and schedules](#projects-and-schedules) |
| **Flow** | A flow of Tasks — the thing that carries a Todo out. The record is `Flow` (table `flows`, route `/flows`). Three origins: `generated` · `packaged` · `promoted`. A **reusable** flow (`reusable = true`) is one the library lists and a run may select; there is no separate *workflow*. On screen a listed flow is a **plan** (*Packaged plans*, *Plan · route-audit r9*) and its drawing is its **Flow** tab. |
| **Task** | One node inside a Flow: `callable` · `composite` · `human`. **Never a thing a user authors** — a Task cannot exist outside a flow. Users see *step*; the record is a `Task`. Its `key` is a plain identifier — by default its function with dots as underscores (`nl_translate`) — and is what `${steps.<key>.<output>}` binds against. |
| **Function** | One operation a Task may call, from a plugin, named **`namespace.verb`** — `graph.read.query`, `nl.translate`, `web.read_url`. A Task names it as `step_key`. One bound per function. **Install-wide and read-only**: code from a plugin an install Admin enables, or from a **library** whose proposed functions an install Admin approves — never authored or edited in Studio or copied into a Graph; skills use them, and builders read them. |
| **Step** | A Task in the role of a child — the authoring format writes `steps:`. A role, not a second record. |
| **TaskRun** | One execution. Its `role` says what the execution is for: `execute` · `plan` · `evaluate`. A delegated child is a TaskRun carrying `parent_run_id`. The word is now literal — a run is a TaskRun. |
| **Kind** | What a Flow is *about*: `ask · import · bulk · stitch · model · enrich`. The subject, and what the journal filters on. Never *how* it executes — that is `form` on a Task — and never *what the run is for* — that is `role`. |
| **Catalogue** (of functions) | Engine word — `runtime/catalogue`, `GET …/catalogue/{step_key}` — for the closed set of **functions** a flow may name by `step_key`; in product copy it is just *Functions*. In the product, *Agents catalogue* is the install's agents and skills. The set is grouped by the bound each spends. Closed is the point: a planner that could invent a callable could escape any ceiling. |
| **Template** | Ask's answer template — a versioned, person-authored definition of how one shape of answer is drawn, mapping only fields that exist. Five ship; a builder adds a Graph's own ([EX-F04](capabilities/explore/features/EX-F04-the-answer/feature.md)). Never a Studio folder: that is `projections/` |
| **Chain** | A run and every run delegated beneath it. It shows its worst outcome and adds up its tokens ([AG-F03](capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md)) |
| **Emission** | One thing a step produced — a subgraph, table, metric, chart or prose block. An answer is its emissions. |
| **Run frame** | One frame of a TaskRun's stream: a Task transition, a reasoning line, an emission arriving. `TaskStream` is the log of them, and its `seq` is the resume cursor. |
| **Session** | A named thread of asks, assigned to an agent. It references Todos; it is not one — a conversation never runs and has no outcome. |
| **Clarification** | A pause *inside* a Task: the agent does not know something and asks, with options. Its answer is an **answer**. A `role=plan` run raises one rather than guessing an ambiguous instruction. |
| **Approval** | A pause *before* a Task is dispatched: the agent may not proceed alone. Its answer is a **decision** — approve · reject. Nothing has been spent, and **only a person may answer one**. The same record holds anything about to leave Invana — a schedule's delivery to a channel — until a **named approver** decides; at its deadline it is *expired, not sent*, never approved. |
| **Verdict** | A pause *after* a pass produced output: the agent may not judge its own work. Its answer is a **verdict** — accept · revise, with a note bound into the next pass. The pass is already paid for, so it is bounded by `max_iterations` **and** a deadline. |
| **Iteration** | One serial pass of a `loop` node. Distinct from a **lane** (one parallel element of a fan-out) and an **attempt** (one retry of a failure). All three nest, and each is its own row. |
| **Cannot answer** | The graph does not hold it. Deliberately not answer-shaped, and distinct from a failure — and distinct from **outside the lens**, which names a setting the user can widen. |
| **Lens** | See [Models and data](#models-and-data). What a run may **see**, as an envelope is what it may **do**. |
| **Diagnosis** | What a failure explains about itself, with next steps drawn from evidence — never invented. |
| **Enrich** | A run that writes derived properties or edges onto the graph. Distinct from a **stitch**, which declares that two published models meet and writes only the relationships of its links. |

### Working surfaces

| Term | Means |
|---|---|
| **Board** | A named, saved, versioned working surface. One flat `kind` axis — six drawn and twelve declared, listed once in [EX-F01 › Mechanisms](capabilities/explore/features/EX-F01-the-board-and-its-canvas/feature.md#mechanisms). Whether it is *drawn* (on a canvas) or *declared* (panels bound to one record) is **`renders`**, a property of the kind — never a second column. The **plan** and **workflow** kinds both draw a `Flow` — one for a Project's Todos, one for a flow's Tasks. Never "artboard". |
| **Report** | A **frozen** declared board — the panels with the numbers as they were, stored merged so it outlives its subject. One version of a board, not a kind of its own. |
| **View panel** | The content of one shell region — `ModelViewPanel`, `InspectorViewPanel`, `AssistantViewPanel` — canvas-ui's suffix. A panel is named for the **occupant**, not for its contents: the Assistant holds sessions, so it is `AssistantViewPanel`, not `SessionsViewPanel`. A panel is *what fills* a region, never a region itself, so "the panel" alone names nothing. |
| **Section** | One collapsible, resizable part of a stacked view panel — the kit's `PanelStackSection`, with its own header, count, search and drill-in. The Agents view panel has two: **Agents** and **LLMs**. Never a *drawer*: nothing in Studio slides over anything. |
| **Soul** | Who an agent is and how it speaks — Markdown on the agent, read only by the steps whose words a person reads. Never *persona*, never *character*: a soul changes words, not what runs. |
| **Third-party** | Anything that is not from the Graph: from an outside service — the **internet**, or an `api`, `app`, `db` or `agent` the Graph connects — or from the **model**'s own knowledge. Always badged `third-party · <source>` and always carrying its reference: the link for the internet, the locator for any other source. |
| **Inspector** | The surface that states what is selected and edits it. The canvas selects; the Inspector edits. |
| **Design kit** | `@invana/design-kit` — the shared component packages every screen is composed from, tokens only. Not a style guide |
| **Theme** | A named set of the kit's tokens — palette and density — applied across Studio: light and dark ([design-language.md › Theme](design-language.md#theme)). Not dark mode alone |
| **Annotation** | What a person or the assistant says about the graph's records — on a node, a relationship, one of its values, a set or a group of them — kept with the Graph, so every board that loads the records shows it. Its kinds are the anchor's shape; never *note*, *callout* or *comment* as separate things, and never a shape drawn free on the board. |
| **Walkthrough** | A board's answers replayed one **step** at a time — each step is the reply that drew it. *Presenting* is its read-only mode. |
| **Runs** | The journal of every TaskRun in a Graph — newest first, delegated children nested under their parent. **Imports** is this journal with `kind in (import, bulk)` preselected, and a Todo's `Runs` tab is it filtered to one Todo. Never "Jobs", never "Thoughts". **This renames the surface**: *Runs* was forbidden while a run was called a thinking; now `TaskRun` is the record and the journal takes its name. Read in Agents (`agents`), [AG-F03](capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md). |
| **Events** | The tree of writes — who wrote what, on whose behalf; on screen *History*, Access's (`access`). Runs lists runs; Events lists writes. Neither is the other. |

#### The shell's regions

Seven words, and only these, name a place on screen. They are `AppLayoutV2`'s prop names — the kit
owns them, so code, docs, artboards, URLs and e2e locators all say the same thing.

| Region | Is |
|---|---|
| **`header`** | the full-width row at the top — `header.left` · `header.center` · `header.right` |
| **`leftNav`** | the icon column — one icon per mode or overlay that has a `leftSection` panel — `leftNav.top` · `leftNav.topNavItems` · `leftNav.middle` · `leftNav.bottom` · `leftNav.bottomNavItems` |
| **`leftSection`** | the resizable left column — holds the open panel |
| **`mainSection`** | the open pages |
| **`rightSection`** | the resizable right column — the Assistant |
| **`bottomSection`** | the resizable bottom column — the Console |
| **`footer`** | the full-width status bar — `footer.left` · `footer.right` |

| Rule | |
|---|---|
| A sub-slot is written with its region | `header.right` · `leftNav.bottomNavItems` — never *the top-right* |
| A region is a slot; an **occupant** is what fills it | A region is never renamed after what is inside it today, and an occupant moves between regions without being renamed. The Console is an occupant; `bottomSection` is the region |
| A DOM id is the region's name, kebab-case, under `idPrefix` | `#graph-detail-left-section` — Studio's `idPrefix` is `graph-detail`; e2e locators use it. A board's label is the bare prop name |
| The engine never names a region | No response field, error payload or docstring says `leftSection` or *the panel*. The setup sections a Graph reports are *setup sections*, always qualified; a layout region is always the compound word |

### Projects and schedules

| Term | Means |
|---|---|
| **Project** | A piece of work inside a Graph — a folder of **Todos**, staffed by principals. Its own record: it never runs, has no criteria and no plan. Flat — there are no sub-projects. |
| **Todo** | One unit of work a person wrote, with a definition of done — prose, criteria, an optional assignee and due date. It has no status of its own: its state derives from its runs, and only acceptance is stored. A Todo may have no Project (the Graph's *No project* bucket) and no plan at all (a person simply does it). On screen, *Task* |
| **Project type** | What a project is deciding, and so its words: `research · investment · policy · market · investigation · general`. Changing it only relabels. |
| **Branch** | One line of inquiry inside a project. The type names it — hypothesis, thesis, option, position, lead. Forked, merged, parked, dropped; never a sub-project. |
| **Finding** | One piece of evidence on a branch, with a **stance** — `supports · contradicts · context` — and what it cites. The type may call it a signal, insight or evidence. |
| **Project decision** | A person's verdict (`supported · refuted · inconclusive`) and decision (`pursue · park · drop · merge`) on a branch, in the type's words, checked by the rules. Append-only: revisiting **supersedes**. In code `ProjectDecision`; in a project's UI just *decision* and *verdict*. Not an approval's answer and not a runtime verdict ([Asking and answering](#asking-and-answering)). |
| **Project proposal** | An agent's suggested fork or decision on a branch; a person accepts or rejects it. Not a memory proposal. |
| **Project report** | A project written up from its records and published as frozen versions. Not a *Report* board ([Working surfaces](#working-surfaces)). |
| **Simulation** | One run of a **simulator** on a branch, over pinned loads and a seed; its result is ranked and always `derived` — a prediction, never an observation. Numbered per project (`s1`). |
| **Impact** | What a branch's option reaches over the graph, hop by hop from the records its findings cite; reach only, no what-if values. Not *blast radius* in UI copy. |
| **Simulator** | A plugin of kind `simulator` that does a domain's science (genomic prediction first); Invana runs it, never computes a figure itself. Not a *simulation* — the simulator is the model, a simulation is one use of it. |
| **Tool plugin** | A plugin that reaches outside Invana as functions — and **every tool plugin is an MCP server**: the `web`, `mail` and `science` plugins Invana ships, run on its workers, and each outside server an install Admin adds, whose tools are functions `mcp.<server>.<tool>`. All are listed, frozen as an Admin saw them until refreshed, versioned, run only while an Admin has **enabled** them, and run on a worker. Core and simulator plugins stay Python in the engine. [RT-F02 › Decisions](os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md#decisions) |
| **Objective** | One statement of what a Project is for. |
| **Criterion** | One checkable statement of "done", with how it is checked: `query · agent · human`. |
| **Outcome** | A criterion's finding on one Todo, with its evidence: met · unmet · needs a human. Not a **verdict** — that is a person answering a paused Task. |
| **Dependency** | An `depends_on` edge with a condition: `success · failure · any_outcome`. Between **Todos** in a Project, and between **Tasks** in a Flow — the same concept at two altitudes. |
| **Wave** | Dependency depth. The Plan canvas groups by it. |
| **Critical path** | The longest success chain. Failure edges never inflate it. |
| **Review** | The one queue for everything waiting on a person: **clarifications, approvals and verdicts** each stop a run; results need accepting; proposals wait. |
| **Schedule** | An agent and its instructions on a cron, with where the result is delivered. A **firing** is one occurrence, recorded whether it ran or not; a **missed** firing is one the clock reached late, handled by the schedule's policy (`catch_up · run_all · skip`). One kind of schedule: whether a firing creates work a person accepts is the run's business, not the schedule's. |
| **Notification rule** | Which events reach whom, on which **channels**. A **channel** is email · Slack · webhook — never the inbox, which every rule may also write to. |
| **Inbox** | One person's notifications on a Graph, with the approvals waiting on them. A **notification** is one row; a **delivery** is one send to one channel. |

### Actors

| Term | Means |
|---|---|
| **Principal** | Who acted: `user · agent · system · external · anonymous`. |
| **Agent** | A principal that can be assigned work, carrying provider, model, skills, envelope and budget. Built and versioned at the install, in the **agents catalogue**; a Graph invites it as a member and gives it access, never its definition, budget or instructions. |
| **Agents catalogue** | The install's agents and skills, built and versioned there by an install Admin — the Agents capability (`agents`); nothing runs from it. A Graph adds agents from it, never skills. [AG-F02](capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md) |
| **Core agent · core skill** | Shipped with the engine, versioned with its release, added to every Graph and never removed from it: the Explore, Model, Data and Agents assistants; the dialect skills (Cypher query, Gremlin query) chosen by the connector's languages; natural-language query. |
| **Envelope** | The static bounds on an agent: allowed `step_key`s, which reusable flows it may `ref`, pinned arguments. What it may **do**. Validated before dispatch. |
| **Budget** | The cost ceiling a run may spend — the smallest of the agent's, the plan's and the Todo's. **At the ceiling the run pauses and asks**, as an `approval`; in-flight work finishes and nothing is discarded. Never a hard stop — that is a separate `hard_ceiling`. |
| **Role** | What a TaskRun is *for*: `execute` · `plan` · `evaluate`. Planning and evaluating are roles of a run, never kinds of a plan. |
| **Delegation** | An agent spawning an agent, bounded by depth, fan-out and a budget ⊆ its parent's. |
| **Remote agent** | An agent outside the Graph, connected by its A2A agent card, that takes a delegated task and returns a verdict and artifacts. Never *external agent*, never *partner bot*. |
| **Ephemeral** | A spawned agent that retires when its work closes. Its row stays so lineage resolves. |
| **On behalf of** | The principal a run serves, distinct from the principal that ran it. |
| **Personal access token** | A long-lived credential a person mints on their profile. It carries their identity — never a scope — and is revoked on its own. On screen a **Key**; set beside a sign-in's access token below. |
| **Promote** | Turn a generated flow that served into a reusable one (`origin = promoted`). A multi-stage load is a reusable flow too; ingestion has no grammar of its own. |
| **Agent orchestrator** | What Invana is. It decides which agent takes a task, what it may run, what it is offered, in what order, and who checks the result. |
| **Job scheduler** | The role behind the runtime protocol: when a run is dispatched, retried and queued at the process level. Invana fills it itself, in process. An external one could implement the protocol; none has. |
| **Orchestration** | The first of those. Invana's. |
| **Scheduling** | The second. Invana's own today, and replaceable by design. |

| Credential | Owned by | Lives | Carries | Reaches | Ended by |
|---|---|---|---|---|---|
| **Personal access token** (a *Key*) | A person, or a service account | Months, to its expiry, or until revoked | The holder's identity, optionally narrowed | Every Graph the holder is a member of — or, minted under a Graph's access, that Graph alone ([AC-F03 › Engine](os/access/features/AC-F03-groups-keys-and-holders/feature.md#engine)) | Revoking it, or the holder's membership |
| **Access token** | A sign-in | Minutes, renewed underneath by its refresh token | The person's identity | The same Graphs as the person | Expiry; *Sign out here · Sign out everywhere* retire its refresh |

### Words code and docs do not use

| Rule | |
|---|---|
| A review greps for them | A change is reviewed with a search for the retired region words — `rail` · `sidebar` · `activity bar` · `auxiliary` · `terminal` · `drawer` · `mainContent` · a bare `panel` or `section` — and expects none. Studio's names check holds some of them ([System design § 13](system-design.md#13-delivery-and-operations)) |
| A new word gets its row | A term not in this file is added to it in the same change that first uses it; an old word is fixed where a change touches it |

| Not this | Say | Why |
|---|---|---|
| Mission · Atlas · Workspace | **Graph** | one container, one word |
| A product, module or group name for a part of Invana | the **package** — `graphs` · `access` · `runtime` · `semantics` · `records` · `agents` · `explore` · `projects` | one package, one name, from spec folder to board ([How a package is named](#how-a-package-is-named)); a verb phrase is a feature's register |
| Dashboard | **Board** — a *declared* board when the difference matters | every surface is a board: drawn on a canvas or declared from panels (`renders: canvas · declared`). The kit's package is `@invana/boards` and its component `Board`. HyperDX's own dashboards keep their name, since they are that product's word, not ours |
| Intent | **Instructions** for guidance, **understanding** for the step | the word is ambiguous between the two |
| Instructions (as a prose blob) | **Rules** | guidance is a list of statements, not a paragraph |
| Acceptance criteria (as prose) | **Criteria** | each one is a node with a check |
| Approval · verdict, used for each other | the **three pauses**, by name | they differ in *when*: an approval is asked before dispatch and costs nothing to refuse; a verdict is asked after a pass and costs another one. One word for both hides the bound that follows from it |
| Accepting a **Task** vs accepting a **verdict** | **accept a result** · **accept a pass** | a result closes work somebody owns; a verdict decides whether a loop goes round again. Both are "accept" in the UI and different rows against different subjects |
| Iteration · lane · attempt, used loosely | each by its own name | serial repetition, parallel repetition, and a retry. They nest, so a sentence using the wrong one describes a different row |
| Permission level · access tier · Graph admin | **Graph role** by name (`operator` … `owner`) | five named roles; a Graph has no *admin* — that word is the install's |
| Thought · Thinking | **Todo** · **TaskRun** | a load is not a thought, and the run is the thing that happens. Both words are retired |
| Job · execution · job run | **TaskRun** | one vocabulary from UI to code. There is no *job* anywhere in the product |
| Task (for a thing a user wrote) | **Todo** | **the flip.** `Task` now names a node inside a Flow and nothing else. Nothing a user authors is ever a Task |
| TaskPlan · SkillPlan · WorkflowPlan · plan-as-a-type | **Flow** | one record. Where a flow came from is `origin` and `source_skill_version_ids[]` — provenance is a column, not a type |
| Workflow · builtin workflow (as a record or a role) | a **reusable flow** · a **packaged flow** | *reusable* is a column on the one record; a second noun for it read as a second concept |
| Callable · task type key (for what a step calls) | **Function**, named `namespace.verb` | `execute_graph_query`, `translate_thought` named the implementation; the namespace names what it touches. No alias is kept |
| `TaskRun.plan` | **`plan_snapshot`** | `plan` otherwise names the record, the frozen column, the planning **role** and a callable at once |
| `kind = plan` · `kind = work` | **`role = plan`** · **a Todo** | `kind` is the *subject* a plan is about. Planning is a role of a run; human work is a Todo, which is a type |
| Emission (for a stream frame) | **Run frame** | an emission is what a reader sees in an answer; a frame is how it travels |
| Internet (as a layer) | **third party** | it named the network, not the boundary — a private warehouse is as outside the Graph as a public API |
| Tier (of a model) | **role** | this year's *small* is last year's *frontier*; a plan says how much a decision matters, not how big the model is |
| Subgraph (for a narrowed view) | **Lens**, named | *subgraph* already means an [emission](#asking-and-answering), and a second meaning would make both unreadable |
| Scope (for what a run may see) | **Lens** | `rules.scope` already means `graph \| project`, and one word for two bounds hides both |
| Note · callout · comment (on the board) | **Annotation** | one noun with an author; the kind is the anchor's shape |
| Playbook (for replaying a board) | **Walkthrough** | *playbook* is what a Skill is. `playbook` stays the canvas package's word for the mechanism; the product never says it about a board |
| Ground · grounding (as a record) | **Lens** | *Grounded* is a setup gate; grounding is what the product does, a lens is the thing that bounds it |
| Orchestrator, unqualified | **agent orchestrator** for what Invana is · **runtime** for the thing that interprets a plan and dispatches its Tasks | the bare word means Airflow or Temporal to most readers; qualify it the way *graph connector* is qualified |
| Connector, unqualified | **graph connector** | the bare word is reserved for a future source connector — a mailbox, a bucket, an API |
| Source connector · pipeline | **Import** | Invana is a destination; nothing pulls data in today |
| Dataset · dataset version | **Load** (what one upload, CLI or API call brought) · **Model** (the container) | Records are loaded *into a model*; the load is the citable anchor and there is no record above it |
| Ingestion · ingest job · import job | **Import** for the surface, **import run** for one load | *ingest* claims a pull Invana does not do, and *job* is already retired above |
| Pipeline · ingestion pipeline · DAG (for a multi-stage load) | **Flow**, and its parts are **steps** | the retired sense below is a thing that *pulls* data in; this one is worse, because it implies a second orchestration concept beside the plan graph that already exists. A bundle of three files, loaded, stitched and enriched, is one flow, one run, one trace |
| Stage (for a step of a load) | **Step** | same rule as *Task*: a step is a callable the runtime dispatches, whatever a load calls it |
| Merge (for an anchor) | **Link** | anchors link; folding two nodes is lossy |
| From · To (for a stitch's two sides) | **Source** · **Target** | the payload's own words (`source_version_id`, `target_type`); *from/to* reads as direction, which an anchor does not have |
| API key · PAT · service account | **Personal access token**, spelled out | it is a person's identity with a longer life, not a key and not an account of its own |
| Wizard · onboarding · checklist · getting started | **Setup**, and **setup step** | nothing is walked modally, nothing is ticked and nothing is dismissed — the steps are derived, so the words for walking one are all false ([GR-F02](os/graph/features/GR-F02-create-a-graph/feature.md)) |
| Rail · left rail · activity bar | **`leftNav`** | the kit's prop name is the word; nothing else names a region |
| Sidebar · left panel · docked panel | **`leftSection`** | ditto |
| Editor · main content · canvas area · workspace | **`mainSection`** | ditto |
| Auxiliary · right panel · **drawer** | **`rightSection`** for the place · **section** for a part of a stacked view panel | a drawer names neither the place nor the thing, and nothing in Studio behaves like one |
| Terminal · bottom panel | **`bottomSection`** | the **Console** is what fills it |
| Status bar (as a place) | **`footer`** | the status is the occupant; the footer is the region |
| Panel · section · pane, bare | the **region**, or the **occupant** | the bare word is the whole ambiguity |
| Top bar · app bar · nav bar | **`header`** | a top bar, app bar or nav bar names a look, not the region; the kit's prop name is the word |
| Console (as a place) | **`bottomSection`** | the Console is the occupant; the region is `bottomSection` |
| Stance (on an agent) · default stance | **Act as · approach**, picked per question | an agent has no standing stance; an approach is chosen for one question and shows its assumptions before the run ([AG-F01 › Not building](capabilities/agents/features/AG-F01-build-an-agent/feature.md#not-building)) |
| Data assistant | the **shipped agents** by name | it is not one of the agents Invana ships ([AG-F02 › Not building](capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md#not-building)) |
| MCP plugin, as a kind apart from a tool plugin | **Tool plugin** | every tool plugin is an MCP server; there is one kind of plugin that reaches outside ([RT-F02 › Decisions](os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md#decisions)) |
| Graph token | a **Key**, bound to the Graph and narrowed | a credential that carries a scope instead of an identity is the second permission system a key is not |
| Projection template, for a Studio folder | **`projections/`** | *template* is Ask's answer template ([Template](#asking-and-answering)); a folder of Studio code is never named for it |
