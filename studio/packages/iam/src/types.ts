/**
 * IAM's shapes as the engine returns and takes them, under
 * `/api/v1/u/{owner}/{graph}/iam` (policies.md, effective-access.md,
 * people-and-groups.md, tokens.md, the-iam-product.md). Field names are the
 * engine's; every number is the engine's, and Studio prints it.
 *
 * The engine's list pages are `…Page`; here they are `…List`, so the names
 * stay free for the pages that draw them (`PolicyList` is the engine's
 * `PolicyPage`).
 */

import type { Page } from "@invana-studio/core";

export type PolicyKindName = "managed" | "custom" | "inline" | "boundary";
export type HolderKindName = "person" | "group" | "agent" | "token";
export type Says = "allows" | "refuses" | "n/a";

// ── statements and limits ───────────────────────────────────────────────────

/** One statement as stored and sent. */
export interface StatementIn {
	effect?: "allow";
	actions: string[];
	resources: string[];
	conditions?: Record<string, unknown>;
}

export interface StatementRead {
	effect: "allow";
	actions: string[];
	resources: string[];
	conditions: Record<string, unknown>;
	/** The layer the Statements table groups it under. */
	layer: string;
}

/** A layer row of the Statements table. */
export interface LayerRead {
	layer: string;
	label: string;
	line: string;
}

export interface Limits {
	tokens_month: number | null;
	tokens_run: number | null;
	live_agents: number | null;
	descendants: number | null;
	depth: number | null;
	worker_seconds_hour: number | null;
	pools: string[];
	may_ask_more: boolean;
}

// ── policies ────────────────────────────────────────────────────────────────

/** Who holds a policy, counted by the engine. */
export interface HeldBy {
	people: number;
	groups: number;
	agents: number;
	tokens: number;
	/** `group fare-team · 4 agents` · `12 people` · `the whole Graph`. */
	line: string;
}

export interface PolicyRow {
	id: string;
	name: string;
	kind: PolicyKindName;
	status: "draft" | "saved";
	/** What it allows. */
	summary: string;
	statement_count: number;
	held_by: HeldBy;
	changed_by: string | null;
	changed_at: string | null;
}

export interface PolicyRead extends PolicyRow {
	description: string;
	version: number;
	owner: string | null;
	drafted_by: "person" | "assistant";
	statements: StatementRead[];
	layers: LayerRead[];
	limits: Limits;
	/** The Graph area a managed policy may change (`build` for builder); null otherwise. */
	area: string | null;
	/** Whether the caller may change it — false for a managed policy or without iam-admin. */
	editable: boolean;
}

export interface PolicyCreate {
	name: string;
	kind?: "custom" | "boundary";
	description?: string;
	statements?: StatementIn[];
	limits?: Partial<Limits>;
}

export interface PolicyUpdate {
	description?: string | null;
	statements?: StatementIn[] | null;
	limits?: Partial<Limits> | null;
	why?: string | null;
}

export interface PolicySave {
	why?: string | null;
}

/** Draft with the assistant: one sentence. */
export interface PolicyDraftRequest {
	prompt: string;
}

export interface PolicyVersionRead {
	version: number;
	saved_by: string | null;
	saved_at: string;
	why: string | null;
	statement_count: number;
	limit_count: number;
}

/** The engine's `PolicyPage`. */
export interface PolicyList extends Page<PolicyRow> {
	/** Counts per kind over the unfiltered list, for the kind tabs. */
	kinds: Record<string, number>;
}

// ── impact ──────────────────────────────────────────────────────────────────

export interface ImpactRequest {
	statements: StatementIn[];
	limits?: Partial<Limits> | null;
}

export interface ImpactRow {
	holder_kind: "person" | "agent";
	holder_id: string;
	name: string;
	change: "gains" | "loses" | "same";
	/** `action on resource`, or `nothing new`. */
	what: string;
	/** Ledger rows for the lost pair over 30 days; null for a gain. */
	used_30d: number | null;
	used_line: string;
}

export interface ImpactBreak {
	agent_id: string;
	agent: string;
	skill_id: string;
	skill: string;
	version: number | null;
	needs: string;
	line: string;
}

export interface ImpactRead {
	policy: string;
	version: number;
	holders_line: string;
	rows: ImpactRow[];
	breaks: ImpactBreak[];
}

// ── holders ─────────────────────────────────────────────────────────────────

export interface HolderRow {
	/** The attachment id; null for a managed policy held as a member's role. */
	id: string | null;
	kind: HolderKindName;
	holder_id: string;
	name: string;
	/** `sam · lee · 2 more` for a group, `built in Agents` for an agent. */
	line: string;
	/** `direct` · `via fare-team` · `direct · for run #2316` · `role`. */
	how: string;
	attached_by: string | null;
	attached_at: string | null;
	ends_at: string | null;
	/** `when run #2316 ends` · `in 6 days` · null for always. */
	ends_line: string | null;
}

/** The engine's `HolderPage`. */
export interface HolderList extends Page<HolderRow> {
	kinds: Record<string, number>;
}

export interface AttachRequest {
	holder_kind: "person" | "group" | "agent";
	holder_id: string;
	ends?: "run" | "days" | "always";
	days?: number | null;
	run_id?: string | null;
}

// ── limits ──────────────────────────────────────────────────────────────────

export interface LimitRow {
	key: string;
	label: string;
	per: string;
	ceiling: number | string[] | null;
	/** The engine's reading now. */
	used: number | null;
	used_line: string;
	/** 0 to 100 for the meter; null when there is no ceiling or no reading. */
	share: number | null;
}

export interface LimitsRead {
	rows: LimitRow[];
	may_ask_more: boolean;
	/** Who an ask for more goes to. */
	asks_go_to: string | null;
}

// ── test access ─────────────────────────────────────────────────────────────

export interface AccessCheckRequest {
	principal_kind: "person" | "agent" | "token";
	principal_id: string;
	action: string;
	/** `graph/Fare/LHR-JFK · price` — a field after ` · ` is optional. */
	resource: string;
	started_by?: string | null;
	world_id?: string | null;
	run_id?: string | null;
}

export interface PrincipalRef {
	kind: string;
	id: string | null;
	name: string;
}

export interface AccessCheckLayer {
	layer: "policies" | "started_by" | "world" | "boundary" | "token";
	label: string;
	by: PrincipalRef[];
	says: Says;
	reason: string;
}

export interface AccessCheckRead {
	allowed: boolean;
	decided_by: string | null;
	message: string;
	layers: AccessCheckLayer[];
}

// ── agents and effective access ─────────────────────────────────────────────

export interface AgentAccessRow {
	agent_id: string;
	name: string;
	kind: string;
	version: number;
	policies: string[];
	functions_allowed: number;
	refused_7d: number;
	/** `1 · send` — the count and the commonest refused function's kind. */
	refused_line: string;
	owner: string | null;
}

/** The engine's `AgentAccessPage`. */
export interface AgentAccessList extends Page<AgentAccessRow> {
	kinds: Record<string, number>;
}

export interface HeldPolicy {
	id: string;
	name: string;
	kind: PolicyKindName;
	summary: string;
	owner: string | null;
	how: string;
}

export interface EffectiveRow {
	action: string;
	resource: string;
	layer: string;
	bound: string | null;
	needs: boolean;
	policies: Says;
	started_by: Says;
	world: Says;
	boundary: Says;
	effective: "allowed" | "refused";
	why: string;
}

export interface Delegate {
	agent_id: string;
	name: string;
	kind: string;
	by_policy: string | null;
	may: "always" | "ask" | "never";
}

export interface EffectiveRead {
	agent_id: string;
	agent: string;
	kind: string;
	owner: string | null;
	started_by: PrincipalRef | null;
	world: PrincipalRef | null;
	policies: HeldPolicy[];
	layers: LayerRead[];
	rows: EffectiveRow[];
	delegates: Delegate[];
	allowed: number;
	refused: number;
}

/** Whose start, which world and which run the effective reading is for. */
export interface EffectiveQuery {
	started_by?: string;
	run_id?: string;
	world_id?: string;
}

interface ChainLink {
	kind: string;
	id?: string | null;
	name: string;
}

/** One refused ledger row of an agent — the ledger's row shape. */
export interface RefusalRow {
	id: string;
	seq: number;
	at: string;
	actor_kind: string;
	actor_chain: ChainLink[];
	act: string;
	layer: string;
	touched: string;
	touched_line: string;
	verdict: string;
	refused_by: string | null;
	rule: string;
	run_id: string | null;
	step_run_id: string | null;
	run_number: number | null;
	where: string;
}

export type RefusalList = Page<RefusalRow>;

// ── people, groups, service accounts ────────────────────────────────────────

export interface PersonRow {
	user_id: string;
	username: string;
	name: string;
	email: string | null;
	kind: "person" | "service";
	groups: string[];
	policies: string[];
	tokens: number;
	signs_in_with: string;
	description: string | null;
}

/** The engine's `PeoplePage`. */
export interface PeopleList extends Page<PersonRow> {
	kinds: Record<string, number>;
}

export interface ServiceAccountCreate {
	username: string;
	description?: string;
}

export interface GroupMemberRef {
	id: string;
	member_kind: "person" | "agent";
	member_id: string;
	name: string;
}

export interface GroupRow {
	id: string;
	name: string;
	description: string;
	people: string[];
	agents: string[];
	policies: string[];
	people_count: number;
	agents_count: number;
}

export interface GroupRead extends GroupRow {
	members: GroupMemberRef[];
}

export type GroupList = Page<GroupRow>;

export interface GroupCreate {
	name: string;
	description?: string;
}

export interface GroupUpdate {
	description?: string | null;
}

export interface GroupMemberAdd {
	member_kind: "person" | "agent";
	member_id: string;
}

// ── tokens ──────────────────────────────────────────────────────────────────

export interface TokenHolder {
	user_id: string;
	username: string;
	kind: "person" | "service";
}

export interface IamTokenRow {
	id: string;
	name: string;
	last_four: string;
	holder: TokenHolder;
	/** True for a token minted in this Graph's IAM; false for a profile token. */
	graph_bound: boolean;
	/** `inline · graph.read.*` · `all of ravi's`. */
	narrowed_to: string;
	policy: string | null;
	statements: StatementRead[];
	expires_at: string | null;
	last_used_at: string | null;
	created_at: string;
	expired: boolean;
}

export type IamTokenList = Page<IamTokenRow>;

export interface IamTokenCreate {
	name: string;
	/** A service account of this Graph; the caller when absent. */
	holder_id?: string | null;
	statements?: StatementIn[];
	/** One of the deployment's choices; null is never. */
	expires_in_days?: number | null;
}

/** A minted token — the secret is shown once. */
export interface IamTokenCreated extends IamTokenRow {
	secret: string;
}

// ── home ────────────────────────────────────────────────────────────────────

export interface OverviewRead {
	people: number;
	service_accounts: number;
	groups: number;
	agents: number;
	/** Per kind: `managed` · `custom` · `inline` · `boundary`. */
	policies: Record<string, number>;
	tokens_live: number;
	tokens_expiring_week: number;
}
