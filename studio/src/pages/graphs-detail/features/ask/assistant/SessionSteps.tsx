import { formatCompactCount } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import type { RunNode, RunNodeStatus } from "@/types/run";
import {
	ChatSessionActivitySubLine,
	ChatSessionDisclosure,
	ChatSessionTaskRow,
	type ChatSessionTaskStatus,
} from "@invana/ui";
import { useEffect, useState } from "react";

// ── Status mapping ────────────────────────────────────────────────────────────

const TASK_STATUS: Record<RunNodeStatus, ChatSessionTaskStatus> = {
	queued: "queued",
	running: "running",
	needs_input: "needs-input",
	succeeded: "success",
	failed: "error",
	stopped: "needs-input", // amber — interrupted, like a retry
};

/** Ticks once a second while `active`, so live durations move. */
export function useTicker(active: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [active]);
	return now;
}

function stepDuration(step: RunNode, now: number): string {
	if (!step.startedAt) return "";
	const end = step.finishedAt?.getTime() ?? now;
	return formatDuration(Math.max(0, end - step.startedAt.getTime()));
}

/** The one-liner a step row shows for its status. */
function stepDescription(step: RunNode, nextAttempt?: RunNode): string {
	if (step.status === "failed" && nextAttempt) {
		return `retrying ${nextAttempt.attempt}/3 · ${step.error?.message ?? step.detail}`;
	}
	if (step.status === "queued" && step.retryReason) {
		return `retrying ${step.attempt}/3 · ${step.retryReason}`;
	}
	return step.detail;
}

export function totalDuration(steps: RunNode[]): number {
	return steps.reduce((sum, s) => {
		if (!s.startedAt || !s.finishedAt) return sum;
		return sum + (s.finishedAt.getTime() - s.startedAt.getTime());
	}, 0);
}

export function isLiveStep(s: RunNode): boolean {
	return s.status === "running";
}

// ── Step list ─────────────────────────────────────────────────────────────────

/** A clarifying question a step paused on, nested under that step's row
 *  instead of floating above the timeline — the question and (once resolved)
 *  the answer read as part of that step's own record. A step that asked
 *  several rounds keeps them all, in the order they were asked. */
export interface StepClarification {
	question: string;
	options: string[];
	/** Set once the run has resumed — what the user picked or typed. */
	answer?: string;
}

/**
 * One offered answer, as a console line rather than a button — the options
 * belong to the step that asked, so they read as part of the timeline
 * (`○ Show routes between airports`) instead of a widget floating over it.
 * They exist only while the question is open; once answered the step keeps the
 * question and the answer, and the full option set lives in its trace.
 */
function OptionRow({
	glyph,
	label,
	onSelect,
}: {
	glyph?: string;
	label: string;
	onSelect?: () => void;
}) {
	const body = (
		<>
			<span className="shrink-0 select-none text-border" aria-hidden>
				{glyph ?? "○"}
			</span>
			<span className="min-w-0 break-words text-left">{label}</span>
		</>
	);
	const className =
		"flex max-w-full gap-2 rounded-control px-1 py-0.5 text-muted-foreground";
	if (!onSelect) {
		return <span className={className}>{body}</span>;
	}
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`${className} hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring`}
		>
			{body}
		</button>
	);
}

export interface StepListProps {
	steps: RunNode[];
	/** The model's rationale streamed under the running Understand step (UC2). */
	reasoning?: string;
	/** Rows are clickable when a trace can open. */
	onOpenTrace?: (step: RunNode) => void;
	openTraceId?: string | null;
	/** Wrap rows with the trace disclosure of the open step. */
	renderTrace?: (step: RunNode) => React.ReactNode;
	/** Clarifying rounds to nest under their step, keyed by step id — one entry
	 *  per question the step asked, in the order it asked them. */
	clarifications?: Map<string, StepClarification[]>;
	onSelectOption?: (text: string) => void;
	onTypeInstead?: () => void;
	className?: string;
}

/**
 * The tasks behind a reply as `ChatSessionTaskRow`s (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): status dot,
 * label, one-liner, duration (ticking while running). A retried step shows one
 * row per attempt (docs/for-developers/modules/ask/features/when-it-cannot-answer.md); the reasoning line hangs under a running
 * Understand; the open step's trace disclosure renders beneath its row; a
 * step that paused for input carries its question (and once answered, the
 * answer) nested under it, in place instead of above the whole timeline.
 */
export function StepList({
	steps,
	reasoning,
	onOpenTrace,
	openTraceId,
	renderTrace,
	clarifications,
	onSelectOption,
	onTypeInstead,
	className,
}: StepListProps) {
	const now = useTicker(steps.some(isLiveStep));
	return (
		<div className={`flex flex-col gap-px ${className ?? ""}`}>
			{steps.map((step, i) => {
				const next = steps[i + 1];
				const isRetryOf = next && next.seq === step.seq ? next : undefined;
				const showReasoning =
					reasoning && step.status === "running" && step.seq === 0;
				const rounds = clarifications?.get(step.id);
				const waiting = rounds?.some((c) => !c.answer) ?? false;
				return (
					<div key={step.id} className="flex flex-col gap-px">
						<ChatSessionTaskRow
							status={TASK_STATUS[step.status]}
							name={step.label}
							// A step showing the question it is waiting on spells that out
							// right underneath — its own "needs input · N options offered"
							// would say it a second time, on the same screen. Once
							// answered the description is the step's real one again.
							description={
								waiting ? undefined : stepDescription(step, isRetryOf)
							}
							meta={stepDuration(step, now)}
							onClick={onOpenTrace ? () => onOpenTrace(step) : undefined}
							className={
								step.status === "failed" ? "text-destructive" : undefined
							}
						/>
						{showReasoning && (
							<ChatSessionActivitySubLine className="pl-5 italic">
								{reasoning}
							</ChatSessionActivitySubLine>
						)}
						{rounds && rounds.length > 0 && (
							<div className="flex flex-col gap-px pb-1 pl-5">
								{/* Every round the step asked, in order — what was asked
								    and what was answered. The options are the live way to
								    answer, so they exist only while a round is open; the
								    full set stays in the step's trace. */}
								{rounds.map((round, ri) => (
									<div
										key={`${step.id}-ask-${ri}`}
										className="flex flex-col gap-px"
									>
										<ChatSessionActivitySubLine>
											asked: “{round.question}”
										</ChatSessionActivitySubLine>
										{round.answer ? (
											<ChatSessionActivitySubLine>
												you answered: “{round.answer}”
											</ChatSessionActivitySubLine>
										) : (
											(round.options.length > 0 || !!onTypeInstead) && (
												<div className="flex flex-col items-start gap-px pl-4">
													{round.options.map((option, oi) => (
														<OptionRow
															key={`${step.id}-opt-${ri}-${oi}`}
															label={option}
															// Static on a read-only surface like the
															// Tasks view, which has no composer to
															// resume into.
															onSelect={
																onSelectOption
																	? () => onSelectOption(option)
																	: undefined
															}
														/>
													))}
													{/* A question with nothing to pick from ("which
													    country?") is still answerable — typing is the
													    only way, so say so rather than leaving the run
													    waiting with no visible way to reply. */}
													{onTypeInstead && (
														<OptionRow
															glyph="✎"
															label={
																round.options.length > 0
																	? "Something else — let me type"
																	: "Type your answer below"
															}
															onSelect={onTypeInstead}
														/>
													)}
												</div>
											)
										)}
									</div>
								))}
							</div>
						)}
						{openTraceId === step.id && renderTrace && (
							<div className="pb-1 pl-5">{renderTrace(step)}</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ── Trace ─────────────────────────────────────────────────────────────────────

function fmtValue(v: unknown): string {
	if (v === null || v === undefined) return "—";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (Array.isArray(v)) return v.map(fmtValue).join(", ");
	return JSON.stringify(v);
}

function TraceGroup({
	title,
	data,
}: {
	title: string;
	data: Record<string, unknown>;
}) {
	const entries = Object.entries(data).filter(
		([, v]) => v !== null && v !== undefined && v !== "",
	);
	if (entries.length === 0) return null;
	return (
		<>
			<div className="col-span-2 mt-1.5 border-t border-border pt-1.5 text-meta uppercase tracking-wide text-muted-foreground first:mt-0 first:border-t-0 first:pt-0">
				{title}
			</div>
			{entries.map(([k, v]) => (
				<div key={k} className="contents">
					<dt className="pt-0.5 text-meta uppercase tracking-wide text-muted-foreground">
						{k.replace(/_/g, " ")}
					</dt>
					<dd className="m-0 min-w-0">
						{typeof v === "string" && v.includes("\n") ? (
							<pre className="m-0 whitespace-pre-wrap break-words font-mono text-meta leading-relaxed text-foreground/85">
								{v}
							</pre>
						) : (
							<span className="break-words">{fmtValue(v)}</span>
						)}
					</dd>
				</div>
			))}
		</>
	);
}

/**
 * A step's trace (UC10): input digests, output, error, attempt and tokens —
 * the audit trail at task resolution, as a console disclosure.
 */
export function StepTrace({
	step,
	onClose,
}: {
	step: RunNode;
	onClose: () => void;
}) {
	const meta = [
		`attempt ${step.attempt}`,
		step.startedAt && step.finishedAt
			? formatDuration(step.finishedAt.getTime() - step.startedAt.getTime())
			: null,
		step.tokensIn != null
			? `${formatCompactCount(step.tokensIn)} in · ${formatCompactCount(step.tokensOut ?? 0)} out`
			: null,
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<ChatSessionDisclosure
			label={<span className="font-mono">{step.taskKey}</span>}
			meta={meta}
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-meta">
				{step.input && <TraceGroup title="Input" data={step.input} />}
				{step.output && <TraceGroup title="Output" data={step.output} />}
				{step.error && (
					<TraceGroup
						title="Error"
						data={step.error as Record<string, unknown>}
					/>
				)}
				{!step.input && !step.output && !step.error && (
					<div className="col-span-2 text-muted-foreground">
						{step.status === "queued"
							? "Not started yet."
							: "Nothing recorded for this step."}
					</div>
				)}
			</dl>
		</ChatSessionDisclosure>
	);
}

// ── Collapsed summary ─────────────────────────────────────────────────────────

/**
 * The one line a settled reply keeps (UC6): `✻ Ask for 2.4s · 4 of 4 steps`.
 * Click to reopen the list.
 */
export function StepsSummary({
	steps,
	status,
	onClick,
}: {
	steps: RunNode[];
	status: "ok" | "error" | "stopped";
	onClick: () => void;
}) {
	const done = steps.filter((s) => s.status === "succeeded").length;
	// Count distinct steps (a retried step has several rows).
	const total = new Set(steps.map((s) => s.seq)).size;
	const verb =
		status === "error"
			? "Failed after"
			: status === "stopped"
				? "Stopped after"
				: "Ask for";
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-2 text-left text-muted-foreground hover:text-foreground"
		>
			<span className="select-none text-border" aria-hidden>
				✻
			</span>
			<span>
				{verb} {formatDuration(totalDuration(steps))} · {done} of {total} step
				{total === 1 ? "" : "s"}
			</span>
			<span className="text-muted-foreground/70">▸</span>
		</button>
	);
}

// ── Diagnosis ─────────────────────────────────────────────────────────────────
