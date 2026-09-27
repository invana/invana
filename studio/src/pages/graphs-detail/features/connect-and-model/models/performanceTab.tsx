/**
 * The Performance tab — query shapes by total time, p95 a day, and advice
 * (the-model-page.md MP12 · MP13 · MP39).
 *
 * A shape is a query with its literals taken out, so a thousand calls of one
 * generated query are one row. Picking a row opens its card: the full shape,
 * the plan it was explained with, its slowest calls and — where the plan found
 * a label scan filtered on a property with no index — *Add index to draft* on
 * the model that declares the label. Advice is a draft change, never a write.
 */

import type {
	GrowthMark,
	Performance,
	ShapeCard,
	ShapeRow,
} from "@/types/models";
import { LineChart } from "@invana/charts";
import type { RowSpec } from "@invana/dashboard";
import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Alert,
	AlertDescription,
	Button,
	Eyebrow,
	MarkChip,
	PropertyList,
	PropertyRow,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Spinner,
} from "@invana/ui";
import { Plus } from "lucide-react";
import {
	SignalMark,
	callerSplit,
	dayLabel,
	fmtMs,
	fmtNum,
} from "./insightParts";

export interface PerformanceTabOptions {
	scopeName: string | null;
	days: number;
	/** Imports and stitch commits, marked on the p95 line. */
	marks: GrowthMark[];
	selected: string | null;
	onSelect: (hash: string) => void;
}

/** The p95 line, with the Graph's p95 across it and each write marked. */
export function P95Line({
	days,
	graphP95,
	marks,
	height = 120,
}: {
	days: { label: string; value: number | null }[];
	graphP95: number | null;
	marks: GrowthMark[];
	height?: number;
}) {
	return (
		<LineChart
			values={days.map((d) => d.value)}
			labels={days.map((d) => dayLabel(d.label))}
			format={(v) => fmtMs(v)}
			marks={marks.map((m) => ({
				index: m.index,
				label: m.source === "import" ? "import" : "stitch commit",
			}))}
			reference={
				graphP95 != null
					? { value: graphP95, label: `Graph p95 ${fmtMs(graphP95)}` }
					: undefined
			}
			height={height}
			empty={<span className="text-muted-foreground">nothing ran</span>}
		/>
	);
}

export function performanceRows(
	performance: Performance | null | undefined,
	graphP95: number | null,
	loading: boolean,
	opts: PerformanceTabOptions,
): RowSpec[] {
	if (loading || !performance)
		return [
			{
				panels: [
					{
						kind: "metrics",
						options: {
							tiles: ["Queries", "p50", "p95", "Errors", "Slow shapes"].map(
								(label) => ({
									label,
									value: "…",
								}),
							),
						},
					},
				],
			},
		];

	const one = !!opts.scopeName;
	const errorRate = performance.total
		? performance.errors / performance.total
		: 0;
	const slow = (p: number | null) =>
		p != null && graphP95 != null && p >= graphP95;

	const columns: ColumnDef<ShapeRow>[] = [
		{
			id: "shape",
			header: "shape",
			cell: ({ row }) => (
				<span
					className="block max-w-[28rem] truncate font-mono"
					title={row.original.text}
				>
					{row.original.text}
				</span>
			),
		},
		{
			id: "callers",
			header: "callers",
			cell: ({ row }) => row.original.callers.join(" · "),
		},
		...(
			[
				["calls", (r: ShapeRow) => fmtNum(r.calls)],
				["p50", (r: ShapeRow) => fmtMs(r.p50)],
			] as const
		).map(([id, value]) => ({
			id,
			header: id,
			cell: ({ row }: { row: { original: ShapeRow } }) => (
				<span className="font-mono tabular-nums">{value(row.original)}</span>
			),
		})),
		{
			id: "p95",
			header: "p95",
			cell: ({ row }) => (
				<span
					className={`font-mono tabular-nums ${slow(row.original.p95) ? "text-warning" : ""}`}
				>
					{fmtMs(row.original.p95)}
				</span>
			),
		},
		{
			id: "rows",
			header: "rows",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums">
					{fmtNum(row.original.rows)}
				</span>
			),
		},
		{
			id: "advice",
			header: "advice",
			cell: ({ row }) =>
				row.original.has_advice ? (
					<SignalMark signal="advice" subject="missing index" />
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
	];

	return [
		{
			panels: [
				{
					kind: "metrics",
					options: {
						tiles: [
							{
								label: "Queries",
								value: fmtNum(performance.total),
								caption: one
									? `touching ${opts.scopeName}`
									: `${opts.days} days`,
							},
							{
								label: "p50",
								value: fmtMs(performance.p50),
								caption: one ? "" : "half of calls under it",
							},
							{
								label: "p95",
								value: fmtMs(performance.p95),
								caption:
									graphP95 != null ? `the Graph's ${fmtMs(graphP95)}` : "",
								tone: one && slow(performance.p95) ? "warning" : undefined,
							},
							{
								label: "Errors",
								value: `${(errorRate * 100).toFixed(1)}%`,
								caption: `${fmtNum(performance.errors)} of ${fmtNum(performance.total)}`,
								tone: performance.errors ? "error" : undefined,
							},
							{
								label: "Slow shapes",
								value: String(performance.slow_shapes),
								caption:
									graphP95 != null ? `p95 at or above ${fmtMs(graphP95)}` : "",
								tone: performance.slow_shapes ? "warning" : undefined,
							},
						],
					},
				},
			],
		},
		{
			panels: [
				{
					kind: "text",
					title: "p95 a day",
					aside:
						graphP95 != null
							? `the dashed line is ${fmtMs(graphP95)}`
							: undefined,
					options: { text: "" },
					render: (
						<P95Line
							days={performance.p95_by_day}
							graphP95={graphP95}
							marks={opts.marks}
						/>
					),
				},
			],
		},
		{
			panels: [
				{
					kind: "text",
					title: "Query shapes",
					aside: "by total time · pick one for its calls",
					flush: true,
					options: { text: "" },
					render: (
						<DataTable
							columns={columns}
							data={performance.shapes}
							density="compact"
							bordered={false}
							enablePagination={false}
							onRowClick={(r) => opts.onSelect(r.hash)}
							isRowSelected={(r) => r.hash === opts.selected}
							emptyState={
								<p className="px-3 py-6 text-muted-foreground">
									No query {one ? `touched ${opts.scopeName}` : "ran"} in{" "}
									{opts.days} days.
								</p>
							}
						/>
					),
				},
			],
		},
	];
}

/** A picked shape — its plan, its slowest calls, and the index it lacks (MP13 · MP39). */
export function ShapeSheet({
	open,
	card,
	loading,
	connector,
	canWrite,
	staging,
	onStage,
	onOpenRun,
	onClose,
}: {
	open: boolean;
	card: ShapeCard | undefined;
	loading: boolean;
	connector: string;
	canWrite: boolean;
	staging: boolean;
	onStage: (advice: ShapeCard["advice"][number]) => void;
	onOpenRun: (runId: string) => void;
	onClose: () => void;
}) {
	return (
		<Sheet open={open} onOpenChange={(o) => !o && onClose()}>
			<SheetContent className="flex w-[26rem] flex-col gap-3 overflow-y-auto">
				<SheetHeader>
					<SheetTitle>A query shape</SheetTitle>
					<SheetDescription>
						{card
							? `${fmtNum(card.calls)} calls in the window`
							: "Reading its calls…"}
					</SheetDescription>
				</SheetHeader>
				{loading || !card ? (
					<Spinner />
				) : (
					<>
						<PropertyList>
							<PropertyRow label="calls" mono>
								{fmtNum(card.calls)}
							</PropertyRow>
							<PropertyRow label="p50" mono>
								{fmtMs(card.p50)}
							</PropertyRow>
							<PropertyRow label="p95" mono>
								{fmtMs(card.p95)}
							</PropertyRow>
							<PropertyRow label="touched">
								{card.types.length ? card.types.join(" · ") : "no type"} · from
								the {card.touched_from === "plan" ? "plan" : "results"}
							</PropertyRow>
							<PropertyRow label="callers">
								{callerSplit(card.callers)}
							</PropertyRow>
						</PropertyList>
						<pre className="overflow-x-auto whitespace-pre-wrap rounded-control border bg-muted/40 p-2 font-mono text-sm">
							{card.text}
						</pre>
						{card.plan.length ? (
							<div className="flex flex-col gap-0.5">
								<Eyebrow>The plan</Eyebrow>
								{card.plan.map((line, i) => (
									<span key={`${i}:${line}`} className="font-mono text-sm">
										{line}
									</span>
								))}
							</div>
						) : null}
						{!card.explains ? (
							<Alert>
								<AlertDescription>
									Advice is not available on {connector} — it cannot explain a
									query.
								</AlertDescription>
							</Alert>
						) : (
							card.advice.map((a) => (
								<Alert key={`${a.label}.${a.property}`}>
									<AlertDescription className="flex flex-col gap-2">
										<span>
											<strong>
												{a.label}.{a.property} has no index.
											</strong>{" "}
											{fmtNum(a.calls)}{" "}
											{a.calls === 1
												? "call filtered on it — an index lets it seek"
												: "calls filtered on it — an index lets them seek"}{" "}
											instead of scan.
										</span>
										{canWrite && a.model_id ? (
											<>
												<span>
													<Button
														size="sm"
														disabled={staging}
														onClick={() => onStage(a)}
													>
														<Plus /> Add index to draft
													</Button>
												</span>
												<span className="text-muted-foreground">
													Stages{" "}
													<span className="font-mono">
														{a.label.toLowerCase()}_{a.property.toLowerCase()}
													</span>{" "}
													on {a.model_name}. Publishing creates it.
												</span>
											</>
										) : !a.model_id ? (
											<span className="text-muted-foreground">
												No model declares {a.label}.
											</span>
										) : null}
									</AlertDescription>
								</Alert>
							))
						)}
						<div className="flex flex-col gap-1">
							<Eyebrow>Slowest calls</Eyebrow>
							{card.slowest.map((c) => (
								<span key={c.at} className="flex items-center gap-2">
									{c.task_run_id ? (
										<Button
											variant="link"
											className="h-auto p-0 font-mono"
											onClick={() => onOpenRun(c.task_run_id as string)}
										>
											run:{c.task_run_id.slice(0, 8)}
										</Button>
									) : (
										<span className="font-mono text-muted-foreground">
											no run
										</span>
									)}
									<MarkChip tone="muted">{c.caller_kind}</MarkChip>
									<span className="flex-1" />
									<span className="font-mono text-muted-foreground">
										{fmtMs(c.duration_ms)}
									</span>
								</span>
							))}
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
