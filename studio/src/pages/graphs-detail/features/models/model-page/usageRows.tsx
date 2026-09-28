/**
 * The Usage tab — is each model, type and property used, and by whom
 * (the-model-page.md).
 *
 * Every count is split by caller. Below 50 queries on the Graph the counts
 * are drawn and nothing is called unused or hot; the tab says how many there
 * were and the number that turns signals on.
 */

import { InlineMeter, SegmentedBar, SegmentedBarLegend } from "@invana/charts";
import type { RowSpec } from "@invana/dashboard";
import { type ColumnDef, DataTable } from "@invana/tables";
import { Alert, AlertDescription } from "@invana/ui";
import { formatRelativeTime } from "@/lib/time";
import type {
	Usage,
	UsageRow,
} from "@/pages/graphs-detail/features/models/types";
import {
	CALLER_SERIES,
	callerSplit,
	fmtNum,
	SignalMark,
	Signals,
} from "./insightParts";

export interface UsageRowsOptions {
	scopeName: string | null;
	days: number;
}

const TOO_FEW = 50;

const last = (at: string | null) =>
	at ? formatRelativeTime(new Date(at)) : "never";

export function usageRows(
	usage: Usage | null | undefined,
	loading: boolean,
	opts: UsageRowsOptions,
): RowSpec[] {
	if (loading || !usage)
		return [
			{
				panels: [
					{
						kind: "metrics",
						options: {
							tiles: ["Queries", "Callers", "Unused types", "Hot types"].map(
								(label) => ({ label, value: "…" }),
							),
						},
					},
				],
			},
		];

	const one = !!opts.scopeName;
	const signalled = (kind: string) =>
		usage.rows.flatMap((r) =>
			r.signals.filter(
				(s) =>
					s.signal === kind || (kind === "hot" && s.signal === "hot_and_slow"),
			),
		);
	const unused = signalled("unused");
	const hot = signalled("hot");
	const cold = usage.properties.filter((p) => p.cold);
	const callers = CALLER_SERIES.filter((c) => usage.callers[c.key]);
	const needs = `needs ${TOO_FEW} queries`;

	const columns: ColumnDef<UsageRow>[] = [
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
			accessorKey: "queries",
			header: "queries",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums">
					{fmtNum(row.original.queries)}
				</span>
			),
		},
		{
			id: "share",
			header: "share",
			cell: ({ row }) => (
				<InlineMeter value={row.original.share} label="share of queries" />
			),
		},
		{
			id: "by_caller",
			header: "by caller",
			cell: ({ row }) => (
				<SegmentedBar values={row.original.by_caller} series={CALLER_SERIES} />
			),
		},
		{
			id: "last",
			header: "last touched",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{last(row.original.last_touched)}
				</span>
			),
		},
		{
			id: "signal",
			header: "signal",
			cell: ({ row }) =>
				usage.too_few ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<Signals signals={row.original.signals} named={!one} />
				),
		},
	];

	const rows: RowSpec[] = [];
	if (usage.too_few)
		rows.push({
			panels: [
				{
					kind: "text",
					options: { text: "" },
					render: (
						<Alert>
							<AlertDescription>
								<strong>
									{fmtNum(usage.total)}{" "}
									{usage.total === 1 ? "query" : "queries"} in {opts.days} days
									— too few to call anything unused.
								</strong>{" "}
								Counts are shown; signals start at {TOO_FEW} queries.
								{callers.length === 1
									? ` Every query so far came from the ${callers[0].label}.`
									: ""}
							</AlertDescription>
						</Alert>
					),
				},
			],
		});

	rows.push({
		panels: [
			{
				kind: "metrics",
				options: {
					tiles: [
						{
							label: "Queries",
							value: fmtNum(usage.total),
							caption: `${opts.days} days · ${fmtNum(usage.total / opts.days)} a day`,
						},
						{
							label: "Callers",
							value: String(callers.length),
							caption: callerSplit(usage.callers),
						},
						{
							label: "Unused types",
							value: usage.too_few ? "—" : String(unused.length),
							caption: usage.too_few
								? needs
								: unused
										.map((s) => s.subject)
										.slice(0, 2)
										.join(" · ") || "every type was asked about",
						},
						one && usage.explains
							? {
									label: "Cold properties",
									value: usage.too_few ? "—" : String(cold.length),
									caption: usage.too_few
										? needs
										: cold
												.slice(0, 2)
												.map((p) => `${p.type}.${p.property}`)
												.join(" · ") || "every property is read",
								}
							: {
									label: "Hot types",
									value: usage.too_few ? "—" : String(hot.length),
									caption: usage.too_few
										? needs
										: hot
												.map((s) => s.subject)
												.slice(0, 2)
												.join(" · ") || "none past 25%",
									tone:
										hot.length && !usage.too_few
											? ("warning" as const)
											: undefined,
								},
					],
				},
			},
		],
	});

	rows.push({
		panels: [
			{
				kind: "text",
				title: one ? "Each type" : "Each model",
				flush: true,
				options: { text: "" },
				render: (
					<>
						<div className="px-3 pt-2">
							<SegmentedBarLegend series={CALLER_SERIES} />
						</div>
						<DataTable
							columns={columns}
							data={usage.rows}
							density="compact"
							bordered={false}
							enablePagination={false}
						/>
					</>
				),
			},
		],
	});

	if (!one && usage.stitches.length) {
		const crossed = usage.stitches.filter((s) => s.queries).length;
		rows.push({
			panels: [
				{
					kind: "text",
					title: "Stitches crossed",
					aside: `${usage.stitches.length} active · ${crossed} crossed by any query`,
					flush: true,
					options: { text: "" },
					render: (
						<DataTable
							columns={[
								{
									accessorKey: "pair",
									header: "stitch",
									cell: ({ row }) => (
										<span className="font-mono">{row.original.pair}</span>
									),
								},
								{ accessorKey: "kind", header: "kind" },
								{
									accessorKey: "queries",
									header: "queries",
									cell: ({ row }) => (
										<span className="font-mono tabular-nums">
											{fmtNum(row.original.queries)}
										</span>
									),
								},
								{
									id: "share",
									header: "share",
									cell: ({ row }) => <InlineMeter value={row.original.share} />,
								},
								{
									id: "last",
									header: "last crossed",
									cell: ({ row }) => (
										<span
											className={
												row.original.last_crossed
													? "text-muted-foreground"
													: "text-warning"
											}
										>
											{last(row.original.last_crossed)}
										</span>
									),
								},
							]}
							data={usage.stitches}
							density="compact"
							bordered={false}
							enablePagination={false}
						/>
					),
				},
			],
		});
	}

	if (one)
		rows.push({
			panels: [
				{
					kind: "text",
					title: "Properties",
					aside: usage.explains
						? "from the query plan"
						: "not explained on this connector",
					flush: true,
					options: { text: "" },
					render: usage.explains ? (
						<DataTable
							columns={[
								{
									id: "property",
									header: "property",
									cell: ({ row }) => (
										<span className="font-mono">
											{row.original.type}.{row.original.property}
										</span>
									),
								},
								...(["filtered", "returned", "ordered"] as const).map((k) => ({
									id: k,
									header: k,
									cell: ({
										row,
									}: {
										row: { original: Usage["properties"][number] };
									}) => (
										<span className="font-mono tabular-nums">
											{fmtNum(row.original[k])}
										</span>
									),
								})),
								{
									id: "signal",
									header: "signal",
									cell: ({ row }) =>
										row.original.cold ? (
											<SignalMark signal="cold" />
										) : (
											<span className="text-muted-foreground">—</span>
										),
								},
							]}
							data={usage.properties}
							density="compact"
							bordered={false}
							enablePagination={false}
						/>
					) : (
						<p className="px-3 py-4 text-muted-foreground">
							This connector cannot explain a query, so what each property was
							filtered, returned or ordered on is not known — and no property is
							called cold.
						</p>
					),
				},
			],
		});

	return rows;
}
