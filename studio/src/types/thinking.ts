// ─────────────────────────────────────────────────────────────────────────────
// Thinking types (RFC-048 / RFC-055).
//
// A session ask opens a *thinking*: a run of a workflow (understand → validate
// → execute → project) whose steps are recorded one row per attempt and whose
// events stream to Studio over SSE. `ThinkingStep` is the record; `ThinkingView`
// is what the thinking store keeps while a run is live, folded from emissions.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryResponse } from "./query";

export type ThinkingStatus =
	| "queued"
	| "thinking"
	| "awaiting_input"
	| "succeeded"
	| "failed"
	| "cancelled";

export type ThinkingStepStatus =
	| "queued"
	| "running"
	| "needs_input"
	| "succeeded"
	| "failed"
	| "stopped";

export interface ThinkingStep {
	id: string;
	thinkingId: string;
	/** The reply this attempt ran under. */
	messageId?: string;
	seq: number;
	taskKey: string;
	/** Human label from the workflow spec — "Understand". */
	label: string;
	attempt: number;
	status: ThinkingStepStatus;
	startedAt?: Date;
	finishedAt?: Date;
	/** The one-liner on the step row — "proposed Cypher · 5 lines". */
	detail: string;
	/** Trace: digests and small facts, never raw payloads. */
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
	error?: { cls?: string; cause?: string; message?: string; raw?: string };
	tokensIn?: number;
	tokensOut?: number;
	/** Why the attempt after this one was scheduled — "timeout". Live only. */
	retryReason?: string;
}

export interface QueryProposed {
	query: string;
	language: string;
	rationale?: string;
	via?: string;
}

export interface Diagnosis {
	cause: string;
	summary: string;
	evidence?: Record<string, unknown>;
	suggestions: {
		label: string;
		action?: {
			retry?: boolean;
			focus_composer?: boolean;
			rethink_with?: string;
		};
		route?: string;
	}[];
	retryable: boolean;
}

/** Live state of one thinking, folded from its stream (RFC-055 § 9.4). */
export interface ThinkingView {
	id: string;
	sessionId: string;
	messageId: string;
	workflow?: string;
	status: ThinkingStatus;
	steps: ThinkingStep[];
	/** The model's rationale while Understand thinks; folds into the trace on settle. */
	reasoning?: string;
	query?: QueryProposed;
	clarification?: { question: string; options: string[] };
	result?: QueryResponse;
	diagnosis?: Diagnosis;
	/** Last stream seq applied — the reconnect cursor. */
	seq: number;
}

/** One frame of the thinking's stream. */
export interface Emission {
	seq: number;
	kind: string;
	payload: Record<string, unknown>;
}

export const LIVE_THINKING_STATUSES: ReadonlySet<ThinkingStatus> = new Set([
	"queued",
	"thinking",
]);
