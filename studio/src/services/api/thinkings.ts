// ─────────────────────────────────────────────────────────────────────────────
// Thinkings API client (RFC-055 § 9.3): read, resume, cancel, and the SSE tail.
//
// The tail is a native `EventSource` with the access token as `?token=` — the
// same pattern as the audit-event live tail (`useEventStream`): the browser
// can't set headers on SSE, and the engine accepts the query param as an
// Authorization fallback. `Last-Event-ID` is sent by the browser on reconnect,
// so a dropped connection replays from where it left off.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryResponse } from "../../types/query";
import type { SessionMessage } from "../../types/session";
import type {
	Emission,
	ThinkingStatus,
	ThinkingStep,
	ThinkingStepStatus,
} from "../../types/thinking";
import { API_BASE_URL, request } from "./client";

// ── Wire DTOs ────────────────────────────────────────────────────────────────

export interface ApiThinkingStep {
	id: string;
	thinking_id: string;
	message_id?: string | null;
	seq: number;
	task_key: string;
	label: string;
	attempt: number;
	status: ThinkingStepStatus;
	started_at?: string | null;
	finished_at?: string | null;
	detail?: string | null;
	input?: Record<string, unknown> | null;
	output?: Record<string, unknown> | null;
	error?: ThinkingStep["error"] | null;
	tokens_in?: number | null;
	tokens_out?: number | null;
}

interface ApiThinking {
	id: string;
	thought_id: string;
	graph_id: string;
	workflow_key: string;
	status: ThinkingStatus;
	assistant_message_id?: string | null;
	queued_at?: string | null;
	started_at?: string | null;
	finished_at?: string | null;
	error?: Record<string, unknown> | null;
	stream_seq: number;
	steps: ApiThinkingStep[];
}

export interface Thinking {
	id: string;
	workflowKey: string;
	status: ThinkingStatus;
	assistantMessageId?: string;
	streamSeq: number;
	steps: ThinkingStep[];
}

export function toThinkingStep(s: ApiThinkingStep): ThinkingStep {
	return {
		id: s.id,
		thinkingId: s.thinking_id,
		messageId: s.message_id ?? undefined,
		seq: s.seq,
		taskKey: s.task_key,
		label: s.label,
		attempt: s.attempt,
		status: s.status,
		startedAt: s.started_at ? new Date(s.started_at) : undefined,
		finishedAt: s.finished_at ? new Date(s.finished_at) : undefined,
		detail: s.detail ?? "",
		input: s.input ?? undefined,
		output: s.output ?? undefined,
		error: s.error ?? undefined,
		tokensIn: s.tokens_in ?? undefined,
		tokensOut: s.tokens_out ?? undefined,
	};
}

/** A step as the stream carries it (the runtime's `_step_payload`). */
export function stepFromEmission(p: Record<string, unknown>): ThinkingStep {
	return toThinkingStep({
		id: String(p.step_id),
		thinking_id: "",
		message_id: (p.message_id as string | null) ?? null,
		seq: Number(p.seq),
		task_key: String(p.task_key),
		label: String(p.label),
		attempt: Number(p.attempt ?? 1),
		status: p.status as ThinkingStepStatus,
		started_at: (p.started_at as string | null) ?? null,
		finished_at: (p.finished_at as string | null) ?? null,
		detail: (p.detail as string | null) ?? "",
		input: (p.input as Record<string, unknown> | null) ?? null,
		output: (p.output as Record<string, unknown> | null) ?? null,
		error: (p.error as ThinkingStep["error"] | null) ?? null,
		tokens_in: (p.tokens_in as number | null) ?? null,
		tokens_out: (p.tokens_out as number | null) ?? null,
	});
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/thinkings`;

// Every kind the runtime emits — `EventSource` needs a listener per event name.
export const EMISSION_KINDS = [
	"thinking.started",
	"step.started",
	"step.progress",
	"step.retrying",
	"step.needs_input",
	"step.finished",
	"reasoning",
	"query.proposed",
	"clarification.requested",
	"result",
	"diagnosis",
	"thinking.done",
	"thinking.cancelled",
] as const;

export const TERMINAL_KINDS: ReadonlySet<string> = new Set([
	"thinking.done",
	"thinking.cancelled",
	"clarification.requested",
]);

export interface ThinkingStreamHandle {
	close: () => void;
}

export const thinkingsApi = {
	get: async (
		username: string,
		graphSlug: string,
		id: string,
	): Promise<Thinking> => {
		const d = await request<ApiThinking>(`${base(username, graphSlug)}/${id}`);
		return {
			id: d.id,
			workflowKey: d.workflow_key,
			status: d.status,
			assistantMessageId: d.assistant_message_id ?? undefined,
			streamSeq: d.stream_seq,
			steps: d.steps.map(toThinkingStep),
		};
	},

	/** Answer a clarification — the same thinking continues (UC7). */
	resume: (username: string, graphSlug: string, id: string, answer: string) =>
		request<{
			thinking_id: string;
			user_message: unknown;
			assistant_message: unknown;
		}>(`${base(username, graphSlug)}/${id}/resume`, {
			method: "POST",
			body: JSON.stringify({ answer }),
		}),

	/** Stop thinking (UC9). */
	cancel: (username: string, graphSlug: string, id: string) =>
		request<{ id: string; status: ThinkingStatus }>(
			`${base(username, graphSlug)}/${id}/cancel`,
			{ method: "POST" },
		),

	/**
	 * Tail a thinking's stream from `after`. `onEmission` receives every frame in
	 * order; the handle closes itself after a terminal kind. `onError` fires when
	 * the browser gives up reconnecting (it retries transient drops on its own).
	 */
	stream: (
		username: string,
		graphSlug: string,
		id: string,
		opts: {
			token: string;
			after: number;
			onEmission: (e: Emission) => void;
			onError?: () => void;
		},
	): ThinkingStreamHandle => {
		const url =
			`${API_BASE_URL}${base(username, graphSlug)}/${id}/stream` +
			`?after=${opts.after}&token=${encodeURIComponent(opts.token)}`;
		const es = new EventSource(url);
		const handle = { close: () => es.close() };
		const onFrame = (ev: MessageEvent<string>) => {
			let frame: Emission;
			try {
				frame = JSON.parse(ev.data) as Emission;
			} catch {
				return;
			}
			opts.onEmission(frame);
			if (TERMINAL_KINDS.has(frame.kind)) es.close();
		};
		for (const kind of EMISSION_KINDS) es.addEventListener(kind, onFrame);
		es.onerror = () => {
			// CLOSED means the browser stopped retrying (or the server ended the
			// stream without a terminal frame we saw); CONNECTING is a transient
			// drop it will recover from with Last-Event-ID.
			if (es.readyState === EventSource.CLOSED) opts.onError?.();
		};
		return handle;
	},
};

/** Narrow the `message` payload a terminal frame carries into a SessionMessage. */
export function messageFromEmission(
	p: Record<string, unknown> | undefined,
): SessionMessage | null {
	if (!p || typeof p.id !== "string") return null;
	return {
		id: p.id,
		role: (p.role as "user" | "assistant") ?? "assistant",
		content: String(p.content ?? ""),
		createdAt: p.created_at ? new Date(String(p.created_at)) : new Date(),
		status: (p.status as SessionMessage["status"]) ?? undefined,
		operation: (p.operation as SessionMessage["operation"]) ?? undefined,
		mode: (p.mode as SessionMessage["mode"]) ?? undefined,
		via: (p.via as string | null) ?? undefined,
		rowCount: (p.row_count as number | null) ?? undefined,
		executionTimeMs: (p.execution_time_ms as number | null) ?? undefined,
		llmTimeMs: (p.llm_time_ms as number | null) ?? undefined,
		timeoutS: (p.timeout_s as number | null) ?? undefined,
		language: (p.query_language as SessionMessage["language"]) ?? undefined,
		sourceQuery: (p.source_query as string | null) ?? undefined,
		clarificationOptions:
			(p.clarification_options as string[] | null) ?? undefined,
		feedback: (p.feedback as SessionMessage["feedback"]) ?? undefined,
		thinkingId: (p.thinking_id as string | null) ?? undefined,
	};
}

export type { QueryResponse };
