# Glossary — the words a person reads

The words Studio shows, and the ones it never shows. Specs, boards and UI copy use these; acceptance criteria are
checked against *Not on screen* by `scripts/specs/check.py`. Code, the API, the CLI and developer docs keep the domain
terms in [terminology.md](../docs/for-developers/terminology.md) — the third column names the one each screen word
stands for.

## On screen

### Places

| Word | Means | Domain term |
|---|---|---|
| **Graph** | The bounded domain a team curates — its connection, models, data, agents and work. Always capitalised | Graph |
| **graph database** | The Neo4j, Memgraph, JanusGraph or other database a Graph binds to | graph database |
| **Explore · Model · Projects** | The three modes of the workspace, named in the wordmark | — |
| **Data · Agents · Inbox · Settings** | What is summoned over the work, as a modal or a sheet | — |
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
| **Dataset** | Tables from one source under one authorship, shared across the install, in versions | Dataset |
| **Version** | One immutable, hashed state of a dataset, model, skill or agent | Version |
| **Add to this graph** | Load a dataset version into one of this Graph's models | Bind |
| **Origin** | Where a dataset came from: official · collected · generated · observed · derived | Origin |
| **Sensitivity** | public · internal · confidential · personal — on a dataset or a column | Sensitivity |
| **Retracted** | A dataset version withdrawn by its source, with a reason; kept, and everything citing it flagged | Retracted |
| **Standard** | A shared, versioned set of terms, allowed values and required fields a dataset may claim | Standard |
| **Checks** | How a dataset scores against the standard it claims, with what breaks it | Conformance · validation report |
| **Change log** | Every version of a record — who, when, why, the difference, the effect after | Change log |
| **Import** | One load of records into a model — a run, each record checked and reported, everything written traceable to its record | Import run · `kind = import` |
| **Bulk load** | A load that writes without checking and keeps no provenance, listed among imports as such | `invana loader` · `kind = bulk` |
| **What was rejected** | The records a load refused, grouped by reason, each naming its field | Validation report |
| **Provenance** | Where a record or node came from: its dataset, file, record and the run that wrote it | Provenance stamps |

### What may happen

| Word | Means | Domain term |
|---|---|---|
| **A view of the graph** | What agents may see when answering — picked per question, compared, shared by name | World (a named lens) |
| **Rule** | A statement that must always hold — on the install, a Graph or a project — checked block · warn · report | Rule · guardrail · invariant |
| **Request** | What a person or an agent asked of the model — a rule refused it, the Graph could not answer it, or *Ask for a change* — kept until someone who can shape the model allows, drafts or declines it | Request |
| **Retune** | Narrow or widen the view of the graph from a run, then ask again | Retune |
| **What it may do** | The functions an agent or plan may run, with what arguments, each with its mode | Envelope |
| **Access rule** | Who may do what, as sentences: *Can ask*, *Can change data* | Policy |
| **Allow · Ask first · Block** | The mode of each act an agent takes — it acts · it waits for a yes in the Inbox · it is refused, naming who set it. Set by a person, by hand on an item or on an access rule's line; agents only | Mode |
| **Asks first** | An act set to Ask first waits in the Inbox, showing exactly what it will do — by default every write, send, spend and access change | Approval |
| **Token budget** | The tokens an agent, schedule or eval set may spend in a period — never currency | Budget |
| **Workers · runs at once** | The machines that run work, and how many runs a Graph may have going | Pool · lane · worker |
| **Worker group · Join key** | Workers that share labels and run the same kinds of step · the key a new worker joins a group with, shown once | Worker pool · join token |
| **Coordinator** | The engine service that hands a run's steps to workers; a lost one's runs move on | Orchestrator |

### People and access

| Word | Means | Domain term |
|---|---|---|
| **Admin** | The person who runs the install | `is_superuser` |
| **Operator** | A member who can look and ask | Graph role `viewer`, renamed `operator` by migration M1 |
| **Can work on projects** | Projects, tasks, findings, decisions | `contributor` |
| **Can build agents** | Agents, skills, tests, plans, templates | `builder` |
| **Can shape the model** | Models, links between models, rules, views of the graph, loading data | `modeller` |
| **Owner** | The Graph's settings, connection and AI providers, and the three grants above | `owner` |
| **Can manage people** | Members, groups, access rules, other people's keys | `iam-admin` |
| **Member** | A person or an agent with access to a Graph | Member · agent binding |
| **Personal access token** | A long-lived credential a person mints for themselves, shown once | Token |
| **Built in · Custom · A key's own · For everyone** | The kinds of access rule: the six grants, read-only · one written here · one that narrows a single key · the most anyone in the Graph may do, held without being given | Managed · custom · inline · boundary policy |
| **Who holds it** | The people, groups, agents and keys an access rule reaches, and how — directly, via a group, for a run | Held by · attachments |
| **Who it changes** | Before an access rule is saved: who gains, who loses, which skills would break | Impact |
| **What it can do** | What an agent may actually do once every check is applied, with why not for each refusal | Effective access |
| **Can someone do this?** | A check of whether a person, agent or key may do something to something, and which check decides; nothing runs | Test access |
| **Service account** | A member with no sign-in that owns keys for scripts | Service account |
| **Group** | People and agents in one Graph that hold access rules together | Group |
| **Sign out here · Sign out everywhere** | End this device's session · every session of the account | Revoke refresh token(s) |

### Asking and agents

| Word | Means | Domain term |
|---|---|---|
| **Conversation** | A named thread of questions to the assistant | Session |
| **Answer** | What a question produced: words with citations, a drawing, a table, a chart | Emissions |
| **Why?** | The peek behind a citation: words → query → records → dataset | Reasoning trace |
| **How it got here** | An agent result's steps, sources and assumptions, each marked *Challenge this* | Trace · run frames |
| **Cannot answer** | The Graph does not hold it — said plainly, with who can help; never a failure | Cannot answer |
| **Third-party** | From beyond the Graph — the internet, a connected source, the model's own knowledge — always with its reference | Third party |
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
| **May delegate to** | The agents an agent may hand work to — always · ask each time · never | `may_delegate` |
| **Evals** | Fixed questions with checks, replayed before a skill or agent is published | Eval set |
| **Model version** | A provider's exact model name, pinned by an agent or skill | Pin |
| **Schedule** | An agent and instructions on a cron, with where the result goes | Schedule |
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
| **Project** | A piece of work inside a Graph; experimental | Project |
| **Task** | One piece of work a person or an agent takes, as an issue thread | Todo |
| **Project type** | Research · Investment · Policy · Market · Investigation · General — sets the project's words | Project type |
| **Branch** | A line of inquiry in a project; forked, merged, parked or dropped | Branch |
| **Finding** | Evidence on a branch that supports, contradicts or gives context | Finding · stance |
| **Verdict · decision** | Whether a branch held up, and what to do: pursue · park · drop · merge | Project decision |
| **Proposal** | An agent's suggested fork or decision, which a person accepts or rejects | Project proposal |
| **Report** | A project written up from its records and published as frozen versions | Project report |
| **Simulation** | A simulator run on a branch over pinned datasets — always labelled derived | Simulation |
| **Impact** | What a branch's option reaches over the graph, hop by hop | Impact |
| **Objective · criterion** | A project's goal as one statement · how *done* is checked — by a query, an agent or a person | Objective · criterion |
| **Met · unmet · needs a person** | A criterion's outcome on a result; *needs a person* when its check could not run | Criterion outcome |
| **Accept · Send back** | A person closes a task on its result · reopens it, the note on the failing criterion | Accept · reject |
| **A pass to judge · Good enough · Go again** | A loop's pass waiting on a person · settle it · run another, the note its input | Verdict (runtime) |
| **Pick-up · Manual · Ask first · Automatic** | How agents take a project's tasks — Block · Ask first · Allow for starting one: only when assigned · asking a person first · on their own, where a person set and confirmed it | Pick-up mode |
| **Claimed** | A task an agent has taken by pick-up, for a while; a lapsed claim returns it | Claim |
| **Order** | A project's tab of its tasks in waves, by what each waits on | Plan canvas |
| **Open · Assigned · In progress · Needs input · Blocked · In review · Done · Failed · Cancelled** | A task's state, read off its latest run; only the last three are written, by a person | Todo status (derived) |
| **Needs you · Running · History** | The Inbox's three parts: what waits on the person, what runs, what people and agents did | Approvals and notifications · runs · ledger and events |
| **Updates** | The notifications a rule sent the person, in the Inbox beside Needs you; they never toast | Notification |
| **Done** | The Inbox's runs that ended today, beside Running | Settled runs |
| **Send it · Not this time · Allow · Decline · Allow always** | The acts on an ask: a send · access, budget or a delegation · a delegation for good | Approve · decline · scope always |
| **Expired, not sent** | An ask nobody decided by its deadline, or whose run ended; nothing it held went | Expired approval |
| **Notification rule · History alert** | Which events reach whom, in the Inbox and on which channels · which acts in History tell whom, in the Inbox | Notification rule · alert rule |
| **Channel** | Where a notification leaves Invana — email, Slack or a webhook; *In app* is the Inbox, not a channel | Notification channel |
| **Changes · Compare · Effect after** | History narrowed to new versions · two versions side by side · the runs, failures and tokens on a version | Change log · compare · effect |
| **Experimental** | Shown and labelled, not launched | — |

## Not on screen

| Not on screen | Say instead |
|---|---|
| Modeller · Agent Builder · Fleet · IAM · Activity · Graph settings | Model · Agents · Settings › Workers · Settings › People and access · Inbox · Settings › This graph — product names are never places |
| Policy · policy statement · policy effect | Access rule · *Can ask*, *Can change data* |
| viewer · contributor · iam-admin | *Operator* · *Can work on projects* · *Can manage people* |
| World | A view of the graph |
| Guardrail · invariant | A rule (*must always hold*) |
| Envelope | *What it may do* |
| Ledger | History (*what people and agents did*) |
| Pool · lane · worker-seconds | Workers · *runs at once* |
| Stitch | Link between models |
| Binding | *Add to this graph* |
| Task plan · frontier · step envelope | Its steps |
| TaskRun · Todo | Run · Task |
| Thought · Emission | Question · Answer |
| Mission · Atlas | Graph |
| Job · job run | Run |
| Wizard · setup wizard | *Create a graph*, in steps |
| Graph admin | Owner · Can manage people |
