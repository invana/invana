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

/** Lifecycle of an assistant reply tied to a query execution. */
export type SessionMessageStatus = "running" | "ok" | "error";

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
	/** Running totals across the session, for the list meta line. */
	nodeCount: number;
	edgeCount: number;
}
