import { timelineFor } from "@/pages/graphs-detail/features/ask/assistant/SessionTasksView";
import { SessionThreadWelcome } from "@/pages/graphs-detail/features/ask/assistant/SessionThreadWelcome";
import {
	AssistantTurn,
	PromptTurn,
} from "@/pages/graphs-detail/features/ask/assistant/SessionTurn";
import { useRunStore } from "@/stores/run.store";
import type { QueryResponse } from "@/types/query";
import {
	type Session,
	type SessionContextTurn,
	type SessionMessage,
	isClarification,
} from "@/types/session";
import { ChatSession } from "@invana/ui";
import { useMemo } from "react";

export interface SessionThreadProps {
	session: Session;
	/** A run is in flight — threads through to the turns (disables re-run). */
	isRunning: boolean;
	/** Transient per-message query results, keyed by assistant message id (docs/for-developers/modules/ask/features/the-answer-surface.md). */
	results: Record<string, QueryResponse | null>;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => void;
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
}

/**
 * The open session's transcript (docs/for-developers/modules/platform/features/design-system.md): the design-kit `ChatSession` scroll
 * surface with one console row per message. The session title lives in the
 * panel's tab header (a breadcrumb back to the list) and the composer is the
 * panel footer, so this is the scrolling body only.
 *
 * Auto-follow: a new turn (message count change) jumps to the bottom; a reply
 * growing in place (running → settled, a result landing) is followed while the
 * user is already near the bottom, and leaves them alone when they've scrolled
 * up to read history.
 */
export function SessionThread({
	session,
	isRunning,
	results,
	onRerun,
	onFetchContext,
	onSelectOption,
	onTypeInstead,
	onVote,
	onLoadToCanvas,
}: SessionThreadProps) {
	const runViews = useRunStore((s) => s.views);

	// A clarifying question, once answered, is done being a chat turn — it was
	// a step inside the run, not a separate exchange (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md, reference
	// mock's `resume()`: one turn mutates in place, never a second one). Once
	// a later reply resumes the same run, fold the question (and the
	// user's answer right after it) out of the transcript; the full
	// back-and-forth still lives in the Tasks timeline, grouped under the
	// original question. Still shown live, while the run is genuinely waiting.
	const resolvedClarificationIds = useMemo(() => {
		const hidden = new Set<string>();
		session.messages.forEach((m, i) => {
			if (m.role !== "assistant" || !isClarification(m)) return;
			const resolved = session.messages.some(
				(later, j) =>
					j > i && later.role === "assistant" && later.runId === m.runId,
			);
			if (!resolved) return;
			hidden.add(m.id);
			const answer = session.messages[i + 1];
			if (answer?.role === "user") hidden.add(answer.id);
		});
		return hidden;
	}, [session.messages]);

	// "Load to canvas" is answered *inside* the reply that offered it, so its
	// operation turn (docs/for-developers/modules/explore/features/boards.md) doesn't also start a turn of its own: the
	// `❯ Load to canvas` prompt and its "Loaded N nodes … onto the canvas."
	// reply fold away, and the reply whose result was painted records it as
	// `└ you loaded this to canvas` under its Project step. The turn is still
	// in the session's operation log — this is only how the thread reads.
	const { hiddenLoadIds, loadedReplyIds } = useMemo(() => {
		const hidden = new Set<string>();
		const loaded = new Set<string>();
		session.messages.forEach((m, i) => {
			if (m.role !== "assistant" || m.operation !== "load") return;
			// The reply that produced what was loaded: the most recent ordinary
			// reply before it, preferring one that ran the very same query.
			const before = session.messages.slice(0, i).reverse();
			const source =
				before.find(
					(x) =>
						x.role === "assistant" &&
						!x.operation &&
						!!m.sourceQuery &&
						x.sourceQuery === m.sourceQuery,
				) ?? before.find((x) => x.role === "assistant" && !x.operation);
			if (!source) return; // nothing to fold into — leave the turn visible
			loaded.add(source.id);
			hidden.add(m.id);
			const prompt = session.messages[i - 1];
			if (prompt?.role === "user" && prompt.operation === "load")
				hidden.add(prompt.id);
		});
		return { hiddenLoadIds: hidden, loadedReplyIds: loaded };
	}, [session.messages]);

	if (session.messages.length === 0) {
		// The welcome block owns its own scroll container (it centres when it
		// fits), so it sits outside ChatSession's viewport.
		return (
			<div className="flex h-full min-h-0 flex-col">
				<SessionThreadWelcome />
			</div>
		);
	}

	return (
		<ChatSession autoScrollKey={`${session.id}:${session.messages.length}`}>
			{session.messages.map((message, idx) => {
				if (resolvedClarificationIds.has(message.id)) return null;
				if (hiddenLoadIds.has(message.id)) return null;
				const prev = idx > 0 ? session.messages[idx - 1] : undefined;
				if (message.role === "user") {
					return <PromptTurn key={message.id} message={message} />;
				}
				// The full auditable timeline for this run (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): steps
				// merged across a clarification pause/resume, with the question
				// (and, once resolved, the answer) nested under the step it
				// paused on instead of floating above the list.
				const { steps, clarifications } = timelineFor(
					session.messages,
					message,
					message.runId ? runViews[message.runId] : undefined,
				);
				return (
					<div
						key={message.id}
						id={`turn-${message.id}`}
						className="scroll-mt-3"
					>
						<AssistantTurn
							message={message}
							// This reply's own question is the preceding user message —
							// shown in the context disclosure as "this question".
							prompt={prev?.role === "user" ? prev.content : undefined}
							steps={steps}
							clarifications={clarifications}
							loadedToCanvas={loadedReplyIds.has(message.id)}
							isRunning={isRunning}
							onRerun={onRerun}
							onFetchContext={onFetchContext}
							onSelectOption={onSelectOption}
							onTypeInstead={onTypeInstead}
							onVote={onVote}
							result={results[message.id]}
							onLoadToCanvas={onLoadToCanvas}
						/>
					</div>
				);
			})}
		</ChatSession>
	);
}
