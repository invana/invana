/**
 * The Growth tab — records over time, from count snapshots (the-model-page.md).
 *
 * Stacked by model at All models and by type at one model. The line moves only
 * on a day something wrote, and each write is a mark naming its source. A scope
 * nothing ever counted draws the never-imported state, never a chart of zeros.
 */

import type { PanelSpec, RowSpec } from "@invana/boards";
import { StackedAreaChart } from "@invana/charts";
import { colorSlotByString } from "@invana/styling/color";
import { type ColumnDef, DataTable } from "@invana/tables";
import { Button, EmptyState } from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { Activity, Upload } from "lucide-react";
import type { Growth, GrowthRow, WrittenBy } from "../types";

export interface GrowthRowsOptions {
	/** One model's name, and its version readout, when scoped. */
	scopeName: string | null;
	scopeVersion: string | null;
	/** `--color-data-N` slot per model id. */
	hueOf: (modelId: string) => number | undefined;
	days: number;
	canWrite: boolean;
	onBringDataIn: () => void;
	onSeeTypes: () => void;
	onOpenRun: (runId: string) => void;
}

const nf = new Intl.NumberFormat();
const num = (v: number | null | undefined) => (v == null ? "—" : nf.format(v));
const signed = (v: number | null) =>
	v == null
		? "—"
		: v === 0
			? "—"
			: `${v > 0 ? "+" : "−"}${nf.format(Math.abs(v))}`;
const day = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
});
const dayOf = (iso: string) => day.format(new Date(`${iso}T00:00:00`));

const SOURCE_LABEL: Record<WrittenBy["source"], string> = {
	import: "import",
	stitch_commit: "stitch commit",
	introspect: "introspect",
};

function writtenBy(last: WrittenBy | null, onOpenRun: (id: string) => void) {
	if (!last)
		return <span className="text-muted-foreground">nothing imported</span>;
	const label = `${SOURCE_LABEL[last.source]} · ${formatRelativeTime(new Date(last.at))}`;
	return last.source_id && last.source !== "introspect" ? (
		<Button
			variant="link"
			className="h-auto p-0 font-mono"
			onClick={() => onOpenRun(last.source_id as string)}
		>
			{label}
		</Button>
	) : (
		<span className="font-mono">{label}</span>
	);
}

/**
 * The records-over-time chart as one panel — Growth's own, and the one a
 * model's Overview ends on, so the two read one series. Stacked by model at
 * All models and by type at one model.
 */
export function growthChartPanel(
	growth: Growth,
	opts: Pick<GrowthRowsOptions, "scopeName" | "hueOf">,
): PanelSpec {
	const one = !!opts.scopeName;
	const colorOf = (key: string, name: string) => {
		const slot = one ? colorSlotByString(name) : opts.hueOf(key);
		return `var(--color-data-${slot ?? 1})`;
	};
	const data = growth.labels.map((label, i) => ({
		label: dayOf(label),
		values: Object.fromEntries(
			growth.series.map((s) => [s.key, s.values[i] ?? 0]),
		),
	}));
	const series = growth.series.map((s) => ({
		key: s.key,
		label: s.name,
		color: colorOf(s.key, s.name),
	}));
	const marks = growth.marks.map((m) => ({
		index: m.index,
		label: SOURCE_LABEL[m.source],
	}));
	return {
		kind: "text",
		title: one ? "Records over time, by type" : "Records over time, by model",
		aside: `${num(growth.now)} today`,
		options: { text: "" },
		render: (
			<StackedAreaChart
				data={data}
				series={series}
				marks={marks}
				markLegend="a write — an import or a stitch commit"
				height={200}
			/>
		),
	};
}

export function growthRows(
	growth: Growth | null | undefined,
	loading: boolean,
	opts: GrowthRowsOptions,
): RowSpec[] {
	if (loading || !growth)
		return [
			{
				panels: [
					{
						kind: "grid",
						options: {
							tiles: ["Records", "Writes", "Fastest growing", "Unchanged"].map(
								(label) => ({ label, value: "…" }),
							),
						},
					},
				],
			},
		];

	if (!growth.counted)
		return [
			{
				panels: [
					{
						kind: "text",
						options: { text: "" },
						render: (
							<EmptyState
								className="py-10"
								icon={<Activity />}
								title={
									opts.scopeName
										? `${opts.scopeName} has no records yet`
										: "Nothing has been counted yet"
								}
								description={
									opts.scopeName
										? opts.scopeVersion
											? `Bring a dataset in against ${opts.scopeName} ${opts.scopeVersion} and its line starts at that import.`
											: `${opts.scopeName} is not published yet. Publish it, bring a dataset in, and its line starts at that import.`
										: "Records are counted whenever something writes them — an import, a stitch commit, or Introspect — and this line starts at the first."
								}
								actions={
									<>
										{opts.canWrite ? (
											<Button onClick={opts.onBringDataIn}>
												<Upload /> Bring data in
											</Button>
										) : null}
										{opts.scopeName ? (
											<Button variant="outline" onClick={opts.onSeeTypes}>
												See its types
											</Button>
										) : null}
									</>
								}
							/>
						),
					},
				],
			},
		];

	const one = !!opts.scopeName;
	const { now, change } = growth;
	// The engine picks the row; Studio only looks it up by key.
	const fastest = growth.rows.find((r) => r.key === growth.fastest);
	const unchanged = growth.rows.find((r) => r.unchanged);
	const firstAt = growth.marks[0]?.at;

	const columns: ColumnDef<GrowthRow>[] = [
		{
			accessorKey: "name",
			header: one ? "type" : "model",
			cell: ({ row }) => (
				<span className={one ? "font-mono" : undefined}>
					{row.original.name}
				</span>
			),
		},
		{
			id: "start",
			header: "at the start",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums">
					{num(row.original.start)}
				</span>
			),
		},
		{
			id: "now",
			header: "now",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums">{num(row.original.now)}</span>
			),
		},
		{
			id: "change",
			header: "change",
			cell: ({ row }) => (
				<span
					className={
						(row.original.change ?? 0) > 0
							? "text-success"
							: "text-muted-foreground"
					}
				>
					{signed(row.original.change)}
				</span>
			),
		},
		{
			id: "last",
			header: "last written by",
			cell: ({ row }) => writtenBy(row.original.last, opts.onOpenRun),
		},
	];

	return [
		{
			panels: [
				{
					kind: "grid",
					options: {
						// One row across, as the board draws it.
						minTileWidth: 140,
						tiles: [
							{
								label: "Records",
								value: num(now),
								// Nothing was counted before the window opened: there is no "in 30 days" yet.
								delta:
									change == null
										? firstAt
											? `first counted ${formatRelativeTime(new Date(firstAt))}`
											: "counted before any write"
										: change
											? `${change > 0 ? "↑" : "↓"} ${nf.format(Math.abs(change))} in ${opts.days} days`
											: `unchanged in ${opts.days} days`,
							},
							{
								label: "Writes",
								value: String(growth.writes.total),
								delta: `${growth.writes.imports} ${growth.writes.imports === 1 ? "import" : "imports"} · ${growth.writes.stitch_commits} ${growth.writes.stitch_commits === 1 ? "stitch commit" : "stitch commits"}`,
							},
							{
								label: "Fastest growing",
								value: fastest ? fastest.name : "—",
								delta: fastest
									? fastest.change_rate
										? `+${Math.round(fastest.change_rate.by * 100)}%`
										: `${signed(fastest.change)}, from nothing`
									: "nothing grew",
							},
							{
								label: "Unchanged",
								value: unchanged ? unchanged.name : "—",
								delta: unchanged
									? growth.unchanged === 1
										? unchanged.now
											? "nothing written"
											: "nothing imported"
										: `and ${growth.unchanged - 1} more`
									: "every one moved",
							},
						],
					},
				},
			],
		},
		{ panels: [growthChartPanel(growth, opts)] },
		{
			panels: [
				{
					kind: "text",
					title: one ? "Each type" : "Each model",
					aside: `opening value is the last count before ${dayOf(growth.labels[0])}`,
					flush: true,
					options: { text: "" },
					render: (
						<DataTable
							columns={columns}
							data={growth.rows}
							density="compact"
							bordered={false}
						/>
					),
				},
			],
		},
	];
}
