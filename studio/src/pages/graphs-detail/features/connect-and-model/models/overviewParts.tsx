/**
 * What the Overview draws beyond its tiles and table: every flagged signal as
 * **Needs attention**, each linking to its tab, and queries a day — by caller
 * at All models, p95 against the Graph's at one (the-model-page.md · The tabs).
 */

import type { GrowthMark, Overview } from "@/types/models";
import type { PhysicalSchema } from "@/types/schemas";
import { StackedBarChartV } from "@invana/charts";
import type { PanelSpec } from "@invana/dashboard";
import { type ColumnDef, DataTable } from "@invana/tables";
import { Button } from "@invana/ui";
import {
	CALLER_SERIES,
	SignalMark,
	dayLabel,
	fmtMs,
	fmtNum,
} from "./insightParts";
import { P95Line } from "./performanceTab";
import type { ModelsTab } from "./useModelsView";

export interface AttentionItem {
	signal: string;
	subject: string;
	why: string;
	tab: ModelsTab;
}

const TAB_LABEL: Partial<Record<ModelsTab, string>> = {
	usage: "Usage",
	performance: "Performance",
	growth: "Growth",
	database: "Database",
};

/** The drift rows, as attention items — unmodelled labels at All models, what the model lacks at one (MP9). */
export function driftAttention(
	physical: PhysicalSchema | undefined,
	one: boolean,
): AttentionItem[] {
	if (!physical?.captured_at) return [];
	const rows = [...physical.labels, ...physical.relationship_types];
	const rules = [...physical.indexes, ...physical.constraints];
	const out: AttentionItem[] = [];
	const unmodelled = rows.filter((r) => r.drift === "database_only");
	if (!one && unmodelled.length)
		out.push({
			signal: "drift",
			subject: `${unmodelled.length} unmodelled ${unmodelled.length === 1 ? "type" : "types"}`,
			why: unmodelled
				.slice(0, 3)
				.map((r) => r.name)
				.join(" · "),
			tab: "database",
		});
	const missing = rules.filter((r) => r.drift === "model_only");
	if (missing.length)
		out.push({
			signal: "drift",
			subject: `${missing.length} ${missing.length === 1 ? "index or constraint" : "indexes and constraints"} model only`,
			why: "declared, not in the database",
			tab: "database",
		});
	return out;
}

export function attentionPanel(
	overview: Overview,
	physical: PhysicalSchema | undefined,
	one: boolean,
	days: number,
	onTab: (tab: ModelsTab) => void,
): PanelSpec {
	const items: AttentionItem[] = [
		...overview.attention.map((a) => ({ ...a, tab: a.tab as ModelsTab })),
		...driftAttention(physical, one),
	];
	const columns: ColumnDef<AttentionItem>[] = [
		{
			id: "signal",
			header: "",
			cell: ({ row }) => (
				<SignalMark
					signal={
						row.original.signal as Parameters<typeof SignalMark>[0]["signal"]
					}
				/>
			),
		},
		{
			accessorKey: "subject",
			header: "",
			cell: ({ row }) => (
				<span className="font-mono">{row.original.subject}</span>
			),
		},
		{ accessorKey: "why", header: "" },
		{
			id: "tab",
			header: "",
			cell: ({ row }) => (
				<Button
					variant="link"
					className="h-auto p-0"
					onClick={() => onTab(row.original.tab)}
				>
					{TAB_LABEL[row.original.tab]} ›
				</Button>
			),
		},
	];
	return {
		kind: "text",
		title: "Needs attention",
		aside: `${items.length} · ${days} days`,
		flush: true,
		grow: 1.2,
		options: { text: "" },
		render: (
			<DataTable
				columns={columns}
				data={items}
				density="compact"
				bordered={false}
				enablePagination={false}
				emptyState={
					<p className="px-3 py-6 text-muted-foreground">
						Nothing is flagged in this window.
					</p>
				}
			/>
		),
	};
}

export function callersPanel(overview: Overview, days: number): PanelSpec {
	const total = overview.by_caller_by_day.reduce(
		(a, d) => a + Object.values(d.counts).reduce((x, y) => x + y, 0),
		0,
	);
	return {
		kind: "text",
		title: "Queries a day, by caller",
		aside: `${fmtNum(total)} · ${days} days`,
		options: { text: "" },
		render: (
			<StackedBarChartV
				data={overview.by_caller_by_day.map((d) => ({
					label: dayLabel(d.label),
					values: d.counts,
				}))}
				series={CALLER_SERIES}
				height={140}
				empty={
					<span className="text-muted-foreground">no query in the window</span>
				}
			/>
		),
	};
}

export function p95Panel(overview: Overview, marks: GrowthMark[]): PanelSpec {
	const today = overview.p95_by_day.at(-1)?.value ?? null;
	return {
		kind: "text",
		title: "p95 a day",
		aside: today != null ? `${fmtMs(today)} today` : undefined,
		options: { text: "" },
		render: (
			<P95Line
				days={overview.p95_by_day}
				graphP95={overview.graph_p95}
				marks={marks}
			/>
		),
	};
}
