// ─────────────────────────────────────────────────────────────────────────────
// Thinkings API client (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): read, resume, cancel, and the SSE tail.
//
// The tail is a native `EventSource` with the access token as `?token=` — the
// same pattern as the audit-event live tail (`useEventStream`): the browser
// can't set headers on SSE, and the engine accepts the query param as an
// Authorization fallback. `Last-Event-ID` is sent by the browser on reconnect,
// so a dropped connection replays from where it left off.
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE_URL, request } from "@/services/api/client";
import type { Emission, EmissionKind, TemplateOffer } from "@/types/emission";
import type { QueryResponse } from "@/types/query";
import type { AskFrame, RunNode, RunNodeStatus, RunStatus } from "@/types/run";
import type { SessionMessage } from "@/types/session";
import type { ThinkingListResponse } from "@/types/work";

// ── Wire DTOs ────────────────────────────────────────────────────────────────

export interface ApiThinkingStep {
	id: string;
	run_id: string;
	message_id?: string | null;
	seq: number;
	task_key: string;
	label: string;
	attempt: number;
	status: RunNodeStatus;
	started_at?: string | null;
	finished_at?: string | null;
	detail?: string | null;
	input?: Record<string, unknown> | null;
	output?: Record<string, unknown> | null;
	error?: RunNode["error"] | null;
	tokens_in?: number | null;
	tokens_out?: number | null;
}

interface ApiThinking {
	id: string;
	run_id: string;
	graph_id: string;
	workflow_key: string;
	status: RunStatus;
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
	status: RunStatus;
	assistantMessageId?: string;
	streamSeq: number;
	steps: RunNode[];
}

export function toRunNode(s: ApiThinkingStep): RunNode {
	return {
		id: s.id,
		runId: s.run_id,
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
export function stepFromFrame(p: Record<string, unknown>): RunNode {
	return toRunNode({
		id: String(p.step_id),
		run_id: "",
		message_id: (p.message_id as string | null) ?? null,
		seq: Number(p.seq),
		task_key: String(p.task_key),
		label: String(p.label),
		attempt: Number(p.attempt ?? 1),
		status: p.status as RunNodeStatus,
		started_at: (p.started_at as string | null) ?? null,
		finished_at: (p.finished_at as string | null) ?? null,
		detail: (p.detail as string | null) ?? "",
		input: (p.input as Record<string, unknown> | null) ?? null,
		output: (p.output as Record<string, unknown> | null) ?? null,
		error: (p.error as RunNode["error"] | null) ?? null,
		tokens_in: (p.tokens_in as number | null) ?? null,
		tokens_out: (p.tokens_out as number | null) ?? null,
	});
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/runs`;

// Every kind the runtime emits — `EventSource` needs a listener per event name.
export const EMISSION_KINDS = [
	"run.started",
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
	"run.done",
	"run.cancelled",
] as const;

export const TERMINAL_KINDS: ReadonlySet<string> = new Set([
	"run.done",
	"run.cancelled",
	"clarification.requested",
]);

export interface ThinkingStreamHandle {
	close: () => void;
}

export const runsApi = {
	/**
	 * Runs as list rows — an agent's recent plans, the library's candidates, or
	 * the journal filtered by kind. One endpoint with filters, because every one
	 * of those is "which runs match this?" and splitting them would give
	 * *served* two definitions to drift apart.
	 */
	list: (
		username: string,
		graphSlug: string,
		filters: {
			agentId?: string;
			taskId?: string;
			/** One kind of work — `ask`, `import`, `bulk`. */
			kind?: string;
			candidates?: boolean;
			limit?: number;
		} = {},
	) => {
		const params = new URLSearchParams();
		if (filters.agentId) params.set("agent_id", filters.agentId);
		if (filters.taskId) params.set("task_id", filters.taskId);
		if (filters.kind) params.set("kind", filters.kind);
		if (filters.candidates) params.set("candidates", "true");
		if (filters.limit) params.set("limit", String(filters.limit));
		const q = params.toString();
		return request<ThinkingListResponse>(
			`${base(username, graphSlug)}${q ? `?${q}` : ""}`,
		);
	},

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
			steps: d.steps.map(toRunNode),
		};
	},

	/** Answer a clarification — the same run continues (UC7). */
	resume: (username: string, graphSlug: string, id: string, answer: string) =>
		request<{
			run_id: string;
			user_message: unknown;
			assistant_message: unknown;
		}>(`${base(username, graphSlug)}/${id}/resume`, {
			method: "POST",
			body: JSON.stringify({ answer }),
		}),

	/** Stop run (UC9). */
	cancel: (username: string, graphSlug: string, id: string) =>
		request<{ id: string; status: RunStatus }>(
			`${base(username, graphSlug)}/${id}/cancel`,
			{ method: "POST" },
		),

	/**
	 * Tail a run's stream from `after`. `onFrame` receives every frame in
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
			onFrame: (e: AskFrame) => void;
			onError?: () => void;
		},
	): ThinkingStreamHandle => {
		const url =
			`${API_BASE_URL}${base(username, graphSlug)}/${id}/stream` +
			`?after=${opts.after}&token=${encodeURIComponent(opts.token)}`;
		const es = new EventSource(url);
		const handle = { close: () => es.close() };
		const onFrame = (ev: MessageEvent<string>) => {
			let frame: AskFrame;
			try {
				frame = JSON.parse(ev.data) as AskFrame;
			} catch {
				return;
			}
			opts.onFrame(frame);
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
export function messageFromFrame(
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
		runId: (p.run_id as string | null) ?? undefined,
	};
}

export type { QueryResponse };

// ── Emissions and the trace (the-answer-surface.md · reasoning-trace.md) ─────

interface ApiTemplateOffer {
	template_id: string;
	name: string;
	surface: string;
	version: number;
	available: boolean;
	reason: string | null;
}

interface ApiEmission {
	id: string;
	seq: number;
	kind: EmissionKind;
	payload: Record<string, unknown>;
	template_id: string | null;
	citation: {
		query?: string | null;
		query_language?: string | null;
		record_count?: number;
		execution_time_ms?: number | null;
	};
	message_id: string | null;
	templates: ApiTemplateOffer[];
}

/**
 * Fold the engine's row into the emission the card renders.
 *
 * The kind comes from the row, never from the payload's shape: the producing
 * step declared it (AS2), and re-deriving it here would be a second opinion.
 */
function toEmission(row: ApiEmission): Emission {
	const offers: TemplateOffer[] = row.templates.map((t) => ({
		templateId: t.template_id,
		name: t.name,
		surface: t.surface,
		version: t.version,
		available: t.available,
		reason: t.reason,
	}));
	const chosen = offers.find((t) => t.templateId === row.template_id);
	const base = {
		id: row.id,
		seq: row.seq,
		citation: {
			recordCount: row.citation.record_count ?? 0,
			query: row.citation.query ?? undefined,
			queryLanguage: row.citation.query_language ?? undefined,
			executionTimeMs: row.citation.execution_time_ms ?? undefined,
		},
		// Absent until a projection chose the rendering — never defaulted in so
		// the header looks complete (AS9).
		template: chosen
			? { id: chosen.templateId, name: chosen.name, version: chosen.version }
			: undefined,
		templates: offers,
	};
	const p = row.payload as Record<string, never>;
	switch (row.kind) {
		case "table":
			return { ...base, kind: "table", rows: (p.rows ?? []) as never };
		case "subgraph":
			return {
				...base,
				kind: "subgraph",
				data: p.data as never,
				onCanvas: Boolean(p.on_canvas),
			};
		case "metric":
			return {
				...base,
				kind: "metric",
				value: String(p.value ?? "—"),
				label: p.label as string | undefined,
				comparison: p.comparison as string | undefined,
			};
		case "chart":
			return {
				...base,
				kind: "chart",
				caption: p.caption as string | undefined,
				series: (p.series ?? []) as never,
			};
		case "prose":
			return {
				...base,
				kind: "prose",
				text: String(p.text ?? ""),
				citations: (p.citations ?? []) as never,
			};
		default:
			return {
				...base,
				kind: "empty",
				statement: String(p.statement ?? ""),
			};
	}
}

export const emissionsApi = {
	/** The answer this run produced — records, so it survives a reload (AS10). */
	list: async (
		username: string,
		graphSlug: string,
		runId: string,
	): Promise<Emission[]> => {
		const rows = await request<ApiEmission[]>(
			`${base(username, graphSlug)}/${runId}/emissions`,
		);
		return rows.map(toEmission);
	},

	/** Re-render the same records through another template — never a re-run (P5). */
	switchTemplate: async (
		username: string,
		graphSlug: string,
		runId: string,
		emissionId: string,
		templateId: string | null,
	): Promise<Emission> => {
		const row = await request<ApiEmission>(
			`${base(username, graphSlug)}/${runId}/emissions/${emissionId}/template`,
			{ method: "POST", body: JSON.stringify({ template_id: templateId }) },
		);
		return toEmission(row);
	},
};

export const traceApi = {
	/** The whole run, after the fact — part of the answer, not an admin view (RT1). */
	get: (username: string, graphSlug: string, runId: string) =>
		request<TraceRead>(`${base(username, graphSlug)}/${runId}/trace`),
};

/** The trace, as the engine returns it. */
export interface TraceRead {
	run_id: string;
	workflow_key: string;
	status: string;
	/** The ask this run carries — `nl` · `ql` · `import`. */
	ask_kind: string | null;
	/** What it was about, in the words the opener wrote — the dashboard's crumb. */
	body: string | null;
	/** The run's own `result.json` — null until the runtime writes one (SR34). */
	result: Record<string, unknown> | null;
	outcome: string | null;
	agent_id: string | null;
	agent_version: number | null;
	/** `authored:<id>` · `generated` · `reused:<id>` · `template:<key>@<v>`. */
	plan_origin: string | null;
	plan_revision: number;
	started_at: string | null;
	finished_at: string | null;
	duration_ms: number | null;
	tokens_in: number;
	tokens_out: number;
	/** The run's spend — `null` when no step had a published rate (SR40). */
	cost_usd: number | null;
	/** The ceiling it ran under, so spend draws against it (SR41 · SR20). */
	budget: RunBudget | null;
	steps: TraceStepRead[];
	emissions: ApiEmission[];
	error: Record<string, unknown> | null;
}

export interface TraceStepRead {
	id: string;
	seq: number;
	attempt: number;
	task_key: string;
	label: string;
	status: string;
	detail: string;
	started_at: string | null;
	finished_at: string | null;
	duration_ms: number | null;
	tokens_in: number | null;
	tokens_out: number | null;
	/** What this step spent — `null` when the model has no published rate. */
	cost_usd: number | null;
	input: Record<string, unknown> | null;
	output: Record<string, unknown> | null;
	error: Record<string, unknown> | null;
	/** The arguments this attempt ran with, after `${…}` binding (SR33). */
	args: Record<string, unknown> | null;
	/** What it spends, from the catalogue entry its `task_key` names. */
	bound: string | null;
	/** The plan's own id for this node, and the lane it ran in. */
	step_key: string | null;
	lane: string | null;
	/** This task run's `result.json` — null until the runtime writes one. */
	result: Record<string, unknown> | null;
	skills_offered: string[];
	skills_applied: string[];
	/**
	 * The run this node delegated, if it delegated one.
	 *
	 * `child_run_id` is the engine's name for it — the field was read as
	 * `child_thinking_id` here, so the delegated child never rendered.
	 */
	child_run_id: string | null;
}

/**
 * The agent's effective ceiling, as the trace carries it (SR41).
 *
 * Either half may be `null`: a bound nobody set has no meter, and a meter
 * against a ceiling that does not exist is the thing [SR20] warns about.
 */
export interface RunBudget {
	max_tokens: number | null;
	max_cost_usd: number | null;
}

// ── Projection templates (projections.md § 5 — the templates page) ──────────

export interface ProjectionTemplateRead {
	id: string;
	graph_id: string | null;
	name: string;
	kind: "prompt" | "result";
	surface: string;
	accepts: Record<string, unknown>;
	spec: Record<string, unknown>;
	intent: string;
	version: number;
	status: "draft" | "published";
	/** How many emissions it rendered — what a promotion is argued from (P7). */
	used: number;
	/** Ships with Invana: belongs to every Graph, editable by none. */
	shipped: boolean;
}

function templatesBase(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/projection-templates`;
}

export const projectionTemplatesApi = {
	list: (username: string, graphSlug: string) =>
		request<ProjectionTemplateRead[]>(templatesBase(username, graphSlug)),
	create: (
		username: string,
		graphSlug: string,
		body: {
			name: string;
			kind?: "prompt" | "result";
			surface: string;
			accepts?: Record<string, unknown>;
			spec?: Record<string, unknown>;
			intent?: string;
		},
	) =>
		request<ProjectionTemplateRead>(templatesBase(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(body),
		}),
	publish: (username: string, graphSlug: string, id: string) =>
		request<ProjectionTemplateRead>(
			`${templatesBase(username, graphSlug)}/${id}/publish`,
			{ method: "POST" },
		),
	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${templatesBase(username, graphSlug)}/${id}`, {
			method: "DELETE",
		}),
};
