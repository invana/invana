/**
 * The engine's eval shapes (`/evals/<skill|agent>/<id>`): a subject's eval
 * set and its cases, one eval run with its per-case results, and the summary
 * the gate reads. Mirrors `runtime/schemas` field for field.
 */

import type { Change } from "../fleet/types";

export type EvalSubjectKind = "skill" | "agent";

export type EvalCheckKind =
	| "cites_records"
	| "names_world"
	| "cannot_answer"
	| "guardrail_holds"
	| "expected_records"
	| "max_tokens"
	| "max_latency_ms";

export interface EvalCheck {
	kind: EvalCheckKind;
	value?: string | number | string[] | null;
}

export interface EvalCase {
	id: string;
	question: string;
	checks: EvalCheck[];
	label: "passing" | "failing";
	/** `proposed` until a person accepts it; only `active` cases are replayed. */
	status: string;
	source_run_id: string | null;
	created_by_id: string | null;
	created_at: string;
}

export interface EvalCaseWrite {
	question: string;
	checks: EvalCheck[];
	label: "passing" | "failing";
}

export interface EvalSet {
	id: string | null;
	subject_kind: EvalSubjectKind;
	subject_id: string;
	judge_model_pin: string | null;
	rubric: string | null;
	cases: EvalCase[];
}

export interface EvalRunOpen {
	side?: "live" | "draft" | "both";
	version?: number | null;
	model_pin?: string | null;
	trigger?: "manual" | "publish" | "rollback" | "pin";
}

export interface EvalRunOpened {
	run_id: string;
	status: string;
	detail: string;
}

/** One side's numbers, as the engine summarised them. */
interface EvalSide {
	cases: number;
	hard_passed: number;
	hard_total: number;
	p95_ms: number | null;
	tokens: number;
	/** Tokens over cases, rounded; null over no case. */
	tokens_per_case: number | null;
	judged_mean: number | null;
}

interface EvalSummary {
	sides: Partial<Record<"live" | "draft", EvalSide>>;
	changed_answers: number;
	/** The draft against live; null on a run with one side. */
	versus_live: {
		p95_ms: Change | null;
		tokens_per_case: Change | null;
	} | null;
	gate: { verdict: "clean" | "warn" | "blocked"; reasons: string[] };
}

export interface EvalResult {
	eval_case_id: string;
	side: "live" | "draft";
	case_run_id: string | null;
	/** Check kind → `pass` · `fail`. */
	hard: Record<string, string>;
	judged: number | null;
	latency_ms: number;
	tokens: number;
	answer_digest: string;
}

export interface EvalRun {
	id: string;
	status: string;
	outcome: string | null;
	detail: string;
	triggered_by: string;
	queued_at: string | null;
	finished_at: string | null;
	params: Record<string, unknown>;
	result: { eval?: EvalSummary } | null;
	results?: EvalResult[];
}

/** The gate's refusal, as `409 detail` carries it. */
export interface EvalRefusal {
	error: "eval_required" | "eval_running" | "eval_failed" | "eval_warned";
	message: string;
	eval_run_id?: string;
	reasons?: string[];
	cases?: number;
}
