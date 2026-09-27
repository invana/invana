/**
 * The model page's charts, as slots (the-model-page.md · Surfaces).
 *
 * `@invana/charts` is being built in design-kit. Until it ships, each chart the
 * design draws is a placeholder here that takes **the props the real component
 * will** and renders a kit `Card` at the chart's real height, naming the chart
 * and summarising what it was handed — so the layout is final, and swapping in
 * the kit's charts changes this file and nothing else. The numbers a chart owes
 * as a table (the dataviz rule) are already the tab's own table.
 */

import { Card, Eyebrow } from "@invana/ui";

/** How a value reads on an axis, a tooltip or a summary. */
export type ChartFormat = "count" | "ms" | "percent";

/** A moment on the time axis that something happened — an import, a commit. */
export interface ChartMark {
	/** Index into `labels`. */
	at: number;
	label: string;
	/** The run or record that wrote it, when there is one to open. */
	href?: string;
}

/** A horizontal line the series is read against — the Graph's p95. */
export interface ChartReference {
	value: number;
	label: string;
}

export interface ChartSeries {
	key: string;
	label: string;
	/** One value per `labels` entry; `null` where nothing was recorded. */
	values: (number | null)[];
}

const nf = new Intl.NumberFormat();

function formatValue(v: number, format: ChartFormat): string {
	if (format === "ms")
		return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
	if (format === "percent") return `${Math.round(v * 100)}%`;
	return nf.format(Math.round(v));
}

function peak(series: ChartSeries[], stacked: boolean): number {
	const days = Math.max(0, ...series.map((s) => s.values.length));
	let top = 0;
	for (let i = 0; i < days; i++) {
		const at = series.map((s) => s.values[i] ?? 0);
		const here = stacked ? at.reduce((a, b) => a + b, 0) : Math.max(0, ...at);
		top = Math.max(top, here);
	}
	return top;
}

function Slot({
	name,
	height,
	summary,
	inline = false,
}: {
	name: string;
	height: number;
	summary: string;
	/** A table cell: name and summary on one line. */
	inline?: boolean;
}) {
	return (
		<Card
			role="img"
			aria-label={`${name} — ${summary}`}
			className={
				inline
					? "flex flex-row items-center gap-1.5 overflow-hidden px-1.5"
					: "flex flex-col justify-center gap-1 px-3"
			}
			style={{ height }}
		>
			<Eyebrow>{name}</Eyebrow>
			<span className="truncate text-sm text-muted-foreground">{summary}</span>
		</Card>
	);
}

// ── Overview (All models) — queries a day, stacked by caller ────────────────

export interface QueriesByCallerChartProps {
	/** One label per day, oldest first. */
	labels: string[];
	/** `agent` · `plan` · `explorer` · `api`, stacked in that order. */
	series: ChartSeries[];
	format?: ChartFormat;
	height?: number;
}

export function QueriesByCallerChart({
	labels,
	series,
	format = "count",
	height = 140,
}: QueriesByCallerChartProps) {
	return (
		<Slot
			name="Queries a day, by caller"
			height={height}
			summary={`${labels.length} days · ${series.length} series · peak ${formatValue(peak(series, true), format)}`}
		/>
	);
}

// ── Overview (one model) and Performance — p95 a day ────────────────────────

export interface P95ChartProps {
	labels: string[];
	/** p95 a day in ms; `null` on a day nothing ran. */
	values: (number | null)[];
	/** Imports and other writes, marked on the line. */
	marks?: ChartMark[];
	/** The Graph's p95, drawn across the chart. */
	reference?: ChartReference;
	format?: ChartFormat;
	height?: number;
}

export function P95Chart({
	labels,
	values,
	marks = [],
	reference,
	format = "ms",
	height = 140,
}: P95ChartProps) {
	const recorded = values.filter((v): v is number => v != null);
	return (
		<Slot
			name="p95 a day"
			height={height}
			summary={[
				`${labels.length} days`,
				recorded.length
					? `peak ${formatValue(Math.max(...recorded), format)}`
					: "nothing ran",
				`${marks.length} marks`,
				reference
					? `${reference.label} ${formatValue(reference.value, format)}`
					: null,
			]
				.filter(Boolean)
				.join(" · ")}
		/>
	);
}

// ── Growth — records over time, stepped and stacked ─────────────────────────

export interface GrowthChartProps {
	labels: string[];
	/** By model at All models, by type at one model. Stepped: a value holds until the next write. */
	series: ChartSeries[];
	/** Each import and stitch commit that wrote records. */
	marks?: ChartMark[];
	format?: ChartFormat;
	height?: number;
}

export function GrowthChart({
	labels,
	series,
	marks = [],
	format = "count",
	height = 180,
}: GrowthChartProps) {
	return (
		<Slot
			name="Records over time"
			height={height}
			summary={`${labels.length} days · ${series.length} series · peak ${formatValue(peak(series, true), format)} · ${marks.length} writes`}
		/>
	);
}

// ── Table cells — share of queries, and who called ──────────────────────────

export interface InlineMeterProps {
	/** `0`–`1` — this row's share of the window's queries. */
	value: number;
	label?: string;
	width?: number;
}

export function InlineMeter({ value, label, width = 80 }: InlineMeterProps) {
	return (
		<span className="inline-block" style={{ width }}>
			<Slot
				name="Share"
				height={20}
				inline
				summary={label ?? formatValue(value, "percent")}
			/>
		</span>
	);
}

export interface SegmentedBarProps {
	/** `agent` · `plan` · `explorer` · `api`, each a count. */
	segments: { key: string; label: string; value: number }[];
	format?: ChartFormat;
	width?: number;
}

export function SegmentedBar({
	segments,
	format = "count",
	width = 120,
}: SegmentedBarProps) {
	const total = segments.reduce((a, s) => a + s.value, 0);
	return (
		<span className="inline-block" style={{ width }}>
			<Slot
				name="By caller"
				height={20}
				inline
				summary={`${segments.length} callers · ${formatValue(total, format)}`}
			/>
		</span>
	);
}
