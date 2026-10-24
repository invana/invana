/**
 * The ledger's reads, as the engine returns them
 * (docs/for-developers/modules/operate/features/the-ledger.md). Every count is
 * the engine's.
 */

export interface ChainLink {
	kind: string;
	id?: string | null;
	name: string;
}

export interface LedgerRow {
	id: string;
	seq: number;
	at: string;
	actor_kind: string;
	actor_chain: ChainLink[];
	act: string;
	layer: string;
	touched: string;
	touched_line: string;
	/** `allowed` · `refused` · `approval` · `held`. */
	verdict: string;
	refused_by: string | null;
	rule: string;
	run_id: string | null;
	step_run_id: string | null;
	run_number: number | null;
	where: string;
}

export interface LedgerPage {
	items: LedgerRow[];
	total: number;
	next_cursor?: string | null;
	applied?: unknown;
	/** Rows in these filters the reader may not see — counted, not shown. */
	hidden: number;
}

export interface LedgerStats {
	since: string;
	acts: number;
	acts_7d_mean: number | null;
	acts_change_pct: number | null;
	people: number;
	people_acts: number;
	agents: number;
	agent_acts: number;
	spawned: number;
	refused: number;
	refused_by: Record<string, number>;
	waiting_approvals: number;
	presets: { key: string; label: string; count: number }[];
	hidden: number;
}

export interface LedgerRowDetail {
	row: LedgerRow;
	custody: { kind: string; name: string; line: string }[];
	args: Record<string, unknown>;
	hash: string;
	prev_hash: string;
	verified: boolean;
	verified_at: string | null;
	around: LedgerRow[];
}

/** A generic counted row: `key` and up to three counts, plus a line. */
export interface CountRow {
	key: string;
	a: number;
	b: number;
	c: number;
	line: string;
}

export interface LedgerActor {
	actor: string;
	name: string;
	since: string;
	acts: number;
	writes: number;
	writes_refused: number;
	third_party: number;
	secrets: number;
	secret_names: string[];
	refused: number;
	refused_by: Record<string, number>;
	/** type · read · written · refused. */
	graph: CountRow[];
	/** domain · reads · refused. */
	web: CountRow[];
	/** model · calls · tokens. */
	llm: CountRow[];
	/** agent · acts; `line` is how (spawned · delegated). */
	acted_through: CountRow[];
}

export interface LedgerRecord {
	address: string;
	since: string;
	acts: number;
	reads: number;
	writes: number;
	writes_line: string;
	refused: number;
	refused_line: string;
	people: number;
	agents: number;
	rows: LedgerRow[];
	can_see: { worlds: string[]; people: string; agents: string; can_write: string };
}

export interface LedgerRefusals {
	refused_today: number;
	acts_today: number;
	share_pct: number | null;
	by_grant: number;
	by_lens: number;
	by_ceiling: number;
	by_robots: number;
	by_day: { day: string; refused: number }[];
	/** function · refused; `line` is the rule. */
	top_functions: CountRow[];
	by_rule: {
		rule: string;
		refused_by: string;
		today: number;
		what: string;
		who: string;
		the_rule: string;
	}[];
}

export interface LedgerExport {
	id: string;
	requested_by_name: string | null;
	filters_line: string;
	format: string;
	rows: number;
	created_at: string;
}

export interface LedgerIntegrity {
	verified_at: string | null;
	ok: boolean;
	last_seq: number;
	broken_seq: number | null;
	retention_days: number;
	rows: number;
}

/** A Ledger tab — the path's last segment. */
export type LedgerTab = "rows" | "actor" | "record" | "refusals" | "export";
