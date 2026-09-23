/**
 * A run, as the drawer reads it — **five sections off two reads**
 * ([SR67](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md#decisions)).
 *
 * `The run` · `What it cost` · `What it touched` · `Bounds reached` ·
 * `Refused`, derived from the trace (`GET …/runs/{id}/trace`) and the ledger
 * (`GET …/runs/{id}/touches`). This file derives; the drawer only lays it out.
 *
 * **A row nobody recorded is absent, never zero** (SR34). A run with no price
 * has no cost row, a run with no agent has no ceiling to read `of` against, and
 * a bound the runtime does not have yet — an approval gate — draws no row
 * rather than `0 of 0`.
 */

import { formatCompact } from "@/lib/format";
import { formatElapsed } from "@/lib/time";
import { BANDS } from "@/pages/graphs-detail/features/govern/runLayers";
import {
	durationMs,
	originOf,
	usd,
} from "@/pages/graphs-detail/features/operate/dashboards/shared";
import type { TraceRead } from "@/services/api/runs";
import type { Touch, TouchesResponse } from "@/types/govern";
import type { TouchItem } from "@invana/ui";

export interface SummaryRow {
	label: string;
	value: string;
	/** `query` draws a `ql` run's asked clamped and monospace; `lens` links to the world it names. */
	kind?: "query" | "lens";
	/** The world or guardrail a `lens` row opens — absent on `Everything`. */
	lens?: { id: string; kind: "world" | "guardrail" };
}

export interface RunSummary {
	/** `6.4s of work` — what the steps did, summed; waiting is not work. */
	work: string | null;
	theRun: SummaryRow[];
	cost: SummaryRow[];
	touched: TouchItem[];
	refusedCount: number;
	bounds: SummaryRow[];
	/** `none exhausted` · `1 exhausted`, or `null` when no bound was read. */
	boundsAside: string | null;
	refused: { address: string; why: string }[];
}

/** `template:nl-query@5` → `nl-query@5`; a generated plan says so. */
export function planOf(trace: TraceRead): string {
	const origin = trace.plan_origin ?? "";
	if (origin.startsWith("template:")) return origin.slice("template:".length);
	if (origin === "generated") return `${trace.workflow_key} · planned`;
	return trace.plan_revision
		? `${trace.workflow_key}@${trace.plan_revision}`
		: trace.workflow_key;
}

/**
 * The Library plan this run ran — `template:nl-single@2` → `nl-single` — or
 * `null` for a plan generated for this run alone, which has no entry to draw.
 */
export function planKeyOf(trace: TraceRead): string | null {
	const m = /^(?:template|promoted):([^@]+)/.exec(trace.plan_origin ?? "");
	return m ? m[1] : null;
}

/** What opened it, in a reader's words — `a session message`, `a schedule`. */
function openedVia(trace: TraceRead): string {
	switch (trace.triggered_by) {
		case "schedule":
			return "a schedule";
		case "task":
			return "a task";
		case "delegation":
			return "a delegation";
		default:
			return trace.ask_kind === "import" || trace.ask_kind === "bulk"
				? "an import"
				: "a session message";
	}
}

/** The unit a layer's engagements are counted in. */
const UNIT: Record<string, [string, string]> = {
	llm: ["call", "calls"],
	agent: ["check", "checks"],
	human: ["answer", "answers"],
	third_party: ["call", "calls"],
	cache: ["hit", "hits"],
};

function touchNote(layer: string, rows: Touch[]): string {
	if (rows.some((t) => t.direction === "refused")) return "refused";
	const engaged = rows.filter((t) => t.direction !== "skipped");
	// The cache's own word for a lookup that found nothing — not *untouched*.
	if (!engaged.length) return rows.length ? "miss" : "not touched";
	const records = engaged.reduce((n, t) => n + (t.volume.rows ?? 0), 0);
	if (records) return `${records.toLocaleString()} rows`;
	const [one, many] = UNIT[layer] ?? ["call", "calls"];
	return `${engaged.length} ${engaged.length === 1 ? one : many}`;
}

export function runSummary(
	trace: TraceRead,
	touches: TouchesResponse | undefined,
	agentName?: string,
): RunSummary {
	const live = !trace.finished_at;
	const elapsed =
		trace.duration_ms ?? durationMs(originOf(trace), trace.finished_at);

	// Work is what the steps did; a paused step's span is the wait, not work.
	const working = trace.steps.filter((s) => s.status !== "needs_input");
	const workMs = working.reduce((n, s) => n + (s.duration_ms ?? 0), 0);

	// Asking is measurable: from the step that paused to the attempt that
	// answered it. Anything else between elapsed and work is left unnamed.
	const bySeq = [...trace.steps].sort((a, b) => a.seq - b.seq);
	const askingMs = bySeq.reduce((n, s, i) => {
		if (s.status !== "needs_input" || !s.finished_at) return n;
		const next = bySeq.slice(i + 1).find((x) => x.started_at);
		const gap = next ? durationMs(s.finished_at, next.started_at) : null;
		return n + Math.max(0, gap ?? 0);
	}, 0);
	const waitingMs = elapsed != null ? elapsed - workMs : null;

	// Only what the person asked, as they typed it — a `ql` run's body is its
	// query, drawn monospace. What the runtime made of a question is the page's.
	const asked = trace.body?.trim() || null;
	const theRun: SummaryRow[] = [
		...(asked
			? [
					{
						label: "asked",
						value: asked,
						...(trace.ask_kind === "ql" ? { kind: "query" as const } : {}),
					},
				]
			: []),
		{ label: "plan", value: planOf(trace) },
		...(trace.agent_id
			? [{ label: "agent", value: agentName ?? trace.agent_id }]
			: []),
		// `Everything` is a real world and the default one — never a blank.
		{
			label: "lens",
			value: trace.lens_name ?? "Everything",
			kind: "lens",
			lens: trace.lens_ref ?? undefined,
		},
		{
			label: "opened by",
			value: trace.opened_by
				? `${trace.opened_by} · ${openedVia(trace)}`
				: openedVia(trace),
		},
		...(elapsed != null
			? [
					{
						label: "elapsed",
						value: live
							? `${formatElapsed(elapsed)} so far`
							: formatElapsed(elapsed),
					},
				]
			: []),
	];

	const ceiling = trace.budget?.max_cost_usd_run ?? null;
	const cost: SummaryRow[] = [
		...(trace.cost_usd != null
			? [
					{
						label: "cost",
						value: ceiling
							? `${usd(trace.cost_usd)} of ${usd(ceiling)}`
							: usd(trace.cost_usd),
					},
				]
			: []),
		...(trace.tokens_in || trace.tokens_out
			? [
					{
						label: "tokens",
						value: `${formatCompact(trace.tokens_in)} in · ${formatCompact(trace.tokens_out)} out`,
					},
				]
			: []),
		...(waitingMs != null && waitingMs >= 1000
			? [
					{
						label: "waiting",
						value: askingMs
							? `${formatElapsed(waitingMs)} — ${formatElapsed(askingMs)} asking`
							: formatElapsed(waitingMs),
					},
				]
			: []),
	];

	const ledger = touches?.items ?? [];
	// A run that froze no lens recorded nothing — absent, not six muted lines
	// saying it touched nothing (SR34 · SR68).
	const touched: TouchItem[] = !trace.governed
		? []
		: BANDS.map((layer) => {
				const rows = ledger.filter((t) => t.layer === layer);
				const refused = rows.some((t) => t.direction === "refused");
				return {
					layer,
					note: touchNote(layer, rows),
					refused,
					// A layer nothing reached for is muted, never dropped (D22).
					dim: !refused && !rows.some((t) => t.direction !== "skipped"),
				};
			});

	const refusals = ledger.filter((t) => t.direction === "refused");
	const refused = [...new Set(refusals.map((t) => t.address))].map(
		(address) => {
			const t = refusals.find((r) => r.address === address);
			return {
				address,
				why:
					t?.why ??
					(t?.rule_matched
						? `Denied by ${t.rule_matched}.`
						: "Denied by a guardrail."),
			};
		},
	);

	const bounds: SummaryRow[] = [];
	let exhausted = 0;
	const maxQuestions = trace.budget?.max_clarifications;
	if (maxQuestions != null) {
		// A round is one pass at understanding; each question asked opens another.
		const rounds = trace.clarifications + 1;
		if (rounds >= maxQuestions + 1) exhausted += 1;
		bounds.push({ label: "rounds", value: `${rounds} of ${maxQuestions + 1}` });
	}
	const retryable = trace.steps.filter((s) => s.max_attempts > 1);
	if (retryable.length) {
		const worst = retryable.reduce((a, b) =>
			b.attempt / b.max_attempts > a.attempt / a.max_attempts ? b : a,
		);
		if (worst.attempt >= worst.max_attempts) exhausted += 1;
		bounds.push({
			label: "attempts",
			value: `${worst.attempt} of ${worst.max_attempts} · ${worst.step_key ?? worst.task_key}`,
		});
	}
	const maxReplans = trace.budget?.max_replans;
	if (maxReplans) {
		if (trace.replans >= maxReplans) exhausted += 1;
		bounds.push({
			label: "replans",
			value: `${trace.replans} of ${maxReplans}`,
		});
	}

	return {
		work: workMs ? `${formatElapsed(workMs)} of work` : null,
		theRun,
		cost,
		touched,
		refusedCount: refused.length,
		bounds,
		boundsAside: bounds.length
			? exhausted
				? `${exhausted} exhausted`
				: "none exhausted"
			: null,
		refused,
	};
}
