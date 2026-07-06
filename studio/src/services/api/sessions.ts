// ─────────────────────────────────────────────────────────────────────────────
// Sessions API client (RFC-024).
//
// The engine speaks snake_case DTOs; the Studio UI consumes the camelCase
// `Session` / `SessionMessage` shapes (with `Date`s). Mapping happens here so
// the panel/composer/thread components stay unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryLanguage } from "../../types/graphs";
import type { QueryResponse } from "../../types/query";
import type {
	Session,
	SessionContextTurn,
	SessionMessage,
} from "../../types/session";
import { request } from "./client";

// ── Wire DTOs (snake_case, as the engine returns) ────────────────────────────

interface ApiMessage {
	id: string;
	session_id: string;
	seq: number;
	role: "user" | "assistant";
	content: string;
	status?: "running" | "ok" | "error" | null;
	operation?: "expand" | "load" | null;
	mode?: "nl" | "ql" | null;
	via?: string | null;
	query_language?: string | null;
	source_query?: string | null;
	clarification_options?: string[] | null;
	feedback?: "up" | "down" | null;
	row_count?: number | null;
	execution_time_ms?: number | null;
	llm_time_ms?: number | null;
	timeout_s?: number | null;
	node_count?: number | null;
	edge_count?: number | null;
	created_at: string;
}

interface ApiSummary {
	id: string;
	graph_id: string;
	// RFC-031 — which Studio surface this session lives on, and (modeller only)
	// the model it authors.
	surface?: "explorer" | "modeller" | null;
	model_id?: string | null;
	title: string;
	pinned: boolean;
	archived: boolean;
	llm_provider_id?: string | null;
	message_count: number;
	node_count: number;
	edge_count: number;
	last_status?: "running" | "ok" | "error" | null;
	created_at: string;
	updated_at: string;
}

interface ApiDetail extends ApiSummary {
	messages: ApiMessage[];
}

interface ApiListResponse {
	items: ApiSummary[];
	total: number;
}

interface ApiSendResponse {
	user_message: ApiMessage;
	assistant_message: ApiMessage;
	result: QueryResponse | null;
}

interface ApiRerunResponse {
	message: ApiMessage;
	result: QueryResponse;
}

/** What the composer collects, normalized for the engine. */
export interface SendMessageBody {
	content: string;
	mode: "ql" | "nl";
	language?: QueryLanguage;
	/** nl only — which LLM provider translates the prompt (RFC-030). */
	llm_provider_id?: string;
	/** nl only — seconds to wait on the LLM translation before giving up. */
	timeout_s?: number;
}

/** A client-driven canvas operation to log as a session turn (RFC-046). Only
 *  "Load to canvas" today — the engine records expands itself. */
export interface RecordOperationBody {
	kind: "load";
	source_query?: string;
	query_language?: QueryLanguage;
	row_count?: number;
	node_count: number;
	edge_count: number;
	execution_time_ms?: number;
}

/** List ordering — newest by last activity (default) or by creation. */
export type SessionSort = "updated" | "created";

/** Server-side list controls (pinned always float to the top regardless). */
export interface SessionListOptions {
	limit?: number;
	offset?: number;
	sort?: SessionSort;
	includeArchived?: boolean;
	/** RFC-031 — list only one surface's sessions (Explorer vs Modeller). */
	surface?: "explorer" | "modeller";
}

/** Body for creating a session — title plus (RFC-031) optional surface + model
 *  binding. A modeller session with no model_id binds on its first generation. */
export interface SessionCreateBody {
	title?: string;
	surface?: "explorer" | "modeller";
	model_id?: string;
}

/** Partial update for a session — rename and/or toggle pin/archive. */
export interface SessionUpdateBody {
	title?: string;
	pinned?: boolean;
	archived?: boolean;
}

export interface SessionListResult {
	items: Session[];
	total: number;
}

export interface SendMessageResult {
	userMessage: SessionMessage;
	assistantMessage: SessionMessage;
	result: QueryResponse | null;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toMessage(m: ApiMessage): SessionMessage {
	return {
		id: m.id,
		role: m.role,
		content: m.content,
		createdAt: new Date(m.created_at),
		status: m.status ?? undefined,
		operation: m.operation ?? undefined,
		mode: m.mode ?? undefined,
		via: m.via ?? undefined,
		rowCount: m.row_count ?? undefined,
		executionTimeMs: m.execution_time_ms ?? undefined,
		llmTimeMs: m.llm_time_ms ?? undefined,
		timeoutS: m.timeout_s ?? undefined,
		language: (m.query_language as QueryLanguage | null) ?? undefined,
		sourceQuery: m.source_query ?? undefined,
		clarificationOptions: m.clarification_options ?? undefined,
		feedback: m.feedback ?? undefined,
	};
}

function toSession(s: ApiSummary, messages: SessionMessage[] = []): Session {
	return {
		id: s.id,
		title: s.title,
		messages,
		createdAt: new Date(s.created_at),
		updatedAt: new Date(s.updated_at),
		pinned: s.pinned,
		archived: s.archived,
		surface: s.surface ?? undefined,
		modelId: s.model_id ?? undefined,
		nodeCount: s.node_count,
		edgeCount: s.edge_count,
		lastStatus: s.last_status ?? undefined,
		llmProviderId: s.llm_provider_id ?? undefined,
	};
}

function toDetail(d: ApiDetail): Session {
	return toSession(d, d.messages.map(toMessage));
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/sessions`;

export const sessionsApi = {
	list: async (
		username: string,
		graphSlug: string,
		opts?: SessionListOptions,
	): Promise<SessionListResult> => {
		const params = new URLSearchParams();
		if (opts?.limit != null) params.set("limit", String(opts.limit));
		if (opts?.offset != null) params.set("offset", String(opts.offset));
		if (opts?.sort != null) params.set("sort", opts.sort);
		if (opts?.includeArchived) params.set("include_archived", "true");
		if (opts?.surface != null) params.set("surface", opts.surface);
		const qs = params.toString();
		const data = await request<ApiListResponse>(
			`${base(username, graphSlug)}${qs ? `?${qs}` : ""}`,
		);
		return { items: data.items.map((s) => toSession(s)), total: data.total };
	},

	get: async (
		username: string,
		graphSlug: string,
		id: string,
	): Promise<Session> =>
		toDetail(await request<ApiDetail>(`${base(username, graphSlug)}/${id}`)),

	create: async (
		username: string,
		graphSlug: string,
		body?: SessionCreateBody,
	): Promise<Session> =>
		toDetail(
			await request<ApiDetail>(base(username, graphSlug), {
				method: "POST",
				body: JSON.stringify(body ?? {}),
			}),
		),

	// Partial update — rename and/or toggle pin/archive. The engine treats every
	// field as optional, so callers send just the bit they're changing.
	update: async (
		username: string,
		graphSlug: string,
		id: string,
		body: SessionUpdateBody,
	): Promise<Session> =>
		toSession(
			await request<ApiSummary>(`${base(username, graphSlug)}/${id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),

	sendMessage: async (
		username: string,
		graphSlug: string,
		id: string,
		body: SendMessageBody,
		signal?: AbortSignal,
	): Promise<SendMessageResult> => {
		const data = await request<ApiSendResponse>(
			`${base(username, graphSlug)}/${id}/messages`,
			{
				method: "POST",
				body: JSON.stringify(body),
				signal,
			},
		);
		return {
			userMessage: toMessage(data.user_message),
			assistantMessage: toMessage(data.assistant_message),
			result: data.result,
		};
	},

	rerunMessage: async (
		username: string,
		graphSlug: string,
		id: string,
		messageId: string,
		signal?: AbortSignal,
	): Promise<{ message: SessionMessage; result: QueryResponse }> => {
		const data = await request<ApiRerunResponse>(
			`${base(username, graphSlug)}/${id}/messages/${messageId}/run`,
			{ method: "POST", signal },
		);
		return { message: toMessage(data.message), result: data.result };
	},

	// The conversation context (prior turns) the model was given for an assistant
	// reply (RFC-036/040). Recomputed server-side; empty for a first turn.
	getMessageContext: async (
		username: string,
		graphSlug: string,
		id: string,
		messageId: string,
		signal?: AbortSignal,
	): Promise<SessionContextTurn[]> =>
		request<SessionContextTurn[]>(
			`${base(username, graphSlug)}/${id}/messages/${messageId}/context`,
			{ signal },
		),

	// Log a client-driven canvas operation ("Load to canvas") as a session turn
	// (RFC-046). Returns the recorded user+assistant pair (unused by the caller,
	// which refetches the thread).
	recordOperation: async (
		username: string,
		graphSlug: string,
		id: string,
		body: RecordOperationBody,
	): Promise<void> => {
		await request<{ user_message: ApiMessage; assistant_message: ApiMessage }>(
			`${base(username, graphSlug)}/${id}/operations`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	},

	// Record (or clear) a 👍/👎 vote on an assistant reply (RFC-038/039).
	setFeedback: async (
		username: string,
		graphSlug: string,
		id: string,
		messageId: string,
		value: "up" | "down" | null,
	): Promise<SessionMessage> => {
		const data = await request<ApiMessage>(
			`${base(username, graphSlug)}/${id}/messages/${messageId}/feedback`,
			{ method: "POST", body: JSON.stringify({ value }) },
		);
		return toMessage(data);
	},
};
