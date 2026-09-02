import {
	Button,
	ChatSessionActivityRow,
	type ChatSessionActivityStatus,
	ChatSessionDisclosure,
	type ChatSessionMessageAction,
	ChatSessionMessageOptions,
	ChatSessionProgressLine,
	ChatSessionPromptRow,
} from "@invana/ui";
import {
	Code,
	Copy,
	Info,
	Network,
	Pencil,
	RotateCw,
	ThumbsDown,
	ThumbsUp,
	Waypoints,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDuration } from "../../../../lib/time";
import type { QueryResponse } from "../../../../types/query";
import type {
	SessionContextTurn,
	SessionMessage,
} from "../../../../types/session";
import { ResultBlock } from "./ResultBlock";
import { SessionContextDisclosure } from "./SessionContextDisclosure";

// ── User turn ─────────────────────────────────────────────────────────────────

/**
 * The user's turn as a console prompt row (RFC-054): a full-bleed band with the
 * "❯" caret in the gutter. A canvas operation (expand / load, RFC-046) is still
 * a user action, so it keeps the same row — the operation's glyph replaces the
 * caret as the only cue that it came from the canvas rather than being typed.
 */
export function PromptTurn({ message }: { message: SessionMessage }) {
	const Icon =
		message.operation === "expand"
			? Waypoints
			: message.operation === "load"
				? Network
				: null;
	return (
		<ChatSessionPromptRow
			caret={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
		>
			{message.content}
		</ChatSessionPromptRow>
	);
}

// ── Assistant turn ────────────────────────────────────────────────────────────

export interface AssistantTurnProps {
	message: SessionMessage;
	/** This reply's own question (the preceding user prompt) — shown in the
	 *  context disclosure so the full exchange the model saw is self-contained. */
	prompt?: string;
	/** A run is in flight somewhere in the session — disables re-run. */
	isRunning: boolean;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => void;
	result: QueryResponse | null | undefined;
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
}

/**
 * The assistant's turn (RFC-054). A running reply is a progress line with a
 * live elapsed counter; everything settled is an activity row whose gutter dot
 * carries the outcome — success, info (a clarifying question back), warning
 * (stopped by the user), error. The action toolbar, meta line, query and
 * context disclosures and the inline result hang off the row.
 */
export function AssistantTurn(props: AssistantTurnProps) {
	if (props.message.status === "running") {
		return <RunningTurn message={props.message} />;
	}
	if (props.message.status === "stopped") {
		return (
			<ChatSessionActivityRow status="warning">
				{props.message.content}
			</ChatSessionActivityRow>
		);
	}
	return <SettledTurn {...props} />;
}

/** Seconds elapsed since `since`, ticking once a second while mounted. */
function useElapsedSeconds(since: Date): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);
	return Math.max(0, Math.floor((now - since.getTime()) / 1000));
}

function RunningTurn({ message }: { message: SessionMessage }) {
	const elapsed = useElapsedSeconds(message.createdAt);
	return (
		<ChatSessionProgressLine elapsed={`${elapsed}s`}>
			{message.content}
		</ChatSessionProgressLine>
	);
}

function SettledTurn({
	message,
	prompt,
	isRunning,
	onRerun,
	onFetchContext,
	onSelectOption,
	onTypeInstead,
	onVote,
	result,
	onLoadToCanvas,
}: AssistantTurnProps) {
	const [showQuery, setShowQuery] = useState(false);
	const [showContext, setShowContext] = useState(false);

	const isClarification = (message.clarificationOptions?.length ?? 0) > 0;
	const status: ChatSessionActivityStatus =
		message.status === "error" ? "error" : isClarification ? "info" : "success";
	// Context applies only to NL replies (ql turns send none). The icon is shown
	// for every nl reply; the disclosure resolves to "this question only" when empty.
	const hasContext = message.mode === "nl";
	// 👍/👎 rate a real answer — not canvas operations, which aren't the model's
	// answer to a question (RFC-046).
	const canVote = !!message.sourceQuery && !message.operation;

	const copy = () => {
		navigator.clipboard?.writeText(message.content);
		toast.success("Copied to clipboard");
	};

	// LLM time only exists for NL turns; when present, label both times so it's
	// clear which step dominated. QL turns show the bare query time.
	const hasLlm = message.llmTimeMs != null;
	const meta = [
		message.via,
		message.rowCount != null
			? `${message.rowCount} row${message.rowCount === 1 ? "" : "s"}`
			: null,
		hasLlm ? `LLM ${formatDuration(message.llmTimeMs as number)}` : null,
		message.executionTimeMs != null
			? `${hasLlm ? "query " : ""}${formatDuration(message.executionTimeMs)}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");

	const actions: ChatSessionMessageAction[] = [];
	if (message.sourceQuery) {
		actions.push(
			{
				icon: <RotateCw className="h-3 w-3" />,
				label: "Re-run query",
				disabled: isRunning,
				onClick: () => onRerun(message.id),
			},
			{
				icon: <Code className="h-3 w-3" />,
				label: showQuery ? "Hide query" : "View query",
				active: showQuery,
				onClick: () => setShowQuery((v) => !v),
			},
		);
	}
	actions.push({
		icon: <Copy className="h-3 w-3" />,
		label: "Copy",
		onClick: copy,
	});
	if (hasContext) {
		actions.push({
			icon: <Info className="h-3 w-3" />,
			label: showContext ? "Hide context" : "View context",
			active: showContext,
			onClick: () => setShowContext((v) => !v),
		});
	}
	if (canVote) {
		// A downvote asks the model what to change (handled by the panel);
		// clicking the active vote clears it.
		actions.push(
			{
				icon: <ThumbsUp className="h-3 w-3" />,
				label: "Good answer",
				align: "end",
				active: message.feedback === "up",
				activeClassName: "text-success hover:text-success",
				onClick: () =>
					onVote(message.id, message.feedback === "up" ? null : "up"),
			},
			{
				icon: <ThumbsDown className="h-3 w-3" />,
				label: "Not what I wanted — refine",
				align: "end",
				active: message.feedback === "down",
				activeClassName: "text-destructive hover:text-destructive",
				onClick: () =>
					onVote(message.id, message.feedback === "down" ? null : "down"),
			},
		);
	}

	return (
		<ChatSessionActivityRow
			status={status}
			actions={<ChatSessionMessageOptions actions={actions} />}
			meta={meta || undefined}
			footer={
				<>
					{/* Clarification options (RFC-038): pick one instead of retyping —
					    it's sent as the next NL ask, which re-translates with this
					    clarification in context and runs. */}
					{isClarification && (
						<div className="flex flex-col items-start gap-1.5 py-1">
							{message.clarificationOptions?.map((option, i) => (
								<Button
									key={`${message.id}-opt-${i}`}
									variant="outline"
									size="sm"
									className="h-auto max-w-full whitespace-normal break-words px-3 py-1.5 text-left font-normal"
									onClick={() => onSelectOption(option)}
								>
									{option}
								</Button>
							))}
							<Button
								variant="outline"
								size="sm"
								className="h-auto max-w-full gap-1.5 border-dashed px-3 py-1.5 text-left font-normal text-muted-foreground"
								onClick={onTypeInstead}
							>
								<Pencil className="h-3 w-3 shrink-0" />
								Something else — let me type
							</Button>
						</div>
					)}
					{showQuery && message.sourceQuery && (
						<ChatSessionDisclosure
							label={message.language ?? "query"}
							open
							onOpenChange={(open) => setShowQuery(open)}
							contentClassName="font-mono whitespace-pre-wrap break-words text-muted-foreground"
						>
							{message.sourceQuery}
						</ChatSessionDisclosure>
					)}
					{showContext && (
						<SessionContextDisclosure
							messageId={message.id}
							prompt={prompt}
							onFetch={onFetchContext}
							onClose={() => setShowContext(false)}
						/>
					)}
					<ResultBlock
						result={result}
						onLoadToCanvas={(r) => onLoadToCanvas(r, message)}
					/>
				</>
			}
		>
			{message.content}
		</ChatSessionActivityRow>
	);
}
