/**
 * What the Overview, Usage and Performance tabs share: the four callers as one
 * series set, a signal as a mark that is never colour alone, and
 * how a duration and a share are written.
 */

import { MarkChip, type MarkTone } from "@invana/ui";
import type {
	CallerKind,
	Signal,
	SignalKind,
} from "@/pages/graphs-detail/features/models/types";

/** The callers, in a fixed order, as their own categorical set. */
export const CALLER_SERIES: {
	key: CallerKind;
	label: string;
	color: string;
}[] = [
	{ key: "agent", label: "agent", color: "var(--color-data-5)" },
	{ key: "plan", label: "plan", color: "var(--color-data-6)" },
	{ key: "explorer", label: "Explorer", color: "var(--color-data-7)" },
	{ key: "api", label: "API", color: "var(--color-data-8)" },
];

const SIGNAL: Record<
	SignalKind,
	{ glyph: string; tone: MarkTone; label: string }
> = {
	hot_and_slow: { glyph: "▲", tone: "destructive", label: "hot and slow" },
	hot: { glyph: "▲", tone: "warning", label: "hot" },
	supernode: { glyph: "◆", tone: "warning", label: "supernode" },
	unused: { glyph: "○", tone: "muted", label: "unused" },
	empty: { glyph: "○", tone: "muted", label: "empty" },
	cold: { glyph: "○", tone: "muted", label: "cold" },
};

/** A signal, with its glyph — the tone repeats it, never carries it alone. */
export function SignalMark({
	signal,
	subject,
}: {
	signal: SignalKind | "advice" | "drift";
	subject?: string;
}) {
	const s =
		signal === "advice"
			? { glyph: "◆", tone: "info" as const, label: "advice" }
			: signal === "drift"
				? { glyph: "◑", tone: "destructive" as const, label: "drift" }
				: SIGNAL[signal];
	return (
		<MarkChip tone={s.tone}>
			{s.glyph} {s.label}
			{subject ? ` · ${subject}` : ""}
		</MarkChip>
	);
}

/** Every signal on a row, or `—`. At one model the subject is the row itself. */
export function Signals({
	signals,
	named = true,
}: {
	signals: Signal[];
	named?: boolean;
}) {
	if (!signals.length) return <span className="text-muted-foreground">—</span>;
	return (
		<span className="flex flex-wrap gap-1">
			{signals.map((s) => (
				<SignalMark
					key={`${s.signal}:${s.subject}`}
					signal={s.signal}
					subject={named ? s.subject.split(".").pop() : undefined}
				/>
			))}
		</span>
	);
}

export const fmtMs = (v: number | null | undefined) =>
	v == null
		? "—"
		: v >= 1000
			? `${(v / 1000).toFixed(1)}s`
			: `${Math.round(v)}ms`;

export const fmtPct = (v: number) =>
	v > 0 && v < 0.01 ? "<1%" : `${Math.round(v * 100)}%`;

const nf = new Intl.NumberFormat();
export const fmtNum = (v: number | null | undefined) =>
	v == null ? "—" : nf.format(Math.round(v));

const day = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
});
export const dayLabel = (iso: string) =>
	day.format(new Date(`${iso}T00:00:00`));

/** `agent 61% · plan 22%` — the two biggest callers. */
export function callerSplit(counts: Partial<Record<CallerKind, number>>) {
	const total = Object.values(counts).reduce((a, v) => a + (v ?? 0), 0);
	if (!total) return "no calls";
	return CALLER_SERIES.map((c) => ({ ...c, n: counts[c.key] ?? 0 }))
		.filter((c) => c.n)
		.sort((a, b) => b.n - a.n)
		.slice(0, 2)
		.map((c) => `${c.label} ${fmtPct(c.n / total)}`)
		.join(" · ");
}
