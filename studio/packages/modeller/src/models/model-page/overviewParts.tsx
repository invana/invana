/**
 * What the Overview draws beyond its tiles and table: every flagged signal as
 * **Needs attention**, each linking to its tab, and queries a day — by caller
 * at All models, p95 against the Graph's at one (the-model-page.md · The tabs).
 */

import type { PanelSpec } from "@invana/boards";
import { StackedBarChartV } from "@invana/charts";
import { type ColumnDef, DataTable } from "@invana/tables";
import { Button } from "@invana/ui";
import type { Overview, PhysicalSchema } from "../types";
import { CALLER_SERIES, dayLabel, fmtNum, SignalMark } from "./insightParts";
import type { ModelsTab } from "./useModelsView";

interface AttentionItem {
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

/** The drift rows, as attention items — unmodelled labels at All models, what the model lacks at one. */
function driftAttention(
	physical: PhysicalSchema | undefined,
	one: boolean,
): AttentionItem[] {
	const drift = physical?.captured_at ? physical.drift : null;
	if (!physical || !drift) return [];
	const out: AttentionItem[] = [];
	const unmodelled = drift.unmodelled_types;
	if (!one && unmodelled)
		out.push({
			signal: "drift",
			subject: `${unmodelled} unmodelled ${unmodelled === 1 ? "type" : "types"}`,
			why: [...physical.labels, ...physical.relationship_types]
				.filter((r) => r.drift === "database_only")
				.slice(0, 3)
				.map((r) => r.name)
				.join(" · "),
			tab: "database",
		});
	const missing = drift.model_only_rules;
	if (missing)
		out.push({
			signal: "drift",
			subject: `${missing} ${missing === 1 ? "index or constraint" : "indexes and constraints"} model only`,
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
	// Drift reads from the mirror and sits first; the engine's flags are its
	// first six, and `attention_total` says how many there are in all.
	const drift = driftAttention(physical, one);
	const items: AttentionItem[] = [
		...drift,
		...overview.attention.map((a) => ({ ...a, tab: a.tab as ModelsTab })),
	];
	const more = overview.attention_total - overview.attention.length;
	const columns: ColumnDef<AttentionItem>[] = [
		{
			id: "signal",
			header: "signal",
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
			header: "type",
			cell: ({ row }) => (
				<span className="font-mono">{row.original.subject}</span>
			),
		},
		{ accessorKey: "why", header: "reading" },
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
		aside: `${overview.attention_total + drift.length} · ${days} days`,
		flush: true,
		grow: 1.2,
		options: { text: "" },
		render: (
			<>
				<DataTable
					columns={columns}
					data={items}
					density="compact"
					bordered={false}
					emptyState={
						<p className="px-3 py-6 text-muted-foreground">
							Nothing is flagged in this window.
						</p>
					}
				/>
				{more > 0 ? (
					<div className="border-t border-border px-3 py-1.5">
						<Button
							variant="link"
							className="h-auto p-0"
							onClick={() => onTab("usage")}
						>
							+{more} more in Usage ›
						</Button>
					</div>
				) : null}
			</>
		),
	};
}

export function callersPanel(overview: Overview, days: number): PanelSpec {
	return {
		kind: "text",
		title: "Queries a day, by caller",
		aside: `${fmtNum(overview.total)} · ${days} days`,
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
