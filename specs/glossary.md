# Glossary — the words a person reads

The words Studio shows, and the ones it never shows. Specs, boards and UI copy use these; acceptance criteria are
checked against *Not on screen* by `scripts/specs/check.py`. Code, the API, the CLI and developer docs keep the domain
terms in [Domain terms](#domain-terms) — the third column names the one each screen word stands for.

## On screen

### Places

| Word | Means | Domain term |
|---|---|---|
| **Graph Data** | Everything the graph databases attached to the deployment hold, read in place. A deployment attaches many graph databases; each person, team, project and agent reaches only those its access allows ([AC-F02 › Rules](os/access/features/AC-F02-access-policies/feature.md#rules)). Results from different graph databases are never joined. Never created, opened, selected or listed: it is not an object. Always capitalised. On screen also the Model group *Graph Data* — Records · Loads · Quality · Annotations | graph data |
| **graph database** | One configured connection to a Neo4j, Memgraph, ArcadeDB, JanusGraph, Neptune or TinkerGraph database, through its connector — read-only or read + write, switched on or off | graph database |
| **data store** | One configured connection, through a connector, to a store for tables, time series or files — TimescaleDB, S3, MongoDB — read-only or read + write, switched on or off, with an optional region. A kind of the model says its rows live there; the graph database holds the pointer | data source |
| **Evidence grade** | One of *observed* · *derived* · *predicted* · *claimed* on every value's provenance and every piece of evidence — read from its origin, never typed | confidence |
| **Read-only · Read + write** | A graph database's mode, set by an Admin: agents only read it · agents may also write to it — annotations, derived facts, loads, fixes. Reads always run in the database's read mode | connection mode |
| **Practice graph database** | A graph database an Admin names for testing agents and skills, never the one people ask | practice graph database |
| **Explore · Model · Projects · Agents** | The four modes of Studio, named in the wordmark, shown to everyone; what each act does follows the person's Access Policies | — |
| **Agents · Access · Settings** | The summoners at the foot of the leftNav — each opens the one large modal over the work at its own section; the Agents summoner is a glance, the Agents mode the workspace | — |
| **Large modal** | The modal, inset from the window edges, that holds every summoner's place — its own nav, the path, at most one action and Close (Esc); moving between sections never closes it | — |
| **Workers** | The section of Settings for the machines agents run on — Groups · All workers · Queue · Limits · Alerts; whether they keep up shows in the Agents glance and *● n running* | worker pool |
| **Fleet** | The section of Settings that maps agents, skills, functions and worker groups — Map · Workloads; how each agent performs is *How they are doing*, a tab of Agents › Runs — never the name of a product | fleet |
| **Agents glance** | What the Agents summoner opens in the large modal: what waits on the reader, what runs, whether the workers keep up; every deeper act is *Open in Agents* | — |
| **Operations** | What the deployment is doing now — runs, the queue, workers, tokens this month — the quick-overview dropdown behind the header's *● n running*; its links open Agents › Runs and Settings › Workers, where every deeper act happens | fleet · overview |
| **Access** | The section of the large modal for who may do what — Now · Who · What they may do · Record · Keeping; the header lock is an Admin's glance at it: what each person and agent is touching in the last hour, and what a policy blocked | access summary |
| **Switcher** | The dropdown behind the *☰ Invana {Mode} ▾* control: Go to · New · Recent · Pinned | — |
| **Recent · Pinned** | The items a person opened, newest first, kept for them by the engine · the ones they starred | recents · pins |
| **General · Appearance · You · Connections · Notifications** | The groups of Settings: the deployment's general settings · how Studio looks · the person's own account · graph databases, AI models, the MCP server and connectors · what reaches whom | deployment settings · profile |
| **Board** | A named, saved working surface — drawn on a canvas, or a dashboard of panels | Board (`renders: canvas · declared`) |
| **canvas** | The pannable drawing of nodes and relationships on a board | canvas |
| **Assistant** | The one conversational surface, on the right of every mode | Assistant |
| **Console** | The rows behind a drawing, and the query that drew them, under the canvas | Console |

### Data and models

| Word | Means | Domain term |
|---|---|---|
| **Model** | The kinds of node and relationship Graph Data holds, and their properties — each model bound to one graph database, which may hold several; a kind's label belongs to one model, and another shares it only through a *same thing* link between models | Domain model |
| **Kind** | One type of node or relationship in a model | node type · edge type |
| **Draft** | Unpublished changes; a floating bar says how many | Draft |
| **Publish** | Make a draft the model everyone asks against | Publish |
| **Link between models** | A declared meeting of two models in the same graph database — the same entity, or a relationship across them, on a key on each side. Never across graph databases ([SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md)) | Stitch · anchor · relationship link · identity link · match rule |
| **Lens** | *Parked, not on screen.* A named, versioned selection of the model that a question would be asked through; it selects and never grants — Access Policies alone decide what may be seen ([SE-F09](capabilities/semantics/features/SE-F09-lenses-of-the-graph/feature.md)). Kept so *view* and *world* are not brought back | View · world · view of the graph |
| **Constraint** | One property's range with a unit, or one standard's values, on one kind — Reject or Flag for review when a record breaks it | Property constraint (validation rule) |
| **What the database holds** | The kinds, properties and counts read from the graph database, with when — compared with the model, never the model | Physical mirror · introspection |
| **Records** | The nodes and relationships Graph Data holds, read in place from the graph databases — never copied — each one of a kind in a published model; *Model › Graph Data › Records* lists them by kind; only structured rows that fit a kind become records | Instance — node · relationship |
| **Version** | One immutable, hashed state of a model, standard, skill, workflow or agent | Version |
| **Sensitivity** | A property's level — **public** · **internal** · **confidential** · **personal** — set in its kind's Meaning by a Modeller; *internal* until set. Access Policies may reach one level of a kind; a derived value takes the highest level of what it came from | Sensitivity |
| **Sensitive property** | A property whose level is confidential or personal; it never leaves for an external target — a call carrying it is refused, a document or a result leaves without it, naming it | sensitive tag |
| **Undone** | A load a person took back: its records removed, the load kept, and everything citing it flagged | Undo a load |
| **Standard** | A shared, versioned set of terms, allowed values and required fields a kind or property is held to | Standard |
| **Checks** | How a load's records score against the constraints and standards their model holds them to, with what breaks them | Conformance · validation report |
| **Meaning** | A tab on a kind: what the kind and each property mean — definitions, synonyms, units, and the outside terms they are the same as | Meaning · IRI · sameAs |
| **Broader kind** | A kind another kind is a narrower case of — for meaning only; records and questions stay on the kind itself | Taxonomy · subclass |
| **Derivation** | A rule that adds facts from facts already in Graph Data | Derivation rule · inference |
| **Derived** | A fact a derivation added, written to a read + write graph database — never an observation; it shows its rule and version in *How it got here* | Derived fact |
| **Predicted** | Evidence from what-if reasoning — what would follow from a change, never an observation | predicted evidence |
| **Change log** | Every version of a record — who, when, why, the difference, the effect after | Change log |
| **Load** | One bringing-in of records into one model, by upload, the CLI or the API, written to a read + write graph database — the citable anchor: a stable id, the file's content hash, a licence, the run that wrote it. Its file is a **load batch** in the blob store, never a second store of records. Undoing it removes its records, keeps the load and flags what cites it. [RC-F02](capabilities/records/features/RC-F02-bring-records-in/feature.md) |
| **Bulk load** | A load that writes without checking and keeps no provenance, listed among loads as such | `invana loader` · `kind = bulk` |
| **What was rejected** | The records a load refused, grouped by reason, each naming its field | Validation report |
| **Provenance** | Where each value came from: the load, edit, person or agent that wrote it, and when — and the file and run behind it | Provenance stamps |

### What may happen

| Word | Means | Domain term |
|---|---|---|
| **Rule** | A statement that must always hold — on the deployment or a project — checked block · warn · report. On an Access Policy, *rule* names one of its lines | Rule · invariant |
| **Request** | What a person or an agent asked of the model — a rule refused it, Graph Data did not hold it, or *Ask for a change* — kept until a Modeller allows, drafts or declines it | Request |
| **Retune** | Narrow or widen what a question reads from a run, then ask again | Retune |
| **What it may do** | The most an agent may ever do — its ceiling, the Access Policies attached to it; never a grant | the agent's ceiling |
| **Access Policy** | The one kind of permission: a named list of **rules** attached to users, teams, projects and agents — the same object for each. A rule is an effect (`allow · ask · deny`), an action (`read · create · edit · publish · run · manage`) and a resource `type/name` where `*` matches one whole segment; on Graph Data it reaches a graph database, a kind of node or relationship, or one property. Default deny; Deny wins; `ask` waits only in a run — in a person's or a team's own permissions it counts as deny. A person holds the Allows on them and their teams minus the Denies; a project holds policies exactly as a user does; an agent's is its ceiling. A run inside a project reaches the project's policies ∩ the agent's ceiling; outside one, the person ∩ the agent's ceiling |
| **Read · Create · Edit · Publish · Run · Manage** | The six actions a rule names; *Publish* reads *Publish · Approve*; what each means for each resource is the permission catalogue | action |
| **Allow · Ask · Deny** | The effect of every rule — it acts · it waits for a named approver, on a project's or an agent's policy only · it is refused, naming the rule and who set it. What no rule allows is denied; Deny wins. Set only by a person | effect |
| **Asks first** | An act a rule sets to Ask waits in the Inbox, showing exactly what it will do, for one of the agent's named approvers; a yes covers that step of that run; unanswered, it reminds, then goes to the Admins, then expires refused — never allowed by default | Approval |
| **Token budget** | The tokens an agent, schedule or eval set may spend in a period — never currency | Budget |
| **Limits** | What a team, a user or an agent may spend and have running at once | limits |
| **Workers · runs at once** | The machines that run work, and how many runs a team, user or agent may have going | Pool · lane · worker |
| **On · Off** | A plugin's or graph database's switch: for the whole deployment, by an Admin, a hard off and a ceiling on every run · for a person, narrowing only the runs they start and their helpers. A new plugin or graph database starts off; a core plugin cannot be turned off. Work that needs something off is refused before it starts, naming who turned it off | install switch · user switch |
| **Access usage** | What each agent read, wrote and ran, and the access it holds but never used | ledger (reads) |
| **What left the platform** | What went to which AI model, tool, outside agent, client, channel or file, from which run, for whom — each call schema-only or data-bearing, sent, refused or with something left out | ledger (outbound) |
| **Outbound check** | The one check everything leaving for an external target passes: nothing confidential or personal leaves — a call is refused, a document or a result leaves without those values, naming them | outbound sensitivity check |
| **Withheld** | What a person may not open of a run, a project or another person's connection, shown as there but without its content, naming why. Data an Access Policy hides is never withheld: it does not exist for the person | redacted |
| **Left out** | What the outbound check took out of a document or a result before it left, named in it | redacted on egress |
| **Work connection** | A service identity on an outside server — a token, or a service account over OAuth — an Admin makes once and a Modeller or an Admin attaches to agents; shared work uses only these | service credential |
| **Tracker** | A code host a project is linked to — GitHub or Gitea: issues, branches, pull requests, checks and reviews — or, read only, local files or the web; when linked it is the record of truth and each issue has a **twin** task in Invana ([CP-F12](os/control/features/CP-F12-issue-trackers/feature.md)) | issue source |
| **Waiting deletion** | The tag that puts an outside issue in a person's queue to delete at the tracker; Invana never deletes it ([CP-74](os/control/features/CP-F12-issue-trackers/stories/CP-74-delete-an-outside-issue-only-by-hand/story.md)) | trash |
| **Personal connection** | A person's own account on an outside server, used only in the runs they start and their helpers; what it returns shows only to them | user OAuth connection |
| **Schema-only · Data-bearing** | A call that carried only the model — kinds and properties · one that carried records or their values | call class |
| **Local · External** | A target inside the deployment — a model an Admin marks local, a core plugin, a graph database · every other: an outside model, tool, agent or runtime, an MCP client, a channel, an export, a published report. Confidential and personal values never go to an external one | target locality |
| **Worker group · Join key** | Workers that share labels and run the same kinds of step · the key a new worker joins a group with, shown once | Worker pool · join token |
| **Coordinator** | The engine service that hands a run's steps to workers; a lost one's runs move on | Orchestrator |

### People and access

| Word | Means | Domain term |
|---|---|---|
| **User** | Who acts in the deployment: a person, an agent, or the system user | Principal |
| **Permission** | An action — Read · Create · Edit · Publish · Run · Manage — on a resource, from [the permission catalogue](os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue); what an act needs, named when it is disabled — *Needs Edit on Access — ask Priya or Lee* | permission |
| **Super user** | The locked Access Policy that allows every action on every resource; the first account holds it, and it always has a holder | superuser |
| **Access templates** | Access Policies shipped as data to start from, edited, copied or attached like any other — one list of suggested starting points: *Read only* · *Explore* · *Shape the model* · *Build agents* · *Run the deployment* · *Read and analyse* · *Fix data quality* · *Full project*. Any may be attached to any holder. *Read only* goes to newcomers out of the box, by a setting | access template |
| **Admins** | The people who hold Manage on Access — whom a refusal, an escalation and a fallback name as able to grant; defined once in [AC-F02 › Decisions](os/access/features/AC-F02-access-policies/feature.md#decisions) | — |
| **What can {person} do?** | Every permission a person holds, each with the policy and the team it comes through, and each Deny that removes one | effective permissions |
| **New policy** | The one way to make an Access Policy, for any holder: *Start* — a name and an Access template, or Blank · *What it allows* — a tab strip, one tab per section with its status, above full-width content: Graph Data down to kinds, relationships and properties, Models, AI models, Agents, Skills & plugins, Fleet / Workers, Projects, Access, Settings, Outside Invana · *Who holds it* — people, teams and projects in one picker · *Review* — the whole policy read back, then *Create policy*; *Edit as policy* opens the matrix. New project's Access step runs the same form | policy wizard |
| **Team** | A flat group of people that holds Access Policies — each person on it holds them. A team owns nothing and holds no other team | Team |
| **Agents they may use** | The agents granted to a person, directly or through a team; every act a person makes runs through one of them | agent grant |
| **Built-in agent** | An agent every deployment ships, one of each, owned by the system user: Assistant · Query console · Modeller · Coordinator · Record editor · Loader. A person's direct acts run as one of them | built-in agent |
| **Query console** | The built-in agent behind the Console's queries: it reads, asks first before a write, and every query it runs is recorded; granted like any agent | built-in agent `query` |
| **Owner · Made by** | Who a resource belongs to — the platform for built-in and shared work, its person for a personal agent · who made it, kept beside its owner. Owning grants nothing | Owner · `made_by` |
| **System user** | The user that owns what Invana ships; it never signs in. What it owns is copied to customise, never edited | system user |
| **Deactivate · Reactivate** | Stop a person who leaves from signing in or acting, keeping their work and its History · let them back in; nothing handed on returns | deactivate user |
| **Successor** | The active person an Admin names when deactivating someone: they take every place the leaver held on the work and their chats outside projects, and may adopt their personal agents | successor |
| **Slot** | A place a person sits on work — an agent's approver, a place on a project's team, a task's assignee, a schedule's setter — each with a fallback, so no work waits on one person | slot |
| **Adopt** | Make a departed person's retired personal agent one's own, as their successor | adopt agent |
| **Former member** | How a departed person's work names them when names are pseudonymised — *Former member · 4F7A*, the same code everywhere | pseudonym |
| **Leaving and keeping** | Where an Admin sets how long each store is kept, holds memory or History, decides a departed person's name, forgets a subject and exports what is held about a person | retention and erasure |
| **Keep · Retention period** | A store kept until an Admin sets a period — the default · how many days a store keeps what the work leaves before a prune removes whole windows | retention |
| **Legal hold** | A hold an Admin places on memory or History, with a reason: no prune and no erasure touches the store until it is lifted | legal hold |
| **Forget a subject** | Erase every memory node that cites a record, and the content of every copy built from them, found through lineage; the record stays the customer's | erasure by lineage |
| **Export their data** | One JSON file of everything held about a person — profile, what they did, personal-connection data — made by an Admin | subject export |
| **Erased** | What a copy reads when its content is gone — *Erased — personal data of a person who left* · *Erased — a forgotten subject* — its kind, when and who made it kept | erased |
| **Checkpoint** | What each prune of History leaves: the number and hash of the last row removed, signed, so the rows kept still prove they follow on | History checkpoint |
| **Named approvers** | The people or teams who answer an agent's asks; naming a single person warns; with none named or none active, the Admins, with a *no approver* alert. Never the person the ask benefits | approvers |
| **Person behind the run** | The person a run is recorded for — who asked, a key's owner, or who set the schedule or pick-up. Outside a project their permissions bound the run; inside one, the project's policies do | On behalf of |
| **Built in · Template · Custom** | An Access Policy shipped and locked — Super user, a built-in agent's ceiling · an Access template, shipped as data to start from · one written in the deployment | built-in · template · custom policy |
| **Attached to** | The users, teams, projects and agents an Access Policy holds for | attachments |
| **Who it changes** | Before an Access Policy is saved: which agents gain, which lose, which skills and workflows would break | Impact |
| **What it can do** | What an agent may actually do in a run once every check is applied — the project's policies, or outside a project the person, ∩ its ceiling ∩ the run's other ceilings — with why not for each refusal | Effective access |
| **Can someone do this?** | A check of whether a person, or an agent's run for them or a project, may do something, and which rule decides; nothing runs | Test access |
| **Key** | A long-lived credential that belongs to a person — a personal key, acting with their policies — or to a project — a project key, acting with the project's policies and outliving anyone on its team, for CI, integrations and clients that are no one person; either way ∩ the agent's ceiling. It holds no policy of its own, may be narrowed, expires in 30, 90 or 365 days or never, and is shown once | Personal access token |
| **Connected client** | An MCP client — Claude Code, an IDE — a person connected to the deployment's MCP server by signing in and consenting; it acts for that person through their default agent, is external to the outbound check, and they revoke it on their account | OAuth client |
| **Sign out here · Sign out everywhere** | End this device's session · every session of the account | Revoke refresh token(s) |
| **Sign in again** | A fresh sign-in the risky acts ask for — changing access, keys or credentials — however recent the session | step-up · fresh sign-in |

### Asking and agents

| Word | Means | Domain term |
|---|---|---|
| **Conversation** | A named thread of questions to the assistant | Session |
| **Answer** | What a question produced: words with citations, a drawing, a table, a chart | Emissions |
| **Why?** | The peek behind a citation: words → query → records → load | Reasoning trace |
| **How it got here** | An agent result's steps, sources and assumptions, each marked *Challenge this* | Trace · run frames |
| **Cannot answer** | Graph Data does not hold it — said plainly, with who can help; never a failure | Cannot answer |
| **Third-party** | From outside Graph Data — the internet, an outside service, the model's own knowledge — always with its reference | Third party |
| **Search provider** | A web search service the deployment adds, each a `tool/…` resource a rule can name | Search provider |
| **Act as · approach** | A method picked for one question — a scientist, a designer — with the assumptions it brings, shown before the run | Stance |
| **Assumptions** | What an answer rests on that Graph Data did not prove: proven · assumed · refused, each with what changes without it | Assumption ledger |
| **Fork from here** | A new conversation from one reply, with the turns and the board as they stood there | Fork a session |
| **Recall** | A run's step that reads the thinking graph for what served and what to avoid, ranked by outcome, and cites what it recalled | Recall step |
| **Evidence** | What runs show about a skill, plan, rule or criterion — counts over a stated window, each opening its runs | Evidence |
| **Suggested change** | A new version of a skill, plan, rule, criterion or template, with its evidence, waiting for a person in *Needs you* | Proposal (memory) |
| **Annotation** | What a person or the assistant says about records, written to the graph database that holds them | Annotation |
| **Walkthrough · Presenting** | A board's answers replayed one step at a time; presenting is its read-only mode | Walkthrough |
| **Agent** | A colleague that takes work, answers in threads and acts only as far as a person allows; every Read, Write and Run is an agent's | Agent |
| **Skill** | A playbook an agent may be offered, written as instructions | Skill |
| **Function** | One operation a plan may call, from a plugin; read-only in Studio | Function (`namespace.verb`) |
| **Plan · its steps** | How an agent carries one piece of work out — drafted from instructions, or a workflow reused or composed | Flow · Task |
| **Workflow** | A plan the agent's named approvers approved for reuse: read-only, run with its declared arguments, changed only as a new version. The platform owns it; who asked for it is kept as its maker | reusable Flow |
| **Built-in workflow** | A workflow shipped with Invana or a plugin, owned by the system user | `origin = packaged` |
| **Run** | One execution of a plan or a workflow, with its time and tokens | TaskRun |
| **Thinking graph** | What runs leave in **Memory** — every plan, workflow, run, step, evidence, finding and decision, kept and linked; what served is recalled first, what failed is kept as what to avoid | thinking graph |
| **Memory** | Invana's own graph of the work — activity, runs, sessions, hand-off notes, tasks, findings, decisions and their relations, each with its lineage; the thinking graph is the part runs leave. Never customer data, and never part of Graph Data. Project memory sits on its project, agent learnings on their agent, org knowledge on the deployment; no team holds memory ([GP-F02](os/graph/features/GP-F02-memory/feature.md)) | Memory · stored in the system graph |
| **Org knowledge** | A learning a person promoted for the whole deployment; an agent only proposes it ([GP-F02](os/graph/features/GP-F02-memory/feature.md)) | org knowledge |
| **Good · Bad** | A person's mark on a run's thinking, which steers what is recalled next | outcome label |
| **Voice** | Who an agent is and how it speaks, in plain words, read only by the steps whose words a person reads | Soul · voice dials |
| **Effort** | How hard an agent tries before it stops — steps, replans, questions back | Effort |
| **Helper** | An agent another agent makes for one piece of work, inside that agent's bounds; it retires when the work closes | Ephemeral child agent · spawn |
| **Outside agent** | An agent outside Invana, reached over A2A or MCP, that an agent may hand a task to; it asks first by default | external agent |
| **Evals** | Fixed questions with checks, replayed before a skill or agent is published | Eval set |
| **Model version** | A provider's exact model name, pinned by an agent or skill | Pin |
| **Schedule** | An agent and instructions on a cron, with where the result goes | [Schedule](#projects-and-schedules) |
| **AI models** | The LLM providers and model versions the deployment offers, each local or external | LLM providers |
| **Plugin** | Content, no code run by the engine: a folder in the Claude plugin layout of agents, skills, policies, project types, ontology and `.mcp.json` an Admin switches on; a core plugin is always on. Code is a **Connector** | Plugin |
| **Claude plugin** | A folder in Claude Code's plugin layout — `.claude-plugin/plugin.json`, `skills/`, `agents/`, `.mcp.json`; every Invana plugin and Team pack is one, its own fields under `metadata.invana`, and one made for Claude Code imports ([CP-F02](os/control/features/CP-F02-plugins-and-outside-tools/feature.md#rules)) | plugin bundle |
| **Agent tool's folder** | Where an agent tool keeps a project's agents and skills — `.claude/`, `.codex/`, `AGENTS.md`; a Modeller imports from it ([AG-63](capabilities/agents/features/AG-F08-portable-agents-and-skills/stories/AG-63-bring-in-agents-and-skills-from-an-agent-tools-folder/story.md)) | — |
| **Imported** | An agent or skill brought in from files, a Claude plugin or an agent tool's folder: a draft, the platform's, made by who imported it, used by nobody until a policy allows Run on it | `imported` |
| **Built in · Team pack · Custom** (agents) | An agent Invana ships · one a Team pack brought, naming the pack · one people built or imported. Each reads who made it | `kind` |
| **Your default** | The agent a person's asks go to when they name none, and what a connected MCP client asks; it grants nothing. Set in the Directory | default agent |
| **MCP server** | An outside server whose tools agents may call as functions, frozen as an Admin saw them | MCP plugin |
| **The deployment's MCP server · Served** | The deployment's one endpoint for Claude Code and other callers, who act as the person who connected them or as a key · an agent or function an Admin lets callers reach | MCP server · `mcp_served` |
| **Withdrawn** | A model version something still pins that the deployment has stopped offering | `no longer offered` status |
| **Approve as a workflow** | Keep a plan that served for reuse, named by what it is for — by the agent's named approvers; its literal values become declared arguments. Never needed to run a plan once | Promote |
| **Run a workflow · Dry run** | Start a workflow by name with its arguments · check it and project its tokens without starting a run | Start by key · dry run |
| **What it touches** | A function's bound: reads the graph · writes the graph · changes the model · brings data in · calls a model · hands out work · reaches outside · nothing outside | Bound |
| **Offered · applied · the gap** | A skill given to a step · the step reported using it · offered less applied, per version | Offered · applied |
| **Too few to read · No data yet** | A count below the floor that makes it readable · a skill nothing was offered — neither is a zero | Enough to read |
| **What it needs** | The data, functions, plugins and tools a skill, plugin or function declares; usable only when the agent's Access Policies and the graph database's mode allow them all, else refused, naming what is missing | Needs |
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
| **Project** | Any kind of work a team of people and agents runs — a question, a case, a document, a fix; experimental. It holds no permissions | [Project](#projects-and-schedules) |
| **Task** | One piece of work a person or an agent takes, as an issue thread | Todo |
| **Task kind** | What kind of task it is — its own fields and default checks; every project has *Task* and *Recommendation*, and a type adds a kind only where its work needs fields of its own ([PJ-20](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-20-give-a-project-its-kinds-of-task/story.md)) | task type |
| **Tag** | A label on a task — story · bug · test · review · audit · research · duplicate · waiting-deletion, a type's defaults, or the project's own; it maps to a label on a connected issue tracker ([PJ-27](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-27-tag-a-task/story.md)) | — |
| **Recommendation** | A task kind: a change someone recommends to a project; it arrives as a proposal for the project assistant | recommendation |
| **Team** (of a project) | The people, teams and agents on a project. Every person on it may do everything inside the project — there are no project roles; one agent may be tagged *Lead agent*. Joining grants nothing outside the project ([PJ-22](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-22-set-the-project-team-and-its-lead-agent/story.md)) | project team |
| **Lead agent** | The one agent on a project's team that coordinates its agents — ideates, plans, splits and assigns tasks — and sends every decision a person must give to the project's people as a proposal; the project assistant | `lead_agent` |
| **Project assistant** | The project's Lead agent: it ideates with the team and turns ideas, recommendations and asks into proposals a person on the team accepts ([PJ-21](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-21-ideate-with-the-project-assistant/story.md)) | project assistant |
| **Group** | A named set of a project's tasks done in order; it may wait on a group of this project or another | task group |
| **Milestone** | A group with a goal, a *done when*, optional dates, what it covers on the map and a person's accept; progress is the engine's ([PJ-26](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-26-make-a-milestone-from-a-selection/story.md)); Invana's own roadmap is [milestones](milestones.md) | sprint · epic · release |
| **Check · Checking · Checks failed** | A workflow that judges a task's result in a run of its own · its checks running · one failed, so *Accept* is off ([PJ-25](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-25-gate-a-task-on-its-checks/story.md)) | task check |
| **Started from · Waits on · Related** | How one project relates to another: made from its task or finding · a group of it waits on the other's · sharing context. A run reaches the projects related to its own | project relation |
| **Ask another project** | A request from a task to another project; it lands as a proposal for that project's assistant, and a person on its team accepts it | cross-project ask |
| **Map** | A project drawn from Memory — groups, tasks, runs, findings, decisions, related projects — with what is moving now | project map |
| **Subject model** | What a project is about — the node kinds and links its type parses from its sources; never hand-kept | ontology (of a project) |
| **Work model** | What is moving on a project — milestones, tasks, runs and linked issues, recorded by the engine and projected into the same graph | — |
| **Draft node** | A node a person accepted from the assistant's sketch that is not yet written to its source; drawn dashed while only proposed ([PJ-30](capabilities/projects/features/PJ-F07-the-project-graph/stories/PJ-30-sketch-nodes-with-the-assistant/story.md)) | — |
| **Project type** | What kind of work a project is: a manifest of a subject model, sources, suggested agents and skills, default tags, default checks and its words. Built in or from a Team pack; never authored in Studio. `software` (Project · Story) and `research` (Project · Task) ship with their packs; `general` has no subject model ([PJ-F07](capabilities/projects/features/PJ-F07-the-project-graph/feature.md#rules)) | — |
| **Branch** | A line of inquiry in a project; forked, merged, parked or dropped | [Branch](#projects-and-schedules) |
| **Finding** | Evidence on a branch that supports, contradicts or gives context | [Finding](#projects-and-schedules) · stance |
| **Verdict · decision** | Whether a branch held up, and what to do: pursue · park · drop · merge | Project decision |
| **Proposal** | An agent's suggested fork, decision, task, group, check or relation — or a recommendation or an ask from another project — which a person on the team accepts or rejects | [Project proposal](#projects-and-schedules) |
| **Report** | A project written up from its records and published as frozen versions | Project report |
| **What-if** | A way of reasoning about what would follow from a change; its evidence is labelled *predicted* | what-if method |
| **Impact** | What a branch's option reaches over the graph, hop by hop | Impact |
| **Accept · Send back** | A person on the team closes a task on its result · reopens it, with a note on the task | Accept · reject |
| **A pass to judge · Good enough · Go again** | A loop's pass waiting on a person · settle it · run another, the note its input | Verdict (runtime) |
| **Pick-up · Allow · Ask · Deny** | How the team's agents take a project's tasks — the mode for starting one: on their own, where a person on the team set and confirmed it · asking the project's people first · only when assigned. A picked-up run records who set *Allow* or pressed *Start it*, and reaches the project's policies ∩ the agent's ceiling | Pick-up mode |
| **Claimed** | A task an agent has taken by pick-up, for a while; a lapsed claim returns it | Claim |
| **Order** | A project's tab of its groups and tasks in waves, by what each waits on | Plan canvas |
| **Open · Assigned · In progress · Needs input · Blocked · Checking · Checks failed · In review · Done · Failed · Cancelled** | A task's state, read off its latest run and its checks; only the last three are written, by a person | Todo status (derived) |
| **Needs you · Running · Updates · Done** | The Inbox's parts: what waits on the person, what runs, what a rule sent them, what ended today. The header dropdown holds the first three | Approvals and notifications · runs · notifications · settled runs |
| **Updates** | The notifications a rule sent the person, in the Inbox beside Needs you; they never toast | Notification |
| **Done** | The Inbox's runs that ended today, beside Running | Settled runs |
| **Send it · Not this time · Allow · Decline · Allow always · Decline for N days** | The acts on an ask: a send · access, budget or a delegation · a delegation for good · an ask for more, kept from coming back for up to 90 days | Approve · decline · scope always |
| **Expired, not sent** | An ask nobody decided by its deadline, or whose run ended; nothing it held went | Expired approval |
| **Notification rule · History alert** | Which events reach whom, in the Inbox and on which channels · which acts in History raise an ops alert to whom ([CP-F11](os/control/features/CP-F11-ops-alerting/feature.md#the-alert-kinds)) | [Notification rule](#projects-and-schedules) · alert rule |
| **Channel** | Where a notification or an ask leaves Invana — email, Slack, Teams or a webhook; *In app* is the Inbox, not a channel. An ask answered on a channel is recorded in History like any other | Notification channel |
| **Ops alert** | A platform alert to the people its kind names, then the Admins — repeated refusals, over a limit, a stuck run, an unreachable graph database, a skipped schedule, data sent from a schema-only workflow, a recently added decider, a History match. Every alert in Invana is one of these kinds ([CP-F11](os/control/features/CP-F11-ops-alerting/feature.md#the-alert-kinds)) | ops alert rule |
| **Changes · Compare · Effect after** | History narrowed to new versions · two versions side by side · the runs, failures and tokens on a version | Change log · compare · effect |
| **Experimental** | Shown and labelled, not launched | — |

## Not on screen

| Not on screen | Say instead |
|---|---|
| Agent Builder · IAM · Activity · Graph settings | Agents · Operations · Workers · Access · Inbox · Settings › Connections — product names are never places; *Fleet* is said only as the Settings section |
| Policy statement · policy effect | A **rule** of an Access Policy · Allow, Ask or Deny |
| viewer · contributor · iam-admin | The Access Policy — *Explore*, *Shape the model*, *Run the deployment* — or the permission an act needs |
| World · view of the graph | An **Access Policy** rule — what may be seen is never a named view; a lens is parked |
| Guardrail · invariant | A rule (*must always hold*) |
| Envelope | *What it may do* |
| Ledger | *What left the platform* · *Access usage* · History (*what people and agents did*) |
| Pool · lane · worker-seconds | Workers · *runs at once* |
| Stitch | Link between models |
| Binding · dataset · dataset version | A load — a dataset is the batch a load writes, never a store of records |
| Semantics · taxonomy | Model · *Meaning* · *Broader kind* — *ontology* too, except in *From an ontology*, which names an outside file |
| Task plan · frontier · step envelope | Its steps |
| TaskRun · Todo | Run · Task |
| Thought · Emission | Question · Answer |
| Mission · Atlas · tenant | The deployment · Graph Data |
| Job · job run | Run |
| Wizard · setup wizard | Setup, in steps |
| Graph admin | Admin |
| Personal access token · access key · API key | Key |
| Explorer agent · Query agent | Assistant · Query console |

## Domain terms

The words code, the API, the CLI and developer docs keep — the right-hand column of the tables above names the one
each screen word stands for. Engine and Studio names follow these; a person never reads them unless the table above
puts them on screen.

### How a feature is named

**A feature is named for what a person does. A term is named for what the thing is.**

| Rule | |
|---|---|
| The name is a **verb phrase** | *Author an agent* · *Bring data in* · *Offer a skill to an agent* · *Approve a plan into a workflow*. If it reads as a noun, it is probably the table |
| Or a **plain statement of the moment** | *When it cannot answer* · *Inspect what landed* · *How many run at once* — a situation a person is in, not an object |
| The **object keeps its noun here** | Envelope, budget, binding, lineage, library, projection, emission are real things with precise meanings. They live in this part and in the code; they are not what a feature is *called* |
| A **defined term may keep its name** | Where the noun *is* the concept and renaming it would cost precision — `Rules`, `Projections`, `Delegation`. Plainness never buys vagueness |

### How a package is named

**Every part of Invana is one package, with one name from its spec folder to its boards.** The operating system's
planes are `control` · `access` · `graph`; the capabilities are `semantics` · `records` · `agents` · `explore` · `projects`. The
names and the form each takes in every layer are
[System design § 8 › One name across layers](system-design.md#8-apis-and-events) — the only source.

| Rule | |
|---|---|
| A **package** is named for the part, a **feature** for what a person does | `access` holds *Sign in*; `records` holds *Bring records in*. A verb phrase is a feature's register, never a package's |

### The container and what it holds

| Term | Means |
|---|---|
| **Deployment** | One install of Invana and everything in it — its graph databases, Graph Data, the system graph, users, teams, agents and work. The widest scope: there is no workspace, tenant or Organisation above it and no unit inside it that holds a graph of its own. *Install* means the same in code and docs |
| **Connector** | Code: a pip package that implements one engine interface — a graph database (`invana-neo4j`), a code host (`invana-github`, `invana-gitea`), a source (`invana-web`, `invana-files`) or a runtime for an outside agent tool (`invana-claude-code`), a data store (`invana-timescaledb`, `invana-s3`, `invana-mongodb`) or a compute engine — found by entry point and described by a `connector.yaml` manifest; for a graph database it speaks its query language and its driver's read mode ([CP-F02](os/control/features/CP-F02-plugins-and-outside-tools/feature.md#rules)) |
| **Custom pack** | A pack a person made — a copy of an installed pack they edited, or an import of their own agents and skills ([CP-20](os/control/features/CP-F02-plugins-and-outside-tools/stories/CP-20-install-a-team-pack/story.md) · [AG-64](capabilities/agents/features/AG-F08-portable-agents-and-skills/stories/AG-64-bring-my-agents-over-and-take-invanas-out/story.md)); off until an Admin turns it on, its agents granted to nobody |
| **Graph database** | One configured connection, through a connector, to one database — one credential, initialised **read-only** or **read + write** by an Admin, switched on or off. Every read runs in a **read-only session**, which a connector proves with its certification test |
| **Graph Data** | Everything the graph databases attached to the deployment hold, read in place and never copied — never created, opened, selected or listed: the deployment is the only scope. Each person, team, project and agent reaches only the graph databases its access allows. The reasoning boundary: what is not in it is third-party. A question runs one step per graph database it reads, in its own language; results from different graph databases are shown side by side, never joined |
| **System graph** | The store of Invana's own graph — a bundled ArcadeDB governed by the system ontology. It holds **Memory** with its lineage and the ledger's edges, never customer data, and is never part of Graph Data. It follows Postgres, the source of truth, and is rebuilt from it |
| **System ontology** | The read-only, versioned ontology Invana ships that governs the system graph |
| **Deployment settings** | The deployment's configuration — graph databases, AI models, plugins, MCP servers, outside agents, limits — shown in *Settings › Connections*, *Settings › Plugins* and *Settings › Workers*. Agents and outside agents are Agents' (`agents`); the rest is the Control Plane's (`control`) |
| **Operating system** | What runs every deployment: the **Control Plane**, the **Access Plane** and the **Graph Plane** — the packages `control` · `access` · `graph`. A vision and docs word; in code its parts are packages beside the capabilities |
| **Control Plane** | What runs, where and within which limits — runs, workers and the queue, graph databases, limits, AI models, plugins and the MCP server, ops alerts, the Inbox. Product code `CP` |
| **Access Plane** | Who may act, through which agent, and what they did — sign-in, keys, Access Policies, the Directory, ownership, asks, the ledger's views, History. Product code `AC` |
| **Graph Plane** | What Invana reads and what it remembers — **Data**: Graph Data, read in place through a connector per graph database · **Memory**: Invana's own graph of the work, in the system graph. Product code `GP`. A vision and docs word: on screen a person reads *Graph Data* and *Memory* ([os/graph](os/graph/product.md)) |
| **Lineage** | What a copy — an answer, a finding, a report, a snapshot, a transcript, a note, a memory node or an export — was read from: its **sources**, as Access Policy resources with their level, recorded with the copy and kept as edges in Memory. A copy shows to a person only when their default agent may Read every source; else it does not exist for them. Its level is the highest of its sources' ([GP-F02](os/graph/features/GP-F02-memory/feature.md)) |
| **Raw query** | A Cypher or Gremlin query a person writes in the Console: a static check against the agent's rules, a read-only session, a result filter, and Gremlin steps only — no scripts or lambdas ([GP-F01](os/graph/features/GP-F01-data/feature.md)) |
| **Capability** | The level under a pillar — what a person works in: Semantics · Records · Agents · Explore · Projects, the packages `semantics` · `records` · `agents` · `explore` · `projects`. In Studio Semantics is the **Model** mode and Records the **Graph Data** group of Model. The word in prose and docs; in the spec tooling its synonym is **product** — `product.md`, the `product:` key — and those files keep their names |
| **Worker pool** | The deployment's workers, in groups that share labels — the Control Plane's, [CP-F03](os/control/features/CP-F03-workers-and-the-queue/feature.md). On screen *Workers*. How each agent is doing is Agents' (`agents`), never the pool's |
| **Rule** | One statement that is always true, scoped `deployment` (an **invariant**) or `project` (a **working** rule). Offered to steps; a rule with a **check** is also enforced `block · warn · report` at the acts the check names. A **policy rule** is a line of an Access Policy, never this |
| **Library** *(runtime)* | The **definitions** a run is built from: reusable **flows**, the closed **catalogue** of functions, and projection **templates**. A code and docs word only; on screen there is no *Library* — Skills is a view of the Agents mode, Plugins a section of Settings, Team packs sit in Settings › Connections. Never the journal — that is **Runs**. |
| **Skill** | A playbook an agent may be offered — named, described, with a "when to use". Offered, never forced. On disk it is an **Agent Skills folder** — `SKILL.md` plus `references/`, `scripts/`, `assets/` — stored whole per version, and it is the source. It runs **planned** — drawn into a plan before anything runs, the plan a cache compiled from its text, never edited or exported — or **guided**, with no plan, the model following its instructions with the functions its agent may use. |
| **Versioned record** | A record whose published form is immutable, so a change mints a new **version**: a skill, a rule, a plan, an agent, a model, a standard. A draft is not a version. |
| **Change log** | Every version of every versioned record — who, when, why, the diff, the effect after. It is the Events list narrowed to the events that mint a version, never a second record. A **change** is one such event. Never "audit log" for this narrower list, never "revision history". |
| **Instructions** | A skill's or agent's `instructions.md` — the prose a person writes and owns. A flow is generated from it; nobody draws one. |
| **Workflow** | A reusable Flow — approved by the agent's named approvers, read-only, versioned, run with declared arguments, owned by the person who asked for it. A **built-in workflow** ships with Invana or a plugin (`origin = packaged`), owned by the system user. A plan may call a published workflow as a pinned `composite` step |
| **Plan** | A Flow drafted for one piece of work. The ladder an agent climbs: one function → a workflow with new arguments → a plan composed from workflows → a new plan. A plan holds no data; approving it into a workflow turns its literals into arguments |
| **Eval set** | A skill's or agent's fixed questions, each with **checks**: rule checks are hard and counted; a **judged** score comes from a pinned judge model and is labelled, never mixed with them. |
| **Pin** | An exact model version name an agent, skill version or judge thinks with — `claude-opus-5-5`, never an alias. Moving one is a change. |
| **Setup** | The *sequence* a deployment walks from installed to answering — required steps and optional ones, derived from facts and never ticked. [CP-F05](os/control/features/CP-F05-graph-databases/feature.md) |
| **Onboarding wizard** | The *surface* that walks it: the stepper and the selected step's lesson, on the graph page. Reopened any time from the graduation cap in `header.right`. Setup is the state; the onboarding wizard is where you walk it. Never "the setup wizard", never "the tour", never "onboarding flow" |
| **Setup step** | One of them. `done · next · todo · blocked · skipped · broken`. |
| **Gate** | A group of setup steps, named for what it unlocks: **Connected** · **Grounded** · **Answering**. |
| **Ready** | A deployment whose required setup steps are done. It can be asked a question. The word in the UI is **ready** — never "graduated", "complete", "live" or "onboarded". *Graduation* is the onboarding cap's metaphor and nothing else: it names no state, no badge and no API field |
| **Team** | A flat group of people, no nesting; it owns nothing and holds Access Policies, which each person on it holds |
| **Permission catalogue** | The engine's one constant of resource types, the actions each takes and who may hold a rule on it ([AC-F02](os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)); every route declares the action and resource it needs. There are no roles |
| **Owner** | Who a resource belongs to: the platform — the system user — for built-in, shared and Team pack agents and every piece of work, keeping who made it; a person for their personal agent ([AC-F07](os/access/features/AC-F07-ownership/feature.md)). Ownership grants no reach. Decisions are not owned: they are immutable and superseded |
| **System user** | The user, with no sign-in, that owns everything Invana ships |
| **Super user** | The locked built-in Access Policy — every action on every resource — written from code and held by the first account `invana createsuperuser` makes; it always has a holder |

### Models and data

| Term | Means |
|---|---|
| **Domain model** | A model authored against a domain, not a graph database — so it exports, imports and upgrades. One published version at a time. |
| **Publish review** | What a **breaking** publish goes through: a preview **migration run**, then a named approver's **approval** — never the requester's — then the migration run that publishes. An **additive** change publishes without one. Breaking means removed or narrowed, never added. |
| **Migration run** | The run a publish review is: `model-migration@1`. Previewing, it counts what a breaking change touches and which records would fail; applied, it publishes the version and lists the records that fail. **It never rewrites a record.** |
| **Anchor** | A declared link saying two types are the same entity (`Publisher.code ≡ Sponsor.publisher_code`), resolved by a key on each side. It links; it never merges. |
| **Relationship link** | A declared cross-model edge type (`Article -[MENTIONS]-> Drug`). Its endpoints come from a key on each side *or* from a load — never both. Never inferred. |
| **Global model** | The read-time union of every published model plus its links between models — the whole model. Derived, never stored, never edited. |
| **Cast** | The binding of a plan's **role** (`extract` · `decide` · `judge` · `embed`) to a model address. A resolution, not a bound — the rules are what narrow. |
| **Ledger entry** | One recorded call to an AI model, a tool or a graph database: run · step · agent · person behind · direction · target · class (`schema-only · data-bearing`) · kinds, fields and record IDs sent · response schema · tokens · keyed hashes. Reads keep the query, kinds, counts and a result hash, and IDs up to a cap; anything sent to a model or tool keeps every ID. Not a log line |
| **Stitch** | A link between models: declaring that two published models in the same graph database meet, and the Studio surface that holds them — a section in the Model view panel. An anchor and a relationship link are the two kinds. **Committing a link writes its relationships, marked with the link; removing it withdraws what it wrote.** Never across graph databases ([SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md)) |
| **Physical** | The introspected mirror of what the database actually holds. |
| **Query shape** | A query with its literal values replaced by parameters — a thousand calls of one generated query are one shape. What the model page's Performance tab groups by. Not a saved query. |
| **Records** | Externally produced data in the graph databases, conforming to exactly one model, read in place. They are the model's — there is no record between the model and its data. |
| **Load** | One bringing-in of records into one model, by upload, the CLI or the API — the citable anchor: a stable id, the file's content hash, a licence, the run that wrote it. Exported with its provenance; undoing it removes its records, keeps the load and flags what cites it. [RC-F02](capabilities/records/features/RC-F02-bring-records-in/feature.md) |
| **Derived fact** | A fact a derivation added by inference, written to a read + write graph database and labelled `derived` with its rule and version; its lineage lives in the system graph. [SE-F08](capabilities/semantics/features/SE-F08-inference/feature.md) |
| **Team pack** | A plugin of kind `pack`, in the Claude plugin layout, bundling a team's agents and skills, a model starter, meaning, taxonomies, standards, rules, Access Policy files, and project types with report templates; each piece stays owned by Semantics, Agents, Access or Projects. Installing one widens nobody's reach: its policy files wait for an Admin to apply them and its agents are granted to nobody until an Admin grants them. [CP-F02](os/control/features/CP-F02-plugins-and-outside-tools/feature.md) · [the Software delivery pack](packs/software-delivery.md) |
| **Standard** | A versioned, deployment-wide set of terms, each with a type, whether it is required, and its allowed values; a pack or org-authored. A kind or property **is held to** one pinned version. |
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
| **Flow** | A flow of Tasks — the thing that carries a Todo out. The record is `Flow` (table `flows`, route `/flows`). Three origins: `generated` · `packaged` · `promoted`. A **reusable** flow (`reusable = true`) is a **workflow** — one record, not a second kind. On screen a flow drafted for one piece of work is a **plan**, a reusable one a **workflow**, and its drawing is its **Flow** tab. |
| **Task** | One node inside a Flow: `callable` · `composite` · `human`. **Never a thing a user authors** — a Task cannot exist outside a flow. Users see *step*; the record is a `Task`. Its `key` is a plain identifier — by default its function with dots as underscores (`nl_translate`) — and is what `${steps.<key>.<output>}` binds against. |
| **Function** | One operation a Task may call, from a plugin, named **`namespace.verb`** — `graph.read.query`, `nl.translate`, `web.read_url`. A Task names it as `step_key`. One bound per function. **Deployment-wide and read-only**: code from a plugin an Admin switches on, or from a **library** whose proposed functions an Admin approves — never authored or edited in Studio; skills use them, and everyone reads them. The function catalogue is the first rung of a plan's ladder. |
| **Step** | A Task in the role of a child — the authoring format writes `steps:`. A role, not a second record. |
| **TaskRun** | One execution. Its `role` says what the execution is for: `execute` · `plan` · `evaluate`. A delegated child is a TaskRun carrying `parent_run_id`. The word is now literal — a run is a TaskRun. |
| **Kind** | What a Flow is *about*: `ask · import · bulk · stitch · model · enrich`. The subject, and what the journal filters on. Never *how* it executes — that is `form` on a Task — and never *what the run is for* — that is `role`. |
| **Catalogue** (of functions) | Engine word — `runtime/catalogue`, `GET …/catalogue/{step_key}` — for the closed set of **functions** a flow may name by `step_key`; in product copy it is just *Functions*. In the product, *Agents catalogue* is the deployment's agents and skills. The set is grouped by the bound each spends. Closed is the point: a planner that could invent a callable could escape any ceiling. |
| **Template** | Ask's answer template — a versioned, person-authored definition of how one shape of answer is drawn, mapping only fields that exist. Five ship; the deployment adds its own ([EX-F04](capabilities/explore/features/EX-F04-the-answer/feature.md)). Never a Studio folder: that is `projections/` |
| **Chain** | A run and every run delegated beneath it. It shows its worst outcome and adds up its tokens ([CP-F10](os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md)) |
| **Emission** | One thing a step produced — a subgraph, table, metric, chart or prose block. An answer is its emissions. |
| **Run frame** | One frame of a TaskRun's stream: a Task transition, a reasoning line, an emission arriving. `TaskStream` is the log of them, and its `seq` is the resume cursor. |
| **Session** | A named thread of asks, assigned to an agent. It references Todos; it is not one — a conversation never runs and has no outcome. |
| **Clarification** | A pause *inside* a Task: the agent does not know something and asks, with options. Its answer is an **answer**. A `role=plan` run raises one rather than guessing an ambiguous instruction. |
| **Approval** | A pause *before* a Task is dispatched: the agent may not proceed alone. Its answer is a **decision** — approve · reject. Nothing has been spent, and **only a person may answer one**. The same record holds anything about to leave Invana — a schedule's delivery to a channel — until a **named approver** decides; at its deadline it is *expired, not sent*, never approved. |
| **Verdict** | A pause *after* a pass produced output: the agent may not judge its own work. Its answer is a **verdict** — accept · revise, with a note bound into the next pass. The pass is already paid for, so it is bounded by `max_iterations` **and** a deadline. |
| **Iteration** | One serial pass of a `loop` node. Distinct from a **lane** (one parallel element of a fan-out) and an **attempt** (one retry of a failure). All three nest, and each is its own row. |
| **Cannot answer** | Graph Data does not hold it. Deliberately not answer-shaped, and distinct from a failure — and distinct from a **refusal**, which names the Access Policy rule that stopped it. |
| **Diagnosis** | What a failure explains about itself, with next steps drawn from evidence — never invented. |
| **Typed query plan** | What an agent writes for a question — kinds, properties, filters, hops, aggregates — from the model, never from records. The engine checks it against the model and the agent's Access Policies, then compiles it to Cypher or Gremlin per graph database. A question it cannot express is said so, with a function offered — never a silent raw query |
| **Enrich** | A run that writes derived properties or edges to a read + write graph database. Distinct from a **stitch**, which declares that two published models meet and writes only the relationships of its links. |

### Working surfaces

| Term | Means |
|---|---|
| **Board** | A named, saved, versioned working surface. One flat `kind` axis — six drawn and twelve declared, listed once in [EX-F01 › Mechanisms](capabilities/explore/features/EX-F01-the-board-and-its-canvas/feature.md#mechanisms). Whether it is *drawn* (on a canvas) or *declared* (panels bound to one record) is **`renders`**, a property of the kind — never a second column. The **plan** and **workflow** kinds both draw a `Flow` — one for a Project's Todos, one for a flow's Tasks. Never "artboard". |
| **Report** | A **frozen** declared board — the panels with the numbers as they were, stored merged so it outlives its subject. One version of a board, not a kind of its own. |
| **View panel** | The content of one shell region — `ModelViewPanel`, `InspectorViewPanel`, `AssistantViewPanel` — canvas-ui's suffix. A panel is named for the **occupant**, not for its contents: the Assistant holds sessions, so it is `AssistantViewPanel`, not `SessionsViewPanel`. A panel is *what fills* a region, never a region itself, so "the panel" alone names nothing. |
| **Section** | One collapsible, resizable part of a stacked view panel — the kit's `PanelStackSection`, with its own header, count, search and drill-in. The Agents view panel has two: **Agents** and **LLMs**. Never a *drawer*: nothing in Studio slides over anything. |
| **Soul** | Who an agent is and how it speaks — Markdown on the agent, read only by the steps whose words a person reads. Never *persona*, never *character*: a soul changes words, not what runs. |
| **Third-party** | Anything that is not from Graph Data: from an outside service — the **internet**, or an `api`, `app`, `db` or `agent` the deployment connects — or from the **model**'s own knowledge. Always badged `third-party · <source>` and always carrying its reference: the link for the internet, the locator for any other source. |
| **Inspector** | The surface that states what is selected and edits it. The canvas selects; the Inspector edits. |
| **Design kit** | `@invana/design-kit` — the shared component packages every screen is composed from, tokens only. Not a style guide |
| **Theme** | A named set of the kit's tokens — palette and density — applied across Studio: light and dark ([design-language.md › Theme](design-language.md#theme)). Not dark mode alone |
| **Annotation** | What a person or the assistant says about the graph's records — on a node, a relationship, one of its values, a set or a group of them — written to the graph database that holds the records, so every board that loads them shows it. Its kinds are the anchor's shape; never *note*, *callout* or *comment* as separate things, and never a shape drawn free on the board. |
| **Walkthrough** | A board's answers replayed one **step** at a time — each step is the reply that drew it. *Presenting* is its read-only mode. |
| **Runs** | The journal of every TaskRun in the deployment — newest first, delegated children nested under their parent. **Imports** is this journal with `kind in (import, bulk)` preselected, and a Todo's `Runs` tab is it filtered to one Todo. Never "Jobs", never "Thoughts". **This renames the surface**: *Runs* was forbidden while a run was called a thinking; now `TaskRun` is the record and the journal takes its name. The Control Plane's, [CP-F10](os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md). |
| **Events** | The tree of writes — who wrote what, on whose behalf; on screen *History*, Access's (`access`). Runs lists runs; Events lists writes. Neither is the other. |

#### The shell's regions

Seven words, and only these, name a place on screen. They are `AppLayoutV2`'s prop names — the kit
owns them, so code, docs, artboards, URLs and e2e locators all say the same thing.

| Region | Is |
|---|---|
| **`header`** | the full-width row at the top — `header.left` · `header.center` · `header.right` |
| **`leftNav`** | the labelled nav down the left — the current mode's views (icon · label · count) and the summoners at its foot; collapses to icons only ([design language § 2](design-language.md#2-the-layout)) — `leftNav.top` · `leftNav.topNavItems` · `leftNav.middle` · `leftNav.bottom` · `leftNav.bottomNavItems` |
| **`leftSection`** | the resizable left column — holds the tree of the view in front |
| **`mainSection`** | the open pages |
| **`rightSection`** | the resizable right column — the Assistant |
| **`bottomSection`** | the resizable bottom column — the Console |
| **`footer`** | the full-width status bar — `footer.left` · `footer.right` |

| Rule | |
|---|---|
| A sub-slot is written with its region | `header.right` · `leftNav.bottomNavItems` — never *the top-right* |
| A region is a slot; an **occupant** is what fills it | A region is never renamed after what is inside it today, and an occupant moves between regions without being renamed. The Console is an occupant; `bottomSection` is the region |
| A DOM id is the region's name, kebab-case, under `idPrefix` | `#graph-detail-left-section` — Studio's `idPrefix` is `graph-detail`; e2e locators use it. A board's label is the bare prop name |
| The engine never names a region | No response field, error payload or docstring says `leftSection` or *the panel*. The setup sections a deployment reports are *setup sections*, always qualified; a layout region is always the compound word |

### Projects and schedules

| Term | Means |
|---|---|
| **Project** | Any kind of work in the deployment — a folder of **Todos** in groups, with a team of people and agents, one agent its Lead agent, its **Access Policies** and relations to other projects. It never runs and has no criteria and no plan. Flat — there are no sub-projects. |
| **Todo** | One unit of work a person wrote, with a definition of done — prose, criteria, an optional assignee and due date. It has no status of its own: its state derives from its runs, and only acceptance is stored. A Todo may have no Project (the *No project* bucket) and no plan at all (a person simply does it). On screen, *Task* |
| **Project type** | What a project is deciding, and so its words: `research · investment · policy · market · investigation · general`. Changing it only relabels. |
| **Branch** | One line of inquiry inside a project. The type names it — hypothesis, thesis, option, position, lead. Forked, merged, parked, dropped; never a sub-project. |
| **Finding** | One piece of evidence on a branch, with a **stance** — `supports · contradicts · context` — and what it cites. The type may call it a signal, insight or evidence. |
| **Project decision** | A person's verdict (`supported · refuted · inconclusive`) and decision (`pursue · park · drop · merge`) on a branch, in the type's words, checked by the rules. Append-only: revisiting **supersedes**. In code `ProjectDecision`; in a project's UI just *decision* and *verdict*. Not an approval's answer and not a runtime verdict ([Asking and answering](#asking-and-answering)). |
| **Project proposal** | An agent's suggested fork or decision on a branch, or a task, group, check or relation for the project; a recommendation and an ask from another project are proposals too. A person on the team accepts or rejects it. Not an org-knowledge proposal. |
| **Project report** | A project written up from its records and published as frozen versions. Not a *Report* board ([Working surfaces](#working-surfaces)). |
| **Impact** | What a branch's option reaches over the graph, hop by hop from the records its findings cite; reach only, no what-if values. Not *blast radius* in UI copy. |
| **Simulator** | A plugin of kind `simulator` that does a domain's science, shipped in a Team pack; Invana runs it, never computes a figure itself. Its result is evidence labelled *predicted* from what-if reasoning ([Explore](capabilities/explore/product.md)). |
| **Tool plugin** | A plugin that reaches outside Invana as functions — and **every tool plugin is an MCP server**: the `web` and `mail` plugins Invana ships, run on its workers, and each outside server an Admin adds, whose tools are functions `mcp.<server>.<tool>`, reached with a shared encrypted secret or each person's own OAuth sign-in. All are listed, frozen as an Admin saw them until refreshed, versioned, run only while switched on, and run on a worker. Core and simulator plugins stay Python in the engine. [CP-F02 › Decisions](os/control/features/CP-F02-plugins-and-outside-tools/feature.md#decisions) |
| **Criterion** | One checkable statement of "done", with how it is checked: `query · agent · human`. |
| **Outcome** | A criterion's finding on one Todo, with its evidence: met · unmet · needs a human. Not a **verdict** — that is a person answering a paused Task. |
| **Dependency** | An `depends_on` edge with a condition: `success · failure · any_outcome`. Between **Todos** in a Project, and between **Tasks** in a Flow — the same concept at two altitudes. |
| **Wave** | Dependency depth. The Plan canvas groups by it. |
| **Critical path** | The longest success chain. Failure edges never inflate it. |
| **Review** | The one queue for everything waiting on a person: **clarifications, approvals and verdicts** each stop a run; results need accepting; proposals wait. |
| **Schedule** | An agent and its instructions on a cron, with where the result is delivered. A **firing** is one occurrence, recorded whether it ran or not; a **missed** firing is one the clock reached late, handled by the schedule's policy (`catch_up · run_all · skip`). One kind of schedule: whether a firing creates work a person accepts is the run's business, not the schedule's. |
| **Notification rule** | Which events reach whom, on which **channels**. A **channel** is email · Slack · Teams · webhook — never the inbox, which every rule may also write to. |
| **Inbox** | One person's notifications, with the asks waiting on them. A **notification** is one row; a **delivery** is one send to one channel. |

### Actors

| Term | Means |
|---|---|
| **Principal** | Who acted: `user · agent · system · external · anonymous`. |
| **Agent** | A principal that can be assigned work, carrying provider, model, skills, Access Policies and budget. Built and versioned in the **agents catalogue**, reusable across projects; a person uses it where they hold Run on it. Its Access Policies are a ceiling, never a grant. |
| **Agents catalogue** | The deployment's agents and skills, built and versioned there — the Agents capability (`agents`); nothing runs from it. Agents are granted to people and teams from it. [AG-F02](capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md) |
| **Built-in agent · core skill** | Shipped with the engine, versioned with its release, one instance each, owned by the system user: the **Assistant**, the **Query console**, Modeller, Coordinator, Record editor and Loader; the dialect skills (Cypher query, Gremlin query) chosen by each graph database's languages; natural-language query. Copied to customise, never edited. |
| **Budget** | The cost ceiling a run may spend — the smallest of the agent's, the plan's and the Todo's. **At the ceiling the run pauses and asks**, as an `approval`; in-flight work finishes and nothing is discarded. Never a hard stop — that is a separate `hard_ceiling`. |
| **Role** | What a TaskRun is *for*: `execute` · `plan` · `evaluate`. Planning and evaluating are roles of a run, never kinds of a plan. |
| **Delegation** | An agent handing work to an agent — a Run on `agent/<name>`. The callee acts within the project's policies, or outside a project the person behind the run, ∩ its own ceiling ∩ every caller's in the chain, narrowing at every hop, within the caller's depth, fan-out and budget. |
| **Outside agent** | An agent outside Invana, reached over A2A (its agent card) or MCP — an agent of kind `external`, outbound in the ledger and Ask by default; it takes a delegated task and returns a verdict and artifacts. Never *partner bot*. |
| **Ephemeral** | A spawned agent that retires when its work closes. Its row stays so lineage resolves. |
| **On behalf of** | The person behind a run, distinct from the agent that ran it. |
| **Personal access token** | A long-lived credential minted for a person or for a project. It acts as the key and its owner's policies together, may be narrowed further, and expires in 30, 90 or 365 days or never. Managing credentials and access needs a session, never a key. On screen a **Key**; set beside a sign-in's access token below. |
| **Approve into a workflow** | The agent's named approvers turn a plan that served into a workflow (`origin = promoted`) — for reuse, never to run it once. A multi-stage load is a workflow too; ingestion has no grammar of its own. |
| **Agent orchestrator** | What Invana is. It decides which agent takes a task, what it may run, what it is offered, in what order, and who checks the result. |
| **Job scheduler** | The role behind the runtime protocol: when a run is dispatched, retried and queued at the process level. Invana fills it itself, in process. An external one could implement the protocol; none has. |
| **Orchestration** | The first of those. Invana's. |
| **Scheduling** | The second. Invana's own today, and replaceable by design. |

| Credential | Owned by | Lives | Carries | Reaches | Ended by |
|---|---|---|---|---|---|
| **Personal access token** (a *Key*) | A person, or a project | To 30, 90 or 365 days, or never, or until revoked | The key and its owner together, optionally narrowed | What its owner may reach, narrowed by the key | Revoking it; deactivating its person; archiving or deleting its project |
| **Access token** | A sign-in | Minutes, renewed underneath by its refresh token, within the session's absolute lifetime | The person's identity | What the person may reach, through the agents they may use | Expiry; *Sign out here · Sign out everywhere* retire its refresh; reusing a retired refresh ends the session |
| **MCP client token** | A person, through the client they connected | Minutes, renewed until revoked | The person's identity, bound to the deployment's MCP server | What the person may reach, through the agents they may use | Revoking the client |

### Words code and docs do not use

| Rule | |
|---|---|
| A review greps for them | A change is reviewed with a search for the retired region words — `rail` · `sidebar` · `activity bar` · `auxiliary` · `terminal` · `drawer` · `mainContent` · a bare `panel` or `section` — and expects none. Studio's names check holds some of them ([System design § 13](system-design.md#13-delivery-and-operations)) |
| A new word gets its row | A term not in this file is added to it in the same change that first uses it; an old word is fixed where a change touches it |

| Not this | Say | Why |
|---|---|---|
| Mission · Atlas · Workspace · tenant | the **deployment**, or **Graph Data** | one deployment is everything; Graph Data is what its graph databases hold |
| A product, module or group name for a part of Invana | the **package** — `control` · `access` · `semantics` · `records` · `agents` · `explore` · `projects` | one package, one name, from spec folder to board ([How a package is named](#how-a-package-is-named)); a verb phrase is a feature's register |
| Dashboard | **Board** — a *declared* board when the difference matters | every surface is a board: drawn on a canvas or declared from panels (`renders: canvas · declared`). The kit's package is `@invana/boards` and its component `Board`. HyperDX's own dashboards keep their name, since they are that product's word, not ours |
| Intent | **Instructions** for guidance, **understanding** for the step | the word is ambiguous between the two |
| Instructions (as a prose blob) | **Rules** | guidance is a list of statements, not a paragraph |
| Acceptance criteria (as prose) | **Criteria** | each one is a node with a check |
| Approval · verdict, used for each other | the **three pauses**, by name | they differ in *when*: an approval is asked before dispatch and costs nothing to refuse; a verdict is asked after a pass and costs another one. One word for both hides the bound that follows from it |
| Accepting a **Task** vs accepting a **verdict** | **accept a result** · **accept a pass** | a result closes work somebody owns; a verdict decides whether a loop goes round again. Both are "accept" in the UI and different rows against different subjects |
| Iteration · lane · attempt, used loosely | each by its own name | serial repetition, parallel repetition, and a retry. They nest, so a sentence using the wrong one describes a different row |
| Role · permission level · access tier · Graph admin | an **Access Policy**, or an **Access template** to start one; the two drawn levels are **Admin** access and **Operator** access ([personas](personas.md#the-two-access-levels)) | there are no fixed roles; what a person may do is the Access Policies attached to them, and no part of the deployment has an admin of its own |
| Thought · Thinking | **Todo** · **TaskRun** | a load is not a thought, and the run is the thing that happens. Both words are retired |
| Job · execution · job run | **TaskRun** | one vocabulary from UI to code. There is no *job* anywhere in the product |
| Task (for a thing a user wrote) | **Todo** | **the flip.** `Task` now names a node inside a Flow and nothing else. Nothing a user authors is ever a Task |
| TaskPlan · SkillPlan · WorkflowPlan · plan-as-a-type | **Flow** | one record. Where a flow came from is `origin` and `source_skill_version_ids[]` — provenance is a column, not a type |
| Workflow (as a second record) | a **reusable flow** | *workflow* is the on-screen name of a reusable flow; *reusable* is a column on the one record |
| Callable · task type key (for what a step calls) | **Function**, named `namespace.verb` | `execute_graph_query`, `translate_thought` named the implementation; the namespace names what it touches. No alias is kept |
| `TaskRun.plan` | **`plan_snapshot`** | `plan` otherwise names the record, the frozen column, the planning **role** and a callable at once |
| `kind = plan` · `kind = work` | **`role = plan`** · **a Todo** | `kind` is the *subject* a plan is about. Planning is a role of a run; human work is a Todo, which is a type |
| Emission (for a stream frame) | **Run frame** | an emission is what a reader sees in an answer; a frame is how it travels |
| Internet (as a source) | **third party** | it named the network, not the boundary — a private warehouse is as outside Graph Data as a public API |
| Tier (of a model) | **role** | this year's *small* is last year's *frontier*; a plan says how much a decision matters, not how big the model is |
| Subgraph (for a narrowed view) | an **Access Policy** rule, or a question's filters | *subgraph* already means an [emission](#asking-and-answering), and a second meaning would make both unreadable |
| Scope (for what a run may see) | the agent's **Access Policies** | `rules.scope` already means `deployment \| project`, and one word for two bounds hides both |
| Note · callout · comment (on the board) | **Annotation** | one noun with an author; the kind is the anchor's shape |
| Playbook (for replaying a board) | **Walkthrough** | *playbook* is what a Skill is. `playbook` stays the canvas package's word for the mechanism; the product never says it about a board |
| Orchestrator, unqualified | **agent orchestrator** for what Invana is · **runtime** for the thing that interprets a plan and dispatches its Tasks | the bare word means Airflow or Temporal to most readers; qualify it the way *graph connector* is qualified |
| Graph connector | **Connector** | the package for one type of graph database; *graph database* is one connection through it. A source connector is not built |
| Source connector · pipeline | **Import** | Invana is a destination; nothing pulls data in today |
| Dataset · dataset version | **Load** (what one upload, CLI or API call brought) · **Model** (the container) | Records are loaded *into a model*; the load is the citable anchor and there is no record above it |
| Ingestion · ingest job · import job | **Import** for the surface, **import run** for one load | *ingest* claims a pull Invana does not do, and *job* is already retired above |
| Pipeline · ingestion pipeline · DAG (for a multi-stage load) | **Flow**, and its parts are **steps** | the retired sense below is a thing that *pulls* data in; this one is worse, because it implies a second orchestration concept beside the plan graph that already exists. A bundle of three files, loaded, stitched and enriched, is one flow, one run, one trace |
| Stage (for a step of a load) | **Step** | same rule as *Task*: a step is a callable the runtime dispatches, whatever a load calls it |
| Merge (for an anchor) | **Link** | anchors link; folding two nodes is lossy |
| From · To (for a stitch's two sides) | **Source** · **Target** | the payload's own words (`source_version_id`, `target_type`); *from/to* reads as direction, which an anchor does not have |
| API key · PAT | **Personal access token**, spelled out | a person's identity with a longer life, narrowed |
| Service account · service user | **Project key** | automation that is no one person's acts for a project, never as a user of its own |
| Wizard · onboarding · checklist · getting started | **Setup**, and **setup step** | nothing is walked modally, nothing is ticked and nothing is dismissed — the steps are derived, so the words for walking one are all false ([CP-F05](os/control/features/CP-F05-graph-databases/feature.md)) |
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
| MCP plugin, as a kind apart from a tool plugin | **Tool plugin** | every tool plugin is an MCP server; there is one kind of plugin that reaches outside ([CP-F02 › Decisions](os/control/features/CP-F02-plugins-and-outside-tools/feature.md#decisions)) |
| Graph token | a **Key**, narrowed | a credential that carries a scope instead of an identity is the second permission system a key is not |
| Projection template, for a Studio folder | **`projections/`** | *template* is Ask's answer template ([Template](#asking-and-answering)); a folder of Studio code is never named for it |
