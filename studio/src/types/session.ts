// ─────────────────────────────────────────────────────────────────────────────
// Session types.
//
// A "session" is a threaded conversation against a graph: the user asks
// (natural language or a query), the assistant answers. Each ask/answer is a
// pair of messages. Sessions are persisted by the engine (docs/for-developers/modules/ask/spec.md) and consumed
// here via `sessionsApi` (snake_case DTOs → these camelCase shapes). NL asks are
// translated server-side (docs/for-developers/modules/ask/features/ask-in-natural-language.md) with prior turns replayed as context
// (docs/for-developers/modules/ask/spec.md); only message metadata is stored, never result payloads.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryLanguage } from "@/types/graphs";
import type { QueryMode } from "@/types/query";
import type { RunNode } from "@/types/run";

export type SessionMessageRole = "user" | "assistant";

/** Lifecycle of an assistant reply tied to a query execution. `stopped` is
 *  written by the engine when the user cancels the run behind the reply
 *  (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). */
export type SessionMessageStatus = "running" | "ok" | "error" | "stopped";

export interface SessionMessage {
	id: string;
	role: SessionMessageRole;
	/** user: the prompt/query text. assistant: a short response summary. */
	content: string;
	createdAt: Date;
	status?: SessionMessageStatus;
	/** A canvas operation this turn records instead of a composer query (docs/for-developers/modules/explore/features/boards.md):
	 *  "expand" (node-expand / traversal) or "load" ("Load to canvas"). Set on both
	 *  rows of the pair. Undefined on a normal NL/QL turn. The thread renders these
	 *  as operation entries and excludes them from restore / composer / context. */
	operation?: "expand" | "load";
	/** How the ask was started — "nl" (translated from natural language) or "ql"
	 *  (raw query). Persisted by the engine so the composer restores the original
	 *  mode on reopen. Undefined on rows written before this field existed. */
	mode?: QueryMode;
	/** How the reply was produced — e.g. "Cypher" or the model id. */
	via?: string;
	/** Result metadata, present on assistant replies to a query. */
	rowCount?: number;
	executionTimeMs?: number;
	/** NL only — time spent translating the prompt to a query (docs/for-developers/modules/ask/features/ask-in-natural-language.md). Null on
	 *  QL and rerun, so the meta line can show LLM vs query time separately. */
	llmTimeMs?: number;
	/** NL only — the translation timeout (seconds) this ask was sent with, so the
	 *  composer can restore the user's choice when the session is reopened. */
	timeoutS?: number;
	language?: QueryLanguage;
	/** The query that produced this reply, so it can be re-run. */
	sourceQuery?: string;
	/** NL clarification only — answer options the user can pick instead of
	 *  retyping (docs/for-developers/modules/ask/features/clarifying-questions.md). Present — possibly **empty** — when the reply is a
	 *  clarifying question. Use `isClarification` rather than testing the
	 *  length: a question with nothing to pick from ("which country?") is
	 *  still a question, answered by typing. */
	clarificationOptions?: string[];
	/** 👍/👎 on this reply — a capture signal for refining understanding
	 *  (docs/for-developers/modules/ask/features/clarifying-questions.md · docs/for-developers/modules/workflows/features/promote-a-plan.md). Undefined = no vote. */
	feedback?: "up" | "down";
	/** The run that produced (or is producing) this reply (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). Its
	 *  live state is in the run store while it runs; `steps` below is the
	 *  settled trace from the record. Undefined on user rows and old replies. */
	runId?: string;
	/** The reply's task trace — one row per attempt, from its current run. */
	steps?: RunNode[];
}

/**
 * Is this reply the model asking back (docs/for-developers/modules/ask/features/clarifying-questions.md)?
 *
 * The presence of the options array is the signal, not its length — the model
 * may ask something no list can answer ("which country?", "how many hops?"),
 * and that is still a paused run waiting on the composer rather than an
 * ordinary answer.
 */
export function isClarification(message: SessionMessage): boolean {
	return Array.isArray(message.clarificationOptions);
}

/** One prior turn in the conversation context sent to the model (docs/for-developers/modules/ask/spec.md · docs/for-developers/modules/ask/features/reasoning-trace.md) —
 *  structured so the UI can lay out with hierarchy. Either a query turn (`query`
 *  set) or a clarification turn (`question` set — the model asked back, docs/for-developers/modules/ask/features/clarifying-questions.md). */
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
	/** docs/for-developers/modules/ask/spec.md — which Studio surface this session lives on. Modeller sessions
	 *  author a model draft; Explorer (default) query the graph. */
	surface?: "explorer" | "modeller";
	/** docs/for-developers/modules/ask/spec.md — the model a modeller session authors (bound on first generation
	 *  when absent). Lets the Model panel sync its canvas to the bound draft. */
	modelId?: string;
	/** docs/for-developers/modules/agents/spec.md — the agent this thread thinks through. The composer names it
	 *  where the LLM picker used to be; the agent carries provider *and* model. */
	agentId?: string;
	agentName?: string;
	/** `paused` / `retired` blocks the composer and offers the picker instead of
	 *  answering with a different mind. */
	agentStatus?: string;
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
