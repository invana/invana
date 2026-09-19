// ─────────────────────────────────────────────────────────────────────────────
// Thinking types (docs/for-developers/modules/ask/spec.md · docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).
//
// A session ask opens a *run*: a run of a workflow (understand → validate
// → execute → project) whose steps are recorded one row per attempt and whose
// events stream to Studio over SSE. `RunNode` is the record; `RunView`
// is what the run store keeps while a run is live, folded from the frames.
// ─────────────────────────────────────────────────────────────────────────────

import type { Emission } from "@/types/emission";
import type { QueryResponse } from "@/types/query";

export type RunStatus =
	| "queued"
	| "run"
	| "awaiting_input"
	| "succeeded"
	| "failed"
	| "cancelled";

export type RunNodeStatus =
	| "queued"
	| "running"
	| "needs_input"
	| "succeeded"
	| "failed"
	| "stopped";

export interface RunNode {
	id: string;
	runId: string;
	/** The reply this attempt ran under. */
	messageId?: string;
	seq: number;
	taskKey: string;
	/** Human label from the workflow spec — "Understand". */
	label: string;
	attempt: number;
	status: RunNodeStatus;
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

/** Live state of one run, folded from its stream (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). */
export interface RunView {
	id: string;
	sessionId: string;
	messageId: string;
	workflow?: string;
	status: RunStatus;
	steps: RunNode[];
	/** The model's rationale while Understand thinks; folds into the trace on settle. */
	reasoning?: string;
	query?: QueryProposed;
	clarification?: { question: string; options: string[] };
	result?: QueryResponse;
	diagnosis?: Diagnosis;
	/**
	 * The graph does not hold what was asked, and why
	 * (docs/for-developers/modules/ask/features/when-it-cannot-answer.md).
	 *
	 * Kept apart from `diagnosis` on purpose: a cannot-answer is an **answer** —
	 * the graph is telling you what it does not have — and a diagnosis is a
	 * failure. Folding them into one field would be the first step towards
	 * rendering them the same way (CA1).
	 */
	cannotAnswer?: { reason: string; stage?: string };
	/**
	 * The emissions this run produced, as they stream in.
	 *
	 * They are read back from the record once the run settles (AS10); this is
	 * what paints them *while* it runs, so a table appears as the next step
	 * starts rather than at the end (SW1).
	 */
	emissions?: Emission[];
	/** How the run ended, once it has: answered · cannot_answer · failed · cancelled. */
	outcome?: string;
	/** Last stream seq applied — the reconnect cursor. */
	seq: number;
}

/**
 * One frame of the run's stream — a step transition, a reasoning line, an
 * emission arriving. Not an `Emission`: that is the produced answer part a
 * reader sees, in `types/emission.ts` (docs/for-developers/terminology.md · Ask K9).
 */
export interface AskFrame {
	seq: number;
	kind: string;
	payload: Record<string, unknown>;
}

export const LIVE_THINKING_STATUSES: ReadonlySet<RunStatus> = new Set([
	"queued",
	"run",
]);
