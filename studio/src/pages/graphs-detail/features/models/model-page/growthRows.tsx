/**
 * The Growth tab — records over time, from count snapshots (the-model-page.md
 * MP14 · MP32).
 *
 * Stacked by model at All models and by type at one model. The line moves only
 * on a day something wrote, and each write is a mark naming its source. A scope
 * nothing ever counted draws the never-imported state, never a chart of zeros.
 */

import { formatRelativeTime } from "@/lib/time";
import { slotForType } from "@/pages/graphs-detail/features/explorer";
import type {
	Growth,
	GrowthRow,
	WrittenBy,
} from "@/pages/graphs-detail/features/models/types";
import { StackedAreaChart } from "@invana/charts";
import type { RowSpec } from "@invana/dashboard";
import { type ColumnDef, DataTable } from "@invana/tables";
import { Button, EmptyState } from "@invana/ui";
import { Activity, Upload } from "lucide-react";

export interface GrowthRowsOptions {
	/** One model's name, and its version readout, when scoped. */
	scopeName: string | null;
	scopeVersion: string | null;
	/** `--color-data-N` slot per model id (ST17). */
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

const pct = (row: GrowthRow) =>
	row.start && row.change != null ? row.change / row.start : null;

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
						kind: "metrics",
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
	const colorOf = (key: string, name: string) => {
		const slot = one ? slotForType(name) : opts.hueOf(key);
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

	const now = growth.rows.reduce((a, r) => a + (r.now ?? 0), 0);
	const start = growth.rows.reduce((a, r) => a + (r.start ?? 0), 0);
	const grown = growth.rows
		.filter((r) => (r.change ?? 0) > 0)
		.sort(
			(a, b) =>
				(pct(b) ?? Number.POSITIVE_INFINITY) -
				(pct(a) ?? Number.POSITIVE_INFINITY),
		);
	// Counted at the start and the same now — or never counted at all. A row first
	// counted inside the window is new, not unchanged.
	const unchanged = growth.rows.filter((r) => r.change === 0 || r.now == null);
	// Nothing was counted before the window opened: there is no "in 30 days" yet.
	const opened = growth.rows.some((r) => r.start != null);
	const firstAt = growth.marks[0]?.at;
	const fastest = grown[0];
	const fastestPct = fastest ? pct(fastest) : null;

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
					kind: "metrics",
					options: {
						tiles: [
							{
								label: "Records",
								value: num(now),
								caption: !opened
									? firstAt
										? `first counted ${formatRelativeTime(new Date(firstAt))}`
										: "counted before any write"
									: now - start
										? `${now > start ? "↑" : "↓"} ${nf.format(Math.abs(now - start))} in ${opts.days} days`
										: `unchanged in ${opts.days} days`,
							},
							{
								label: "Writes",
								value: String(
									growth.writes.imports + growth.writes.stitch_commits,
								),
								caption: `${growth.writes.imports} ${growth.writes.imports === 1 ? "import" : "imports"} · ${growth.writes.stitch_commits} ${growth.writes.stitch_commits === 1 ? "stitch commit" : "stitch commits"}`,
							},
							{
								label: "Fastest growing",
								value: fastest ? fastest.name : "—",
								caption: fastest
									? fastestPct != null
										? `+${Math.round(fastestPct * 100)}%`
										: `${signed(fastest.change)}, from nothing`
									: "nothing grew",
							},
							{
								label: "Unchanged",
								value: unchanged.length ? unchanged[0].name : "—",
								caption: unchanged.length
									? unchanged.length === 1
										? unchanged[0].now
											? "nothing written"
											: "nothing imported"
										: `and ${unchanged.length - 1} more`
									: "every one moved",
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
					title: one
						? "Records over time, by type"
						: "Records over time, by model",
					aside: `${num(now)} today`,
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
				},
			],
		},
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
							enablePagination={false}
						/>
					),
				},
			],
		},
	];
}
