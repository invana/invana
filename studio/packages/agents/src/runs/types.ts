/**
 * The run page's reads, as the engine returns them
 * (docs/for-developers/modules/agents/features/the-run-page.md). Every number is
 * the engine's; the page formats it.
 */

export interface RunHead {
	id: string;
	number: number | null;
	agent_id: string | null;
	agent_name: string | null;
	status: string;
	exit_reason: string | null;
	/** `Explorer` · `Todo` · `Schedule` · `Project` · `API`. */
	origin: string | null;
	started_by_name: string | null;
	body: string | null;
	session_id: string | null;
	session_title: string | null;
	task_id: string | null;
	task_title: string | null;
	tokens: number;
	max_tokens_run: number | null;
	started_at: string | null;
	finished_at: string | null;
	duration_ms: number | null;
	can_stop: boolean;
	can_rerun: boolean;
}

export interface RunTiles {
	elapsed_ms: number | null;
	time_limit_ms: number | null;
	tokens: number;
	max_tokens_run: number | null;
	agents: number;
	depth: number;
	steps: number;
	redelivered: number;
	assets: number;
	files: number;
	branches: number;
	records_touched: number;
	writes_refused: number;
	live: number;
	queued: number;
	live_limit: number | null;
	finishing_per_minute: number;
	peak_finishing: number;
	peak_finishing_at: string | null;
	tokens_per_minute: number;
	served: number;
	not_served: number;
	eta_s: number | null;
}

export interface AgentBar {
	run_id: string;
	agent_id: string | null;
	agent_name: string;
	depth: number;
	started_at: string | null;
	finished_at: string | null;
	status: string;
	exit_reason: string | null;
	/** Its state in words — `served · 22k`, `asking for 15k`. */
	state_line: string;
	tokens: number;
}

export interface MinuteCount {
	minute: string;
	count: number;
}

interface WaitingAsk {
	approval_id: string;
	kind: string;
	line: string;
	for_you: boolean;
}

interface RoleRow {
	role: string;
	depth: number;
	agents: number;
	served: number;
	not_served: number;
	running: number;
	waiting: number;
	tokens_p50: number | null;
	tokens_p95: number | null;
	time_p95_ms: number | null;
}

export interface RunOverview {
	head: RunHead;
	tiles: RunTiles;
	/** Past 50 agents: the large-run reading. */
	large: boolean;
	agents_over_time: AgentBar[];
	steps_per_minute: MinuteCount[];
	waiting: WaitingAsk[];
	finished_per_minute: MinuteCount[];
	live_over_time: MinuteCount[];
	by_role: RoleRow[];
}

export interface RunAgentNode {
	run_id: string;
	parent_run_id: string | null;
	agent_id: string | null;
	agent_name: string;
	role: string;
	depth: number;
	status: string;
	exit_reason: string | null;
	state_line: string;
	tokens: number;
	budget: number | null;
	/** `spawned` · `delegated` · `root`. */
	how: string;
}

interface DelegationAsk {
	approval_id: string;
	from_run_id: string;
	agent_id: string | null;
	agent_name: string;
	line: string;
}

interface RoleGroup {
	role: string;
	depth: number;
	agents: number;
	by_state: Record<string, number>;
	line: string;
	cells: { run_id: string; status: string; exit_reason: string | null }[];
}

export interface RunAgents {
	origin_label: string;
	origin_line: string;
	nodes: RunAgentNode[];
	asks: DelegationAsk[];
	roles: RoleGroup[];
}

export interface RunStage {
	step_key: string;
	function: string;
	status: string;
	calls: number;
	lanes: number;
	duration_ms: number | null;
	p95_ms: number | null;
	tokens: number;
	in_count: number | null;
	out_count: number | null;
	/** The card's last line — `1 → 214 routes`. */
	line: string;
	/** What happened — `9 pages ok · 2 refused · 3 failed`. */
	summary: string;
	step_ids: string[];
}

export interface RunStages {
	stages: RunStage[];
	pruned: boolean;
}

export interface RunAsset {
	name: string;
	kind: string;
	produced_by: string;
	size_line: string;
	where: string;
	step_run_id: string | null;
	emission_id: string | null;
	task_id: string | null;
}

export interface RunTouched {
	graph: {
		type: string;
		read: number;
		written: number;
		refused: number;
		refused_line: string;
	}[];
	web: {
		domain: string;
		pages: number;
		refused: number;
		refused_line: string;
	}[];
	llm: {
		model: string;
		calls: number;
		tokens_in: number;
		tokens_out: number;
	}[];
	secrets: { name: string; used_by: string; where: string }[];
	records_touched: number;
}

/** A run page's tab — its `?tab=`. */
export type RunTab =
	| "overview"
	| "agents"
	| "stages"
	| "assets"
	| "touched"
	| "ledger";
