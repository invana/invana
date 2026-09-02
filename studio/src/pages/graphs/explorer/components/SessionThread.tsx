import { ChatSession } from "@invana/ui";
import type { QueryResponse } from "../../../../types/query";
import type {
	Session,
	SessionContextTurn,
	SessionMessage,
} from "../../../../types/session";
import { SessionThreadWelcome } from "./SessionThreadWelcome";
import { AssistantTurn, PromptTurn } from "./SessionTurn";

export interface SessionThreadProps {
	session: Session;
	/** A run is in flight — threads through to the turns (disables re-run). */
	isRunning: boolean;
	/** Transient per-message query results, keyed by assistant message id (RFC-033). */
	results: Record<string, QueryResponse | null>;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => void;
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
}

/**
 * The open session's transcript (RFC-054): the design-kit `ChatSession` scroll
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
				if (message.role === "user") {
					return <PromptTurn key={message.id} message={message} />;
				}
				// The assistant reply's own question is the preceding user message —
				// shown in the context disclosure as "this question".
				const prev = idx > 0 ? session.messages[idx - 1] : undefined;
				return (
					<AssistantTurn
						key={message.id}
						message={message}
						prompt={prev?.role === "user" ? prev.content : undefined}
						isRunning={isRunning}
						onRerun={onRerun}
						onFetchContext={onFetchContext}
						onSelectOption={onSelectOption}
						onTypeInstead={onTypeInstead}
						onVote={onVote}
						result={results[message.id]}
						onLoadToCanvas={onLoadToCanvas}
					/>
				);
			})}
		</ChatSession>
	);
}
