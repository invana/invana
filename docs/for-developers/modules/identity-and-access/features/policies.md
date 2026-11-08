# Policies

A **policy** says what may be done, to which resources, within which limits. People, groups, agents
and tokens hold policies; nothing is allowed that no policy a holder has allows.

| | |
|---|---|
| Index | [11.7](../../../README.md#11--identity-and-access) · Slice **I01** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [effective access](effective-access.md) · [people and groups](people-and-groups.md) · [tokens](tokens.md) · [roles](roles.md) · [the IAM product](the-iam-product.md) · [approvals](../../operate/features/approvals.md) · products: [iam.md](../../../../products/iam.md) IAM-01 · 02 · 03 · 04 · 05 · 06 · 10 · 11 |

Product spec: [ST-F02 · People and access](../../../../../specs/foundation/settings/features/ST-F02-people-and-access/feature.md) — ST-01 · ST-02 · ST-03 · ST-05 · ST-10 · ST-11; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| `iam.policies` | Page *Policies*: kind tabs with counts, *Find a policy*, kit `Table`; *New policy* (`ActButton area="iam"`) |
| `iam.policy.statements` | Policy page, `RecordHeader variant="page"`: crumb *Policies › name*, kind badge, `vN · held by … · owner …`; *Test access* · *Edit*. Tabs **Statements** · Limits · Held by · History (`?tab=`). Statements is one table, rows grouped under a layer row (layer · its line · N rows) |
| `iam.policy.limits` | Limits table (limit · per · ceiling · used now · meter) beside *When a limit is reached* and *Agents set their own* cards |
| `iam.policy.held_by` | Kind tabs `All · People · Groups · Agents`, table kind · holder · how · attached by · ends; *Attach to…* modal (holder, for this run · N days · always) |
| History | Versions table: version · saved by · when · why · statements · limits |
| `iam.policy.draft` | The policy page of a draft: banner *Draft by the assistant — nothing changes until you save*, statements in a dashed table, Held by, *Discard* · *Review impact* |
| `iam.policy.impact` | Modal *Save name?* — holders with gains/loses, the resource and its 30-day use, a destructive line per skill that would break; *Cancel* · *Save anyway* |
| `iam.policy.test` | Modal *Test access*: Who · Started by · Does · To; the verdict line; table checked · by · says. Shot from a link carrying the check (PO19) |
| `iam.policies.denied` | A *New policy* tab for a member without iam-admin: lock, *You can read policies, not change them*, who holds iam-admin, *Open policies read-only* |
| CLI | `invana iam list · show <name> · apply <file.yaml> [--why]` |

## Engine

| Thing | Shape |
|---|---|
| `policies` | `id` · `graph_id` · `name` (unique per Graph, `[a-z0-9-]`) · `kind` managed·custom·inline·boundary · `status` draft·saved · `description` · `statements` JSON · `limits` JSON · `version` · `owner_id?` · `drafted_by` person·assistant · `created_by_id?` · `updated_by_id?` · `created_at` · `updated_at` |
| `policy_versions` | `policy_id` · `version` · `statements` · `limits` · `description` · `saved_by_id?` · `saved_at` · `why?` |
| `policy_attachments` | `policy_id` · `graph_id` · `holder_kind` person·group·agent·token · `holder_id` · `attached_by_id?` · `attached_at` · `ends_at?` · `run_id?` · `via` direct·ask · `approval_id?` |
| A statement | `{effect: "allow", actions: [glob], resources: [glob], conditions: {fields?: {only?|except?: [name]}, depth?: {max: int}, until?: ISO instant}}` |
| A resource | `graph/<Type>/<key>[ · field]` · `llm/<provider>/<model>` · `third_party/web/<host>` · `third_party/mcp/<server>/<tool>` · `third_party/mail/*` · `cache/*` · `human/*` · `agent/<name>` · `project/<key>` · `dataset/<publisher>/<name>` |
| Matching | A glob's `*` matches any run of characters, dots and slashes included. The action `llm.call` matches every function whose bound is `llm` |
| Limits | `{tokens_month?, tokens_run?, live_agents?, descendants?, depth?, worker_seconds_hour?, pools?: [name], may_ask_more?: bool}` |
| Pure evaluator | `core/policy.py` — `Statement`, `parse_statements`, `allows(statements, action=, resource=, bound=, field=, depth=, now=)`, `layer_of(resource)`, `LAYERS` |
| Managers | `apps/iam/managers`: `PolicyManager` (list · get · create · update · save · delete · versions · ensure_managed · apply_file), `HoldingsManager` (holders · attach · detach · policies_for), `GroupManager`, `ServiceAccountManager`, `IamTokenManager` |
| Reads that compose runtime | `runtime/managers/access.py`: impact · test access · effective access · limit usage — they read skills, agents, the catalogue and the ledger |
| Routes | under `/api/v1/u/{username}/{graphSlug}/iam`: `GET overview` · `GET·POST policies` · `GET·PATCH·DELETE policies/{name}` · `POST policies/{name}/save` · `POST policies/{name}/impact` · `GET policies/{name}/versions` · `GET·POST policies/{name}/holders` · `DELETE policies/{name}/holders/{id}` · `GET policies/{name}/limits` · `POST policies/drafts` · `POST test` |
| Events | `policy.create` · `policy.update` · `policy.save` · `policy.delete` · `policy.attach` · `policy.detach` — each a ledger row through the event hook |
| Area | Every `iam…` write is the `iam` area, the `iam-admin` role ([roles](roles.md)); `iam/tokens` is `ask` (anyone mints their own) and the manager refuses minting for another holder without iam-admin |

## Decisions

| # | Decision |
|---|---|
| PO2 | Six **managed** policies exist in every Graph, written by the engine and read-only: `viewer` · `contributor` · `builder` · `modeller` · `owner` · `iam-admin`. They are the Graph roles: holding `builder` is holding the role, and its statements say what a run its holder starts may do. `ensure_managed` writes them when a Graph is created and rewrites their statements on every start, so the code is their source. |
| PO3 | Managed statements: **viewer** — `graph.read.*` · `graph.stitch.preview` on `graph/*`; `llm.call` on `llm/*`; `web.*` · `science.*` · `mail.read` on `third_party/*`. **contributor** — `work.*` on `agent/*` and `project/*`; `graph.write.edits` on `graph/*`. **builder** — `work.spawn_agent` · `work.delegate` on `agent/*`. **modeller** — `graph.write.*` · `graph.stitch.*` · `model.*` · `data.*` on `graph/*`. **owner** — `*` on `*`. **iam-admin** — no function statement; it is the `iam` area. A function whose bound is `none` touches nothing and needs no statement. |
| PO4 | A resource names its layer as its first segment. The layers, in display order: `graph` (*graph data* — records in the Graph), `llm` (models it may think with), `third_party` (the web and MCP servers), `cache`, `human`, `agent` (who it may spawn and delegate to), `project`, `dataset`. The Statements table groups rows by the layer of a statement's first resource. |
| PO6 | A custom or boundary policy is created as a **draft**; a draft decides nothing — every access check skips it. A custom draft may be attached to the holders it is meant for, so its impact is drawn against them; the holding takes effect when the draft is saved. *Save* bumps the version (a draft is v0; its first save writes v1), writes a `policy_versions` row and takes effect on the next check. Editing a saved policy saves a new version at once, after its impact; there is no draft of a saved policy. |
| PO7 | **Saving shows impact.** `POST …/impact` with the candidate statements and limits returns, per holder (agents, people, and the members and agents of holding groups), each action × resource it gains or loses and the loss's ledger count over 30 days; and every bound skill whose needs the holding agent would stop covering. It also returns `writes_version`, the version the save writes, which the modal's title prints. The modal's *Save anyway* saves; *Cancel* keeps the draft. |
| PO8 | Limits live in policies. The **tightest** ceiling across a holder's policies binds. An agent's own budget, children, depth and live-at-once sit under them: saving an agent setting above a ceiling is refused, naming the policy and the ceiling. At run time the run's budget and ceilings are the smaller of the agent's and the policies'. *Used now* is computed by the engine: tokens this month and per-run p95 from settled runs of the holding agents, live agents and descendants from running runs. Worker-seconds and pools are stored and shown; Workers (F06) meters and enforces them. |
| PO10 | **Draft with the assistant** sends one sentence to `POST …/policies/drafts`; the engine asks the Graph's model once for statements in the grammar, validates them, and saves a draft with `drafted_by = assistant`, named from the sentence. Nothing is held until a person saves and attaches it. A model reply outside the grammar is refused, naming the line. |
| PO11 | **Test access** is `POST …/iam/test` with who (person · agent · token) · action · resource (with an optional `· field`) · started by · world. It runs the same evaluator dispatch runs ([effective access](effective-access.md)) and returns every layer's verdict and the first one that refuses. It writes nothing. |
| PO12 | A policy file is YAML: `name` · `kind` (custom · boundary) · `description` · `statements` · `limits`. `invana iam apply` creates or saves a new version (with `--why`), refuses a managed or inline name, and prints the impact first; `list` and `show` read. |
| PO16 | The *Policies* list's *Held by* line and counts are the engine's (`held_by` on each row); Studio prints them. Agents are counted as IAM › Agents lists them — spawned agents are not. A boundary's *What it allows* says what it keeps back (*nothing reads email or sends it out*), else the resources it leaves open. The Held by tab lists groups, then agents, people and tokens, each by name. IAM Home's policy counts are per kind with drafts, as the list's kind tabs count them. |
| PO18 | The Limits tab's rows are label · per: *Tokens* a month · *Tokens* a run (used reads `p95 <n>` over 30 days) · *Live agents* at once · *Agents a run* descendants (used reads `<n> in #<run>`, the largest live tree) · *Depth* spawn levels · *Worker-seconds* an hour · *Pools* it may use. |
| PO19 | A *Test access* link may carry its check — `?dialog=test&who=<kind>:<id>&by=<user id>&does=<action>&to=<resource>&world=<id>`. The modal opens filled and runs once when who, does and to are given; closing it drops the check from the URL. A link never writes, so a carried check is safe to open. *New token*'s minted secret has no such link — minting writes. |

## Not building

| Not building | Because |
|---|---|
| The assistant's proposal card in the conversation | the draft opens as its own tab with the banner; the conversation is the shared assistant's |
| Worker-seconds and pools enforced | Workers (F06) meters them |
