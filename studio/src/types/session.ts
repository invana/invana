// ─────────────────────────────────────────────────────────────────────────────
// Session types.
//
// A "session" is a threaded conversation against a graph: the user asks
// (natural language or a query), the assistant answers. Each ask/answer is a
// pair of messages. Sessions are persisted by the engine (RFC-024) and consumed
// here via `sessionsApi` (snake_case DTOs → these camelCase shapes). NL asks are
// translated server-side (RFC-030) with prior turns replayed as context
// (RFC-036); only message metadata is stored, never result payloads.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryLanguage } from "./graphs";
import type { QueryMode } from "./query";

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
	/** How the ask was started — "nl" (translated from natural language) or "ql"
	 *  (raw query). Persisted by the engine so the composer restores the original
	 *  mode on reopen. Undefined on rows written before this field existed. */
	mode?: QueryMode;
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
	/** NL clarification only — answer options the user can pick instead of
	 *  retyping (RFC-038). Present when the reply is a clarifying question. */
	clarificationOptions?: string[];
	/** 👍/👎 on this reply — a capture signal for refining understanding
	 *  (RFC-038/039). Undefined = no vote. */
	feedback?: "up" | "down";
}

/** One prior turn in the conversation context sent to the model (RFC-036/040) —
 *  structured so the UI can lay out with hierarchy. Either a query turn (`query`
 *  set) or a clarification turn (`question` set — the model asked back, RFC-038). */
export interface SessionContextTurn {
	prompt: string;
	query: string;
	rationale: string;
	question: string;
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
