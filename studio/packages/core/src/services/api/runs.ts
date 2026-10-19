// ─────────────────────────────────────────────────────────────────────────────
// Thinkings API client (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): read, resume, cancel, and the SSE tail.
//
// The tail is a native `EventSource` with the access token as `?token=` — the
// same pattern as the audit-event live tail (`useEventStream`): the browser
// can't set headers on SSE, and the engine accepts the query param as an
// Authorization fallback. `Last-Event-ID` is sent by the browser on reconnect,
// so a dropped connection replays from where it left off.
// ─────────────────────────────────────────────────────────────────────────────

import { ROOT_CONTEXT } from "@opentelemetry/api";
import type {
	Emission,
	EmissionKind,
	TemplateOffer,
} from "../../types/emissions";
import type {
	AskFrame,
	OfferedRule,
	RunNode,
	RunNodeStatus,
	RunStats,
	RunStatsQuery,
	RunStatus,
	TaskRunListResponse,
} from "../../types/runs";
import type { SessionMessage } from "../../types/sessions";
import { recordStreamReconnect } from "../telemetry/metrics";
import { type Interaction, withTraceparent } from "../telemetry/tracer";
import { API_BASE_URL, request } from "./client";

// ── Wire DTOs ────────────────────────────────────────────────────────────────

export interface ApiTaskRunStep {
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
	duration_ms?: number | null;
	detail?: string | null;
	input?: Record<string, unknown> | null;
	output?: Record<string, unknown> | null;
	error?: RunNode["error"] | null;
	tokens_in?: number | null;
	tokens_out?: number | null;
	tokens?: number | null;
}

interface ApiTaskRun {
	id: string;
	run_id: string;
	graph_id: string;
	workflow_key: string;
	/** The run this row is a step of; null on a root. */
	parent_run_id?: string | null;
	status: RunStatus;
	assistant_message_id?: string | null;
	queued_at?: string | null;
	started_at?: string | null;
	finished_at?: string | null;
	work_ms?: number | null;
	steps_done?: number;
	steps_total?: number;
	run_tokens_in?: number | null;
	run_tokens_out?: number | null;
	error?: Record<string, unknown> | null;
	/** The trace the run recorded under; null when telemetry was off. */
	trace_id?: string | null;
	stream_seq: number;
	/** The ask a root carries — `nl` · `ql` · `import`; null on a step. */
	ask_kind?: string | null;
	/** The provider's version name the run called; null for one that called none. */
	model_version?: string | null;
	/** The root run this one re-ran. */
	rerun_of_run_id?: string | null;
	steps: ApiTaskRunStep[];
}

export interface TaskRun {
	id: string;
	workflowKey: string;
	status: RunStatus;
	assistantMessageId?: string;
	streamSeq: number;
	steps: RunNode[];
	/** The engine's stored time its steps worked; absent until it settles. */
	workMs?: number;
	/** Steps that succeeded, of the plan's length so far — the engine's count. */
	stepsDone: number;
	stepsTotal: number;
	/** The run's spend, its own and its steps', as the engine sums it. */
	runTokensIn?: number;
	runTokensOut?: number;
	/** The run this row is a step of; absent on a root. */
	parentRunId?: string;
	/** The ask a root carries — `nl` · `ql` · `import`. */
	askKind?: string;
	/** The exact model version the run called; absent for one that called none. */
	modelVersion?: string;
	/** The root run this one re-ran. */
	rerunOfRunId?: string;
}

/** Which versions a re-run replays: the ones the run recorded, or today's. */
export type RerunVersions = "same" | "current";

/** A re-run, opened: the new root run, linked to the one it re-ran. */
export interface RunRerunResult {
	runId: string;
	rerunOfRunId: string;
	/** The model version the new run will call; absent for one that calls none. */
	modelVersion?: string;
}

export function toRunNode(s: ApiTaskRunStep): RunNode {
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
		durationMs: s.duration_ms ?? undefined,
		detail: s.detail ?? "",
		input: s.input ?? undefined,
		output: s.output ?? undefined,
		error: s.error ?? undefined,
		tokensIn: s.tokens_in ?? undefined,
		tokensOut: s.tokens_out ?? undefined,
		tokens: s.tokens ?? undefined,
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
		duration_ms: (p.duration_ms as number | null) ?? null,
		detail: (p.detail as string | null) ?? "",
		input: (p.input as Record<string, unknown> | null) ?? null,
		output: (p.output as Record<string, unknown> | null) ?? null,
		error: (p.error as RunNode["error"] | null) ?? null,
		tokens_in: (p.tokens_in as number | null) ?? null,
		tokens_out: (p.tokens_out as number | null) ?? null,
		tokens: (p.tokens as number | null) ?? null,
	});
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/runs`;

// Every kind the runtime emits — `EventSource` needs a listener per event name.
const EMISSION_KINDS = [
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
	// One per engagement, carrying the whole touch — the ledger row
	// `run_touches` projects. The boards read the projection through
	// `…/runs/{id}/touches`; this is the live copy, and the fold ignores it.
	"touch",
	"diagnosis",
	"run.done",
	"run.cancelled",
] as const;

const TERMINAL_KINDS: ReadonlySet<string> = new Set([
	"run.done",
	"run.cancelled",
	"clarification.requested",
]);

export interface RunStreamHandle {
	close: () => void;
}

/** A stats read's query: the window, the reader's zone, and the kinds. */
function statsParams({ days, kinds }: RunStatsQuery): string {
	const params = new URLSearchParams();
	if (days) params.set("days", String(days));
	params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
	for (const kind of kinds ?? []) params.append("kind", kind);
	return params.toString();
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
		return request<TaskRunListResponse>(
			`${base(username, graphSlug)}${q ? `?${q}` : ""}`,
		);
	},

	/** The journal's tiles for one Graph, counted by the engine in the reader's days. */
	stats: (username: string, graphSlug: string, query: RunStatsQuery = {}) =>
		request<RunStats>(
			`${base(username, graphSlug)}/stats?${statsParams(query)}`,
		),

	/** The same tiles over every Graph the reader is a member of. */
	installStats: (query: RunStatsQuery = {}) =>
		request<RunStats>(`/api/v1/runs/stats?${statsParams(query)}`),

	get: async (
		username: string,
		graphSlug: string,
		id: string,
	): Promise<TaskRun> => {
		const d = await request<ApiTaskRun>(`${base(username, graphSlug)}/${id}`);
		return {
			id: d.id,
			workflowKey: d.workflow_key,
			status: d.status,
			assistantMessageId: d.assistant_message_id ?? undefined,
			streamSeq: d.stream_seq,
			steps: d.steps.map(toRunNode),
			workMs: d.work_ms ?? undefined,
			stepsDone: d.steps_done ?? 0,
			stepsTotal: d.steps_total ?? 0,
			runTokensIn: d.run_tokens_in ?? undefined,
			runTokensOut: d.run_tokens_out ?? undefined,
			// `task_runs` is one table, so this is how a **step** names the run
			// whose trace it is in — the one read a step board opened cold makes
			// before it reads anything else.
			parentRunId: d.parent_run_id ?? undefined,
			askKind: d.ask_kind ?? undefined,
			modelVersion: d.model_version ?? undefined,
			rerunOfRunId: d.rerun_of_run_id ?? undefined,
		};
	},

	/**
	 * Re-run a settled ask as a new root run — on the versions it recorded
	 * (`same`) or on today's (`current`). The original is never touched; a
	 * version no longer offered is a 409 whose message names it.
	 */
	rerun: async (
		username: string,
		graphSlug: string,
		id: string,
		versions: RerunVersions,
	): Promise<RunRerunResult> => {
		const d = await request<{
			run_id: string;
			rerun_of_run_id: string;
			model_version?: string | null;
		}>(`${base(username, graphSlug)}/${id}/rerun`, {
			method: "POST",
			body: JSON.stringify({ versions }),
		});
		return {
			runId: d.run_id,
			rerunOfRunId: d.rerun_of_run_id,
			modelVersion: d.model_version ?? undefined,
		};
	},

	/** Answer a clarification — the same run continues. */
	resume: (username: string, graphSlug: string, id: string, answer: string) =>
		request<{
			run_id: string;
			user_message: unknown;
			assistant_message: unknown;
		}>(`${base(username, graphSlug)}/${id}/resume`, {
			method: "POST",
			body: JSON.stringify({ answer }),
		}),

	/** Stop run. */
	cancel: (
		username: string,
		graphSlug: string,
		id: string,
		action?: Interaction,
	) =>
		request<{ id: string; status: RunStatus }>(
			`${base(username, graphSlug)}/${id}/cancel`,
			{ method: "POST", action },
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
			/** The action this tail belongs to; its trace continues on the stream. */
			action?: Interaction;
			onFrame: (e: AskFrame) => void;
			onError?: () => void;
		},
	): RunStreamHandle => {
		const url = withTraceparent(
			`${API_BASE_URL}${base(username, graphSlug)}/${id}/stream` +
				`?after=${opts.after}&token=${encodeURIComponent(opts.token)}`,
			opts.action?.ctx ?? ROOT_CONTEXT,
		);
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
			// drop it will recover from with Last-Event-ID, counted as a reconnect.
			if (es.readyState === EventSource.CONNECTING)
				recordStreamReconnect("run");
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
		workMs: (p.work_ms as number | null) ?? undefined,
		llmTimeMs: (p.llm_time_ms as number | null) ?? undefined,
		timeoutS: (p.timeout_s as number | null) ?? undefined,
		language: (p.query_language as SessionMessage["language"]) ?? undefined,
		sourceQuery: (p.source_query as string | null) ?? undefined,
		canvasQuery: (p.canvas_query as string | null) ?? undefined,
		clarificationOptions:
			(p.clarification_options as string[] | null) ?? undefined,
		clarificationDescriptions:
			(p.clarification_descriptions as string[] | null) ?? undefined,
		feedback: (p.feedback as SessionMessage["feedback"]) ?? undefined,
		runId: (p.run_id as string | null) ?? undefined,
	};
}

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
 * step declared it, and re-deriving it here would be a second opinion.
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
		// the header looks complete.
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
	/** The answer this run produced — records, so it survives a reload. */
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

	/** Re-render the same records through another template — never a re-run. */
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
	/** The whole run, after the fact — part of the answer, not an admin view. */
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
	/** What it was about, in the words the opener wrote — the board's crumb. */
	body: string | null;
	/** The run's own `result.json` — null until the runtime writes one. */
	result: Record<string, unknown> | null;
	outcome: string | null;
	agent_id: string | null;
	agent_version: number | null;
	/** `authored:<id>` · `generated` · `reused:<id>` · `template:<key>@<v>`. */
	plan_origin: string | null;
	plan_revision: number;
	/** What opened the run — `user` · `schedule` · `task` · `delegation`. */
	triggered_by: string;
	/** The person it ran for, by username; `null` when no person is on record. */
	opened_by: string | null;
	/** Questions asked and re-plans spent — read against `budget`. */
	clarifications: number;
	replans: number;
	/**
	 * The world this run was asked under, and its name **as frozen**.
	 *
	 * Both `null` reads `Everything`, which is a real world and the default one
	 * — never a blank, which would read as *not recorded*. The name comes from
	 * `lens_snapshot`, so renaming a world does not change what a run that
	 * already happened says it ran under.
	 */
	lens_id: string | null;
	lens_name: string | null;
	/** The record `lens_name` was read from — what the name opens. */
	lens_ref: { id: string; kind: "world" | "guardrail" } | null;
	/** Whether the run froze a lens. `false` — nothing it engaged was recorded. */
	governed: boolean;
	/** The trace the run recorded under; null when telemetry was off. */
	trace_id?: string | null;
	started_at: string | null;
	finished_at: string | null;
	/** The engine's stored timing — formatted, never derived. */
	duration_ms: number | null;
	queue_ms: number | null;
	work_ms: number | null;
	ask_ms: number | null;
	wait_ms: number | null;
	tokens_in: number;
	tokens_out: number;
	/** The run's whole spend — stored once it settles. */
	tokens: number;
	/** The run's spend — `null` when no step had a published rate. */
	cost_usd: number | null;
	/** The ceiling it ran under, so spend draws against it. */
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
	/** From the run's start to this step's start — the log's offset. */
	offset_ms: number | null;
	/** This step's duration over the run's, from 0 to 1. */
	share_of_run: number | null;
	tokens_in: number | null;
	tokens_out: number | null;
	tokens: number | null;
	/** This step's tokens over the run's, from 0 to 1. */
	share_of_run_tokens: number | null;
	/** What this step spent — `null` when the model has no published rate. */
	cost_usd: number | null;
	input: Record<string, unknown> | null;
	output: Record<string, unknown> | null;
	error: Record<string, unknown> | null;
	/** The arguments this attempt ran with, after `${…}` binding. */
	args: Record<string, unknown> | null;
	/** What it spends, from the catalogue entry its `task_key` names. */
	bound: string | null;
	/** The attempts this step was allowed — what `attempts 2 of 3` reads against. */
	max_attempts: number;
	/** The plan's own id for this node, and the lane it ran in. */
	step_key: string | null;
	lane: string | null;
	/** This task run's `result.json` — null until the runtime writes one. */
	result: Record<string, unknown> | null;
	skills_offered: string[];
	skills_applied: string[];
	/** The statements this step was offered, and the ones it claims it cited. */
	rules_offered: OfferedRule[];
	rules_cited: OfferedRule[];
	/**
	 * The run this node delegated, if it delegated one.
	 *
	 * `child_run_id` is the engine's name for it — the field was read as
	 * `child_thinking_id` here, so the delegated child never rendered.
	 */
	child_run_id: string | null;
}

/**
 * The agent's effective ceiling, as the trace carries it.
 *
 * Either half may be `null`: a bound nobody set has no meter, and a meter
 * against a ceiling that does not exist is the thing [ ] warns about.
 */
interface RunBudget {
	/** The run's token budget. */
	max_tokens_run?: number | null;
	max_tokens_month?: number | null;
	/** The run budget's older name — what a run from before both windows carries. */
	max_tokens: number | null;
	max_clarifications?: number | null;
	max_replans?: number | null;
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
	/** How many emissions it rendered — what a promotion is argued from. */
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
