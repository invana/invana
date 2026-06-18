// ─────────────────────────────────────────────────────────────────────────────
// Session types — frontend-only for now.
//
// A "session" is a threaded conversation against a graph: the user asks
// (natural language or a query), the assistant answers. Each ask/answer is a
// pair of messages. This lives entirely in Studio state today — the engine
// still speaks the single-shot `/query` endpoint; backend naming + persistence
// land later.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryLanguage } from "./graphs";

export type SessionMessageRole = "user" | "assistant";

/** Lifecycle of an assistant reply tied to a query execution. `stopped` is
 *  client-only — set when the user aborts an in-flight run (the engine never
 *  returns it). */
export type SessionMessageStatus = "running" | "ok" | "error" | "stopped";

export interface SessionMessage {
	id: string;
	role: SessionMessageRole;
	/** user: the prompt/query text. assistant: a short response summary. */
	content: string;
	createdAt: Date;
	status?: SessionMessageStatus;
	/** How the reply was produced — e.g. "Cypher" or the model id. */
	via?: string;
	/** Result metadata, present on assistant replies to a query. */
	rowCount?: number;
	executionTimeMs?: number;
	/** NL only — time spent translating the prompt to a query (RFC-030). Null on
	 *  QL and rerun, so the meta line can show LLM vs query time separately. */
	llmTimeMs?: number;
	/** NL only — the translation timeout (seconds) this ask was sent with, so the
	 *  composer can restore the user's choice when the session is reopened. */
	timeoutS?: number;
	language?: QueryLanguage;
	/** The query that produced this reply, so it can be re-run. */
	sourceQuery?: string;
}

export interface Session {
	id: string;
	title: string;
	messages: SessionMessage[];
	createdAt: Date;
	updatedAt: Date;
	/** Pinned sessions sort to the top of the list. */
	pinned: boolean;
	/** Archived sessions are hidden from the default list. */
	archived: boolean;
	/** Running totals across the session, for the list meta line. */
	nodeCount: number;
	edgeCount: number;
	/**
	 * Status of the latest assistant reply, denormalized by the engine so the
	 * list row can show failed/running without loading the session's messages
	 * (the list summary carries no messages). Undefined until the first reply.
	 */
	lastStatus?: SessionMessageStatus;
	/**
	 * Which LLM provider produced this session, when applicable. The engine
	 * doesn't record this yet (NL queries aren't wired), so it's undefined
	 * today — the list's "filter by LLM" control reads it forward-lookingly.
	 */
	llmProviderId?: string;
}
