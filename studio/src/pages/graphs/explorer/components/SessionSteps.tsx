import {
	Button,
	ChatSessionActivitySubLine,
	ChatSessionDisclosure,
	ChatSessionTaskRow,
	type ChatSessionTaskStatus,
} from "@invana/ui";
import { useEffect, useState } from "react";
import { formatDuration } from "../../../../lib/time";
import type {
	Diagnosis,
	ThinkingStep,
	ThinkingStepStatus,
} from "../../../../types/thinking";

// ── Status mapping ────────────────────────────────────────────────────────────

const TASK_STATUS: Record<ThinkingStepStatus, ChatSessionTaskStatus> = {
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

function stepDuration(step: ThinkingStep, now: number): string {
	if (!step.startedAt) return "";
	const end = step.finishedAt?.getTime() ?? now;
	return formatDuration(Math.max(0, end - step.startedAt.getTime()));
}

/** The one-liner a step row shows for its status. */
function stepDescription(
	step: ThinkingStep,
	nextAttempt?: ThinkingStep,
): string {
	if (step.status === "failed" && nextAttempt) {
		return `retrying ${nextAttempt.attempt}/3 · ${step.error?.message ?? step.detail}`;
	}
	if (step.status === "queued" && step.retryReason) {
		return `retrying ${step.attempt}/3 · ${step.retryReason}`;
	}
	return step.detail;
}

export function totalDuration(steps: ThinkingStep[]): number {
	return steps.reduce((sum, s) => {
		if (!s.startedAt || !s.finishedAt) return sum;
		return sum + (s.finishedAt.getTime() - s.startedAt.getTime());
	}, 0);
}

export function isLiveStep(s: ThinkingStep): boolean {
	return s.status === "running";
}

// ── Step list ─────────────────────────────────────────────────────────────────

export interface StepListProps {
	steps: ThinkingStep[];
	/** The model's rationale streamed under the running Understand step (UC2). */
	reasoning?: string;
	/** Rows are clickable when a trace can open. */
	onOpenTrace?: (step: ThinkingStep) => void;
	openTraceId?: string | null;
	/** Wrap rows with the trace disclosure of the open step. */
	renderTrace?: (step: ThinkingStep) => React.ReactNode;
	className?: string;
}

/**
 * The tasks behind a reply as `ChatSessionTaskRow`s (RFC-055 § 4): status dot,
 * label, one-liner, duration (ticking while running). A retried step shows one
 * row per attempt (RFC-052 § 3.2); the reasoning line hangs under a running
 * Understand; the open step's trace disclosure renders beneath its row.
 */
export function StepList({
	steps,
	reasoning,
	onOpenTrace,
	openTraceId,
	renderTrace,
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
				return (
					<div key={step.id} className="flex flex-col gap-px">
						<ChatSessionTaskRow
							status={TASK_STATUS[step.status]}
							name={step.label}
							description={stepDescription(step, isRetryOf)}
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
			<div className="col-span-2 mt-1.5 border-t border-border pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground first:mt-0 first:border-t-0 first:pt-0">
				{title}
			</div>
			{entries.map(([k, v]) => (
				<div key={k} className="contents">
					<dt className="pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
						{k.replace(/_/g, " ")}
					</dt>
					<dd className="m-0 min-w-0">
						{typeof v === "string" && v.includes("\n") ? (
							<pre className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground/85">
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
	step: ThinkingStep;
	onClose: () => void;
}) {
	const meta = [
		`attempt ${step.attempt}`,
		step.startedAt && step.finishedAt
			? formatDuration(step.finishedAt.getTime() - step.startedAt.getTime())
			: null,
		step.tokensIn != null
			? `${step.tokensIn} in · ${step.tokensOut ?? 0} out`
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
			<dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[12px]">
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
 * The one line a settled reply keeps (UC6): `✻ Thought for 2.4s · 4 of 4 steps`.
 * Click to reopen the list.
 */
export function StepsSummary({
	steps,
	status,
	onClick,
}: {
	steps: ThinkingStep[];
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
				: "Thought for";
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

/**
 * A grounded failure explanation (RFC-052 § 5): the cause in the user's terms
 * and the actions the failure allows. Styled as *blocked* — unlike an answer.
 */
export function DiagnosisBlock({
	diagnosis,
	onRetry,
	onFocusComposer,
	onRoute,
}: {
	diagnosis: Diagnosis;
	onRetry?: () => void;
	onFocusComposer?: () => void;
	onRoute?: (route: string) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5 border-l-2 border-destructive py-0.5 pl-2.5">
			<span>{diagnosis.summary}</span>
			{diagnosis.suggestions.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{diagnosis.suggestions.map((s) => (
						<Button
							key={s.label}
							variant="outline"
							size="sm"
							className="h-7 px-3 font-normal"
							onClick={() => {
								if (s.action?.retry) onRetry?.();
								else if (s.action?.focus_composer) onFocusComposer?.();
								else if (s.route) onRoute?.(s.route);
							}}
						>
							{s.label}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}
