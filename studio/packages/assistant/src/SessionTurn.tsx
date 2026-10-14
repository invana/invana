import { Button, ChatSessionDisclosure, Eyebrow, Spinner } from "@invana/ui";
import type { QueryResponse } from "@invana-studio/core";
import {
	formatDuration,
	isClarification,
	LIVE_RUN_STATUSES,
	type RunNode,
	type SessionContextTurn,
	type SessionMessage,
	useRunStore,
	useTicker,
} from "@invana-studio/core";
import {
	CalendarClock,
	FolderPlus,
	Network,
	Save,
	Share2,
	Star,
	Waypoints,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useAssistantSlots } from "./AssistantSlots";
import { RunCannotAnswer, RunDiagnosis } from "./answer-surface/NotAnAnswer";
import {
	LoadToCanvasAction,
	loadableGraph,
	ResultBlock,
} from "./answer-surface/ResultBlock";
import { CastRefusalCard } from "./CastRefusal";
import { SessionContextDisclosure } from "./SessionContextDisclosure";
import {
	OptionRow,
	type StepClarification,
	StepList,
	StepTrace,
} from "./SessionSteps";
import { stepsFor } from "./SessionStepsTimeline";

// ── User turn ─────────────────────────────────────────────────────────────────

/**
 * The person's turn: a bubble on the right, the words they sent. A canvas
 * operation (expand / load, docs/for-developers/modules/explore/features/boards.md)
 * is still their act, so it keeps the bubble, led by the operation's glyph.
 * When it was asked, and the world its run was frozen with, are on hover.
 */
export function PromptTurn({
	message,
	ranIn,
}: {
	message: SessionMessage;
	/** The world this ask's run was frozen with — *Everything* when it
	 *  ran in none; undefined when no run answered it. */
	ranIn?: string;
}) {
	const Icon =
		message.operation === "expand"
			? Waypoints
			: message.operation === "load"
				? Network
				: null;
	const asked = message.createdAt.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
	return (
		<div className="flex justify-end px-3 py-1.5">
			<div
				className="flex max-w-[85%] items-start gap-1.5 whitespace-pre-wrap break-words rounded-control bg-accent px-3 py-2"
				title={ranIn ? `${asked} · ran in ${ranIn}` : asked}
			>
				{Icon && (
					<Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
				)}
				{message.content}
			</div>
		</div>
	);
}

/** The assistant's side of the thread: its mark, then the reply beside it. */
function ReplyRow({ children }: { children: ReactNode }) {
	return (
		<div className="flex items-start gap-2 px-3 py-1.5">
			<span
				aria-hidden
				className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
			>
				<Star className="size-3" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
		</div>
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
	/** The thread's last turn. Only its choices after small talk can be tapped:
	 *  once something else is asked, the offer is spent (NL14). */
	isLatest?: boolean;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	result: QueryResponse | null | undefined;
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
	/** Open the console under the board — on Records from the reply's record
	 *  count, on Log where a failed query's whole error is read. Absent where
	 *  the page has no console. */
	onOpenConsole?: (tab: "records" | "log") => void;
	/** Keep the board as it stands as a view — a reply's *Save view*. */
	onSaveView?: () => void;
	/** The thread this turn is in — what *Share*'s live link opens. */
	sessionId?: string;
}

/**
 * The assistant's turn (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).
 * While its run runs, the reply is the live plan: the step rows moving as the
 * stream arrives, the model's reasoning under Understand. Once settled it is
 * the answer — its words, what it stood on, what can be done with it — and
 * the steps fold under *How I got this*.
 */
export function AssistantTurn(props: AssistantTurnProps) {
	const { message } = props;
	const view = useRunStore((s) =>
		message.runId ? s.views[message.runId] : undefined,
	);
	const live = !!view && LIVE_RUN_STATUSES.has(view.status);
	if (message.status === "running" || live) {
		return <RunningTurn {...props} />;
	}
	return <SettledTurn {...props} />;
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
		<ReplyRow>
			{steps.length === 0 ? (
				<span className="flex items-center gap-2 text-muted-foreground">
					<Spinner className="size-3 shrink-0 text-primary motion-reduce:animate-none" />
					<span className="min-w-0 flex-1">Starting…</span>
					<span className="shrink-0 font-mono tabular-nums">{elapsed}</span>
				</span>
			) : (
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
			)}
			{/* The proposed query is viewable the moment Understand settles,
			    not only when the reply does. */}
			{view?.query && (
				<ChatSessionDisclosure
					label={view.query.language || "query"}
					meta={view.query.via}
					contentClassName="font-mono whitespace-pre-wrap break-words text-muted-foreground"
				>
					{view.query.query}
				</ChatSessionDisclosure>
			)}
		</ReplyRow>
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
	result,
	onLoadToCanvas,
	loadedToCanvas,
	isLatest,
	onOpenConsole,
	onSaveView,
	sessionId,
}: AssistantTurnProps) {
	const view = useRunStore((s) =>
		message.runId ? s.views[message.runId] : undefined,
	);
	const steps = stepsProp ?? stepsFor(message, view);
	const isAsking =
		isClarification(message) || view?.status === "awaiting_input";
	const isStopped = message.status === "stopped";
	// The steps are the auditable record of what ran, folded under *How I got
	// this* — open from the start only while the run waits on the person,
	// because then the question and its options live on the step.
	const [stepsOpen, setStepsOpen] = useState(isAsking);
	const [openTraceId, setOpenTraceId] = useState<string | null>(null);
	const [showContext, setShowContext] = useState(false);

	// The engine builds a failure's diagnosis summary from the very message it
	// wrote into the reply, so both would print one sentence twice; the
	// diagnosis carries the actions, so it keeps the sentence. A clarifying
	// reply's text *is* the question its step already shows, likewise.
	const echoed =
		(message.status === "error" &&
			view?.diagnosis?.summary.trim() === message.content.trim()) ||
		(isAsking &&
			!!clarifications &&
			[...clarifications.values()]
				.flat()
				.some((c) => c.question === message.content));
	const hasSteps = steps.length > 0;
	const choices = conversedChoices(steps);
	// A graph result is an offer the reply makes — *Load to canvas* — answered
	// by clicking. The click is page-local (like the result it acts on);
	// `loadedToCanvas` is the same fact read back from the thread's own `load`
	// turn, so a reload still shows it as answered.
	const graph = loadableGraph(result);
	const [clicked, setClicked] = useState(false);
	const loaded = clicked || !!loadedToCanvas;
	const textClass =
		message.status === "error" && !message.refusal
			? "text-destructive"
			: isStopped
				? "text-warning"
				: undefined;

	// An answer — not a canvas operation, a refusal or a failure — can be kept,
	// shared and asked again on a schedule.
	const isAnswer =
		!!message.sourceQuery &&
		!message.operation &&
		!isStopped &&
		message.status !== "error";
	const slots = useAssistantSlots();
	const addToProject = slots.useAddToProject();
	const shareAnswer = slots.useShareAnswer();
	const scheduleQuestion = slots.useScheduleQuestion();
	const sourceQuery = message.sourceQuery ?? view?.query?.query;
	const answerRunId = message.runId;
	const question = prompt ?? message.content;

	// What the answer stood on: `72 records · EU · H1 2026`.
	const meta = [
		message.rowCount != null
			? `${message.rowCount.toLocaleString()} record${message.rowCount === 1 ? "" : "s"}`
			: null,
		message.runId ? (message.lensName ?? "Everything") : null,
		message.executionTimeMs != null
			? formatDuration(message.executionTimeMs)
			: null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<ReplyRow>
			{message.refusal ? (
				<CastRefusalCard refusal={message.refusal} />
			) : (
				!echoed && <span className={textClass}>{message.content}</span>
			)}
			{meta && isAnswer && (
				<span className="text-xs text-muted-foreground">
					{onOpenConsole && message.rowCount ? (
						<button
							type="button"
							className="underline-offset-2 hover:text-foreground hover:underline"
							title="Read them in the console"
							onClick={() => onOpenConsole("records")}
						>
							{meta}
						</button>
					) : (
						meta
					)}
				</span>
			)}
			{(graph && !loaded) || isAnswer ? (
				<span className="flex flex-wrap gap-1.5">
					{graph && !loaded && (
						<LoadToCanvasAction
							onLoad={() => {
								onLoadToCanvas(graph, message);
								setClicked(true);
							}}
						/>
					)}
					{isAnswer && onSaveView && (
						<Button variant="outline" size="sm" onClick={onSaveView}>
							<Save />
							Save view
						</Button>
					)}
					{isAnswer && scheduleQuestion && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => scheduleQuestion(question)}
						>
							<CalendarClock />
							Schedule this
						</Button>
					)}
					{isAnswer && addToProject && answerRunId && (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								addToProject({
									runId: answerRunId,
									statement: message.content,
								})
							}
						>
							<FolderPlus />
							Add to a project
						</Button>
					)}
					{isAnswer && shareAnswer && answerRunId && sessionId && (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								shareAnswer({
									sessionId,
									messageId: message.id,
									runId: answerRunId,
									question,
									answer: message.content,
									worldName: message.lensName,
								})
							}
						>
							<Share2 />
							Share
						</Button>
					)}
				</span>
			) : null}
			{/* After small talk, what the person could ask next — each one this
			    run's world lets it answer. A tap is a new ask, never an answer
			    to this settled run (NL14). */}
			{choices.length > 0 && (
				<div className="flex flex-col items-start gap-px">
					<Eyebrow className="px-1">Try asking</Eyebrow>
					{choices.map((choice) => (
						<OptionRow
							key={choice}
							glyph="❯"
							label={choice}
							onSelect={
								isLatest && !isRunning
									? () => onSelectOption(choice)
									: undefined
							}
						/>
					))}
				</div>
			)}
			{isStopped && (
				<span className="text-muted-foreground">
					Interrupted · ask again, or narrow the question
				</span>
			)}
			{/* Four outcomes, four surfaces. A cannot-answer is an answer — the
			    graph saying what it does not hold — so it is drawn calmly and
			    apart from a failure, which is drawn as a fault with its
			    evidence. */}
			{view?.cannotAnswer && (
				<RunCannotAnswer
					reason={view.cannotAnswer.reason}
					stage={view.cannotAnswer.stage}
				/>
			)}
			{message.status === "error" && view?.diagnosis && (
				<RunDiagnosis
					diagnosis={view.diagnosis}
					onRetry={
						message.sourceQuery ? () => onRerun(message.id) : onTypeInstead
					}
					onFocusComposer={onTypeInstead}
					onOpenLog={onOpenConsole ? () => onOpenConsole("log") : undefined}
				/>
			)}
			{hasSteps && (
				<div className="flex flex-col items-start gap-1">
					<Button
						variant="ghost"
						size="sm"
						aria-expanded={stepsOpen}
						className={stepsOpen ? "font-semibold" : "text-muted-foreground"}
						onClick={() => setStepsOpen((v) => !v)}
					>
						How I got this
					</Button>
					{stepsOpen && (
						<div className="w-full rounded-control border border-border bg-muted/40 p-2">
							<StepList
								steps={steps}
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
							{sourceQuery && (
								<ChatSessionDisclosure
									label={message.language ?? view?.query?.language ?? "query"}
									contentClassName="font-mono whitespace-pre-wrap break-words text-muted-foreground"
								>
									{sourceQuery}
								</ChatSessionDisclosure>
							)}
							{message.mode === "nl" && (
								<Button
									variant="link"
									size="sm"
									className="px-0"
									onClick={() => setShowContext((v) => !v)}
								>
									{showContext
										? "Hide what the model was given"
										: "What the model was given"}
								</Button>
							)}
							{showContext && (
								<SessionContextDisclosure
									messageId={message.id}
									prompt={prompt}
									onFetch={onFetchContext}
									onClose={() => setShowContext(false)}
								/>
							)}
						</div>
					)}
				</div>
			)}
			{/* The reply's emissions. A landed subgraph says so here — it is the
			    emission's own line. */}
			<ResultBlock result={result} onCanvas={loaded} runId={message.runId} />
		</ReplyRow>
	);
}

/** The questions a conversed Understand step offered (NL14), or none. */
function conversedChoices(steps: RunNode[]): string[] {
	const out = steps.find(
		(s) =>
			s.taskKey === "understand_intent" && typeof s.output?.reply === "string",
	)?.output;
	const options = out?.options;
	return Array.isArray(options)
		? options.filter((o): o is string => typeof o === "string")
		: [];
}
