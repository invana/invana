import { formatDuration } from "@/lib/time";
import {
	CannotAnswerCard,
	DiagnosisCard,
} from "@/pages/graphs-detail/features/ask/answer-surface/NotAnAnswer";
import {
	LoadToCanvasAction,
	ResultBlock,
	loadableGraph,
} from "@/pages/graphs-detail/features/ask/answer-surface/ResultBlock";
import { SessionContextDisclosure } from "@/pages/graphs-detail/features/ask/assistant/SessionContextDisclosure";
import {
	type StepClarification,
	StepList,
	StepTrace,
	StepsSummary,
	useTicker,
} from "@/pages/graphs-detail/features/ask/assistant/SessionSteps";
import { stepsFor } from "@/pages/graphs-detail/features/ask/assistant/SessionTasksView";
import { useRunStore } from "@/stores/run.store";
import type { QueryResponse } from "@/types/query";
import { LIVE_THINKING_STATUSES, type RunNode } from "@/types/run";
import {
	type SessionContextTurn,
	type SessionMessage,
	isClarification,
} from "@/types/session";
import {
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
	RotateCw,
	ThumbsDown,
	ThumbsUp,
	Waypoints,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── User turn ─────────────────────────────────────────────────────────────────

/**
 * The user's turn as a console prompt row (docs/for-developers/modules/platform/features/design-system.md): a full-bleed band with the
 * "❯" caret in the gutter. A canvas operation (expand / load, docs/for-developers/modules/explore/features/boards.md) is still
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
	/** The full step list for this reply's run, merged across a clarification
	 *  pause/resume (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) so a paused-then-continued run reads as one
	 *  seamless list — same as the reference mock's `resume()`, which mutates
	 *  a single turn in place rather than starting a second one. Falls back to
	 *  this reply's own steps when omitted. */
	steps?: RunNode[];
	/** Clarifying rounds to nest under their step (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) — see
	 *  `StepList`'s `clarifications` prop. */
	clarifications?: Map<string, StepClarification[]>;
	/** This reply's graph result is already on the canvas — the thread saw a
	 *  `load` operation turn for it (docs/for-developers/modules/explore/features/boards.md), so the offer is spent. */
	loadedToCanvas?: boolean;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => void;
	result: QueryResponse | null | undefined;
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
}

/**
 * The assistant's turn (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). While its run runs the row is a live
 * plan: the current step with a spinner and elapsed, the step rows beneath it
 * moving as the stream arrives, the model's reasoning under Understand. Once
 * settled it is an activity row whose gutter dot carries the outcome —
 * success, info (a clarifying question back), warning (stopped), error — with
 * the step list folded to one line (`✻ Ask for …`) and reopenable.
 */
export function AssistantTurn(props: AssistantTurnProps) {
	const { message } = props;
	const view = useRunStore((s) =>
		message.runId ? s.views[message.runId] : undefined,
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

function RunningTurn({
	message,
	steps: stepsProp,
	clarifications,
	onSelectOption,
	onTypeInstead,
}: AssistantTurnProps) {
	const view = useRunStore((s) =>
		message.runId ? s.views[message.runId] : undefined,
	);
	const steps = stepsProp ?? stepsFor(message, view);
	const [openTraceId, setOpenTraceId] = useState<string | null>(null);
	const now = useTicker(true);
	const startedAt =
		steps[0]?.startedAt?.getTime() ?? message.createdAt.getTime();
	const elapsed = formatDuration(Math.max(0, now - startedAt));

	return (
		<ChatSessionActivityRow
			status="pending"
			// The spinner is the row's gutter marker, not a line of its own: the
			// step list below already names the running step and ticks its
			// elapsed, so a headline here would just say "Understand…" twice.
			marker={<Spinner />}
			footer={
				<>
					<StepList
						steps={steps}
						reasoning={view?.reasoning}
						clarifications={clarifications}
						onSelectOption={onSelectOption}
						onTypeInstead={onTypeInstead}
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
			{/* Only before the first step frame lands — from then on the list
			    carries the labels and the times. */}
			{steps.length === 0 && (
				<span className="flex items-center gap-2 text-muted-foreground">
					<span className="min-w-0 flex-1">Starting…</span>
					<span className="shrink-0 font-mono tabular-nums">{elapsed}</span>
				</span>
			)}
		</ChatSessionActivityRow>
	);
}

function SettledTurn({
	message,
	prompt,
	isRunning,
	steps: stepsProp,
	clarifications,
	onRerun,
	onFetchContext,
	onSelectOption,
	onTypeInstead,
	onVote,
	result,
	onLoadToCanvas,
	loadedToCanvas,
}: AssistantTurnProps) {
	const view = useRunStore((s) =>
		message.runId ? s.views[message.runId] : undefined,
	);
	const steps = stepsProp ?? stepsFor(message, view);
	const isAsking =
		isClarification(message) || view?.status === "awaiting_input";
	const isStopped = message.status === "stopped";
	// The step timeline is the auditable record of what ran — open by default
	// so it never needs a click to see; "Steps" in the toolbar still folds it
	// away for anyone who wants the short version.
	const [stepsOpen, setStepsOpen] = useState(true);
	const [openTraceId, setOpenTraceId] = useState<string | null>(null);
	const [showQuery, setShowQuery] = useState(false);
	const [showContext, setShowContext] = useState(false);

	// A clarifying reply's text *is* the question, and the step it paused on
	// already carries it ("asked: …") — printing it here too put the same
	// sentence on screen twice.
	// (Only while the timeline is open — folding the steps away must not take
	// the question, and its options, with it.)
	const echoedByStep =
		stepsOpen &&
		!!clarifications &&
		[...clarifications.values()]
			.flat()
			.some((c) => c.question === message.content);
	// Same story on the failure path: the engine builds the diagnosis summary
	// from the very `failure.message` it wrote into the reply (`_finish_failed`),
	// so both lines print one identical sentence under the other. The diagnosis
	// is the richer of the two — it carries the actions the failure allows — so
	// it keeps the sentence. Nothing is lost when it's absent: the diagnosis
	// arrives on the live view only, so after a reload the reply's own text is
	// the record and prints as usual.
	const echoedByDiagnosis =
		message.status === "error" &&
		view?.diagnosis?.summary.trim() === message.content.trim();
	const echoed = echoedByStep || echoedByDiagnosis;
	// And on the happy path: the reply's sentence ("Returned 10839 nodes and
	// 5419 relationships.") is minted by the Project step out of the very counts
	// that step's own row prints — `shape_for_canvas` returns the summary and
	// the detail from one `v.nodes`/`v.edges` (docs/for-developers/modules/ask/features/the-answer-surface.md). So while the timeline is
	// open the step has already said it, and the body keeps only what a step row
	// can't carry: the load offer. Fold the steps away and the sentence is the
	// turn's one line again. Only query turns project this way; a modeller
	// reply's summary is the model's own prose and always stands.
	const sentenceEchoed =
		stepsOpen &&
		steps.some(
			(s) => s.taskKey === "shape_for_canvas" && s.status === "succeeded",
		);
	// The reply's text is the outcome the steps produced, so it hangs off the
	// end of the timeline like every other detail line. With no timeline to
	// hang from (a bare QL turn, a canvas operation log) an elbow-prefixed line
	// would dangle from nothing — then it is the row's own body instead.
	const hasSteps = steps.length > 0;
	// A graph result is an offer the reply makes on its own line — "Returned 10
	// nodes and 0 relationships. [Load to canvas]" — answered by clicking, and
	// the answer is recorded underneath. The click state is page-local (like the
	// result it acts on, docs/for-developers/modules/ask/spec.md); `loadedToCanvas` is the same fact read back
	// from the thread's own `load` operation turn (docs/for-developers/modules/explore/features/boards.md), so a reload still
	// shows it as answered.
	const graph = loadableGraph(result);
	const [clicked, setClicked] = useState(false);
	const loaded = clicked || !!loadedToCanvas;
	const textClass =
		message.status === "error"
			? "text-destructive"
			: isStopped
				? "text-warning"
				: "text-foreground";

	const status: ChatSessionActivityStatus =
		message.status === "error"
			? "error"
			: isStopped
				? "warning"
				: isAsking
					? "info"
					: "success";
	// Context applies only to NL replies (ql turns send none). The icon is shown
	// for every nl reply; the disclosure resolves to "this question only" when empty.
	const hasContext = message.mode === "nl";
	// 👍/👎 rate a real answer — not canvas operations, which aren't the model's
	// answer to a question (docs/for-developers/modules/explore/features/boards.md).
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

	const renderTrace = (s: RunNode) => (
		<StepTrace step={s} onClose={() => setOpenTraceId(null)} />
	);

	const replyBody =
		graph && !loaded ? (
			<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
				{!sentenceEchoed && <span className="min-w-0">{message.content}</span>}
				<LoadToCanvasAction
					onLoad={() => {
						onLoadToCanvas(graph, message);
						setClicked(true);
					}}
				/>
			</span>
		) : sentenceEchoed ? null : (
			message.content
		);

	const toolbar = isStopped ? undefined : (
		<ChatSessionMessageOptions actions={actions} />
	);

	// TEMP — the reply's header (the icon toolbar and the
	// `claude_agent_sdk · claude-opus-5 · LLM 7.0s` meta line) is hidden while
	// the timeline layout settles. Nothing is deleted: `toolbar` and `meta` are
	// still built above, and putting the header back is uncommenting the two
	// props on the row below. The two `void`s only keep them "used".
	void toolbar;
	void meta;

	return (
		<ChatSessionActivityRow
			status={status}
			// With a timeline, the steps carry the state — their own dots say
			// which one is amber (waiting) or red (failed), so a second,
			// turn-level dot beside them just reads as two statuses for one row.
			// The gutter column stays (alignment) but empty.
			marker={hasSteps ? <span className="h-1.5 w-1.5" /> : undefined}
			// actions={toolbar}
			// meta={meta || undefined}
			footer={
				<>
					{hasSteps &&
						(stepsOpen ? (
							<StepList
								steps={steps}
								clarifications={clarifications}
								onSelectOption={onSelectOption}
								onTypeInstead={onTypeInstead}
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
					{/* The reply's own text — the outcome the timeline above produced,
					    or an operation log's own summary ("Loaded … to canvas") —
					    carrying the load offer when there's a graph to paint. */}
					{hasSteps && !echoed && replyBody !== null && (
						<ChatSessionActivitySubLine className={`pl-5 ${textClass}`}>
							{replyBody}
						</ChatSessionActivitySubLine>
					)}
					{isStopped && (
						<ChatSessionActivitySubLine className="pl-5">
							Interrupted · ask again, or narrow the question
						</ChatSessionActivitySubLine>
					)}
					{/* Four outcomes, four surfaces (CA1). A cannot-answer is an
					    answer — the graph saying what it does not hold — so it is
					    drawn calmly and apart from a failure, which is drawn as a
					    fault with its evidence (CA6). Retry and repair appear on the
					    step rows above, never here (CA7). */}
					{view?.cannotAnswer && (
						<CannotAnswerCard
							reason={view.cannotAnswer.reason}
							stage={view.cannotAnswer.stage}
						/>
					)}
					{message.status === "error" && view?.diagnosis && (
						<DiagnosisCard
							diagnosis={view.diagnosis}
							onRetry={
								message.sourceQuery ? () => onRerun(message.id) : onTypeInstead
							}
							onFocusComposer={onTypeInstead}
						/>
					)}
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
					{/* The reply's emissions. A landed subgraph says so here — it is
					    the emission's own line, not a sub-line beside it (AS5, AS8). */}
					<ResultBlock
						result={result}
						onCanvas={loaded}
						runId={message.runId}
					/>
				</>
			}
		>
			{!hasSteps && !echoed ? replyBody : undefined}
		</ChatSessionActivityRow>
	);
}
