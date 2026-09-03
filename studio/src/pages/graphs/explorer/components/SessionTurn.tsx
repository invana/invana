import {
	Button,
	ChatSessionActivityRow,
	type ChatSessionActivityStatus,
	ChatSessionActivitySubLine,
	ChatSessionDisclosure,
	type ChatSessionMessageAction,
	ChatSessionMessageOptions,
	ChatSessionPromptRow,
} from "@invana/ui";
import {
	Code,
	Copy,
	Info,
	ListTree,
	Network,
	Pencil,
	RotateCw,
	ThumbsDown,
	ThumbsUp,
	Waypoints,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDuration } from "../../../../lib/time";
import { useThinkingStore } from "../../../../stores/thinking.store";
import type { QueryResponse } from "../../../../types/query";
import type {
	SessionContextTurn,
	SessionMessage,
} from "../../../../types/session";
import {
	LIVE_THINKING_STATUSES,
	type ThinkingStep,
} from "../../../../types/thinking";
import { ResultBlock } from "./ResultBlock";
import { SessionContextDisclosure } from "./SessionContextDisclosure";
import {
	DiagnosisBlock,
	StepList,
	StepTrace,
	StepsSummary,
	useTicker,
} from "./SessionSteps";
import { stepsFor } from "./SessionTasksView";

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
			meta={message.createdAt.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			})}
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
 * The assistant's turn (RFC-055). While its thinking runs the row is a live
 * plan: the current step with a spinner and elapsed, the step rows beneath it
 * moving as the stream arrives, the model's reasoning under Understand. Once
 * settled it is an activity row whose gutter dot carries the outcome —
 * success, info (a clarifying question back), warning (stopped), error — with
 * the step list folded to one line (`✻ Thought for …`) and reopenable.
 */
export function AssistantTurn(props: AssistantTurnProps) {
	const { message } = props;
	const view = useThinkingStore((s) =>
		message.thinkingId ? s.views[message.thinkingId] : undefined,
	);
	const live = !!view && LIVE_THINKING_STATUSES.has(view.status);
	if (message.status === "running" || live) {
		return <RunningTurn {...props} />;
	}
	return <SettledTurn {...props} />;
}

function Spinner() {
	return (
		<span
			className="h-3 w-3 shrink-0 rounded-full border-2 border-muted border-t-primary animate-spin motion-reduce:animate-none"
			role="status"
			aria-label="Working"
		/>
	);
}

function RunningTurn({ message }: AssistantTurnProps) {
	const view = useThinkingStore((s) =>
		message.thinkingId ? s.views[message.thinkingId] : undefined,
	);
	const steps = stepsFor(message, view);
	const [openTraceId, setOpenTraceId] = useState<string | null>(null);
	const now = useTicker(true);
	const current = steps.find((s) => s.status === "running");
	const startedAt =
		steps[0]?.startedAt?.getTime() ?? message.createdAt.getTime();
	const elapsed = formatDuration(Math.max(0, now - startedAt));

	return (
		<ChatSessionActivityRow
			status="pending"
			footer={
				<>
					<StepList
						steps={steps}
						reasoning={view?.reasoning}
						onOpenTrace={(s) =>
							setOpenTraceId((id) => (id === s.id ? null : s.id))
						}
						openTraceId={openTraceId}
						renderTrace={(s) => (
							<StepTrace step={s} onClose={() => setOpenTraceId(null)} />
						)}
					/>
					{/* The proposed query is viewable the moment Understand settles,
					    not only when the reply does (UC3). */}
					{view?.query && (
						<ChatSessionDisclosure
							label={view.query.language || "query"}
							meta={view.query.via}
							contentClassName="font-mono whitespace-pre-wrap break-words text-muted-foreground"
						>
							{view.query.query}
						</ChatSessionDisclosure>
					)}
				</>
			}
		>
			<span className="flex items-center gap-2 text-muted-foreground">
				<Spinner />
				<span className="min-w-0 flex-1">
					{current
						? `${current.label}…`
						: steps.length
							? "Starting…"
							: message.content}
				</span>
				<span className="shrink-0 font-mono tabular-nums">{elapsed}</span>
			</span>
		</ChatSessionActivityRow>
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
	const view = useThinkingStore((s) =>
		message.thinkingId ? s.views[message.thinkingId] : undefined,
	);
	const steps = stepsFor(message, view);
	const isClarification =
		(message.clarificationOptions?.length ?? 0) > 0 ||
		view?.status === "awaiting_input";
	const isStopped = message.status === "stopped";
	// Steps stay open on a question back (the run is paused, not over) and
	// collapse to the summary line once a reply is settled (UC6).
	const [stepsOpen, setStepsOpen] = useState(isClarification);
	const [openTraceId, setOpenTraceId] = useState<string | null>(null);
	const [showQuery, setShowQuery] = useState(false);
	const [showContext, setShowContext] = useState(false);

	const status: ChatSessionActivityStatus =
		message.status === "error"
			? "error"
			: isStopped
				? "warning"
				: isClarification
					? "info"
					: "success";
	// Context applies only to NL replies (ql turns send none). The icon is shown
	// for every nl reply; the disclosure resolves to "this question only" when empty.
	const hasContext = message.mode === "nl";
	// 👍/👎 rate a real answer — not canvas operations, which aren't the model's
	// answer to a question (RFC-046).
	const canVote = !!message.sourceQuery && !message.operation;
	const sourceQuery = message.sourceQuery ?? view?.query?.query;

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
	if (sourceQuery) {
		actions.push(
			{
				icon: <RotateCw className="h-3 w-3" />,
				label: "Re-run query",
				disabled: isRunning || !message.sourceQuery,
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
	if (steps.length > 0) {
		actions.push({
			icon: <ListTree className="h-3 w-3" />,
			label: stepsOpen ? "Hide steps" : "Steps",
			active: stepsOpen,
			onClick: () => setStepsOpen((v) => !v),
		});
	}
	if (canVote && !isStopped) {
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

	const renderTrace = (s: ThinkingStep) => (
		<StepTrace step={s} onClose={() => setOpenTraceId(null)} />
	);

	return (
		<ChatSessionActivityRow
			status={status}
			actions={
				isStopped ? undefined : <ChatSessionMessageOptions actions={actions} />
			}
			meta={meta || undefined}
			footer={
				<>
					{isStopped && (
						<ChatSessionActivitySubLine>
							Interrupted · ask again, or narrow the question
						</ChatSessionActivitySubLine>
					)}
					{/* Clarification options (RFC-038): pick one instead of retyping —
					    it's sent as the answer, and the same thinking resumes (UC7). */}
					{isClarification && (
						<div className="flex flex-col items-start gap-1.5 py-1">
							{(
								message.clarificationOptions ??
								view?.clarification?.options ??
								[]
							).map((option, i) => (
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
					{message.status === "error" && view?.diagnosis && (
						<DiagnosisBlock
							diagnosis={view.diagnosis}
							onRetry={
								message.sourceQuery ? () => onRerun(message.id) : onTypeInstead
							}
							onFocusComposer={onTypeInstead}
						/>
					)}
					{steps.length > 0 &&
						(stepsOpen ? (
							<StepList
								steps={steps}
								onOpenTrace={(s) =>
									setOpenTraceId((id) => (id === s.id ? null : s.id))
								}
								openTraceId={openTraceId}
								renderTrace={renderTrace}
							/>
						) : (
							<StepsSummary
								steps={steps}
								status={
									message.status === "error"
										? "error"
										: isStopped
											? "stopped"
											: "ok"
								}
								onClick={() => setStepsOpen(true)}
							/>
						))}
					{showQuery && sourceQuery && (
						<ChatSessionDisclosure
							label={message.language ?? view?.query?.language ?? "query"}
							open
							onOpenChange={(open) => setShowQuery(open)}
							contentClassName="font-mono whitespace-pre-wrap break-words text-muted-foreground"
						>
							{sourceQuery}
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
