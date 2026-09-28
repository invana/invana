/**
 * The Database tab — what the database holds, each row marked against the
 * models (the-model-page.md MP9 · MP26–MP28).
 *
 * The rows are the mirror's and the counts are live. Unmodelled rows sort
 * first (the engine's order). A connector that cannot list its indexes says so
 * in their place; a mirror that was never captured offers `Introspect` and
 * draws no marks.
 */

import { formatRelativeTime } from "@/lib/time";
import type {
	Drift,
	PhysicalRule,
	PhysicalSchema,
	PhysicalType,
} from "@/pages/graphs-detail/features/models/types";
import type { RowSpec } from "@invana/dashboard";
import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Button,
	EmptyState,
	MarkChip,
	type MarkTone,
	SectionHeader,
} from "@invana/ui";
import { Database, RefreshCw } from "lucide-react";

const DRIFT: Record<Drift, { tone: MarkTone; glyph: string; label: string }> = {
	in_both: { tone: "success", glyph: "●", label: "in both" },
	model_only: { tone: "warning", glyph: "◐", label: "model only" },
	database_only: { tone: "destructive", glyph: "◑", label: "database only" },
};

/** A glyph beside the word, so drift is never colour alone. */
export function DriftMark({ drift }: { drift: Drift }) {
	const d = DRIFT[drift];
	return (
		<MarkChip tone={d.tone}>
			{d.glyph} {d.label}
		</MarkChip>
	);
}

const nf = new Intl.NumberFormat();

const modelsCell = (models: string[]) =>
	models.length ? (
		models.join(" · ")
	) : (
		<span className="text-destructive">no model</span>
	);

const typeColumns = (
	name: string,
	countLabel: string,
): ColumnDef<PhysicalType>[] => [
	{
		accessorKey: "name",
		header: name,
		cell: ({ row }) => <span className="font-mono">{row.original.name}</span>,
	},
	{
		id: "models",
		header: "model",
		cell: ({ row }) => modelsCell(row.original.models),
	},
	{
		accessorKey: "count",
		header: countLabel,
		cell: ({ row }) => (
			<span className="font-mono tabular-nums">
				{row.original.count == null ? "—" : nf.format(row.original.count)}
			</span>
		),
	},
	{
		id: "drift",
		header: "drift",
		cell: ({ row }) => <DriftMark drift={row.original.drift} />,
	},
];

const ruleColumns: ColumnDef<PhysicalRule>[] = [
	{
		accessorKey: "name",
		header: "name",
		cell: ({ row }) => <span className="font-mono">{row.original.name}</span>,
	},
	{
		id: "on",
		header: "on",
		cell: ({ row }) => (
			<span className="font-mono">
				{row.original.label}.{row.original.properties.join(", ")}
				{row.original.type === "fulltext" ? " · fulltext" : ""}
			</span>
		),
	},
	{
		id: "drift",
		header: "drift",
		cell: ({ row }) => <DriftMark drift={row.original.drift} />,
	},
];

function table<T>(columns: ColumnDef<T>[], data: T[], empty: string) {
	return (
		<DataTable
			columns={columns}
			data={data}
			density="compact"
			bordered={false}
			enablePagination={false}
			emptyState={<EmptyState className="py-6" title={empty} />}
		/>
	);
}

const modelled = (rows: PhysicalType[]) => {
	const not = rows.filter((r) => r.drift === "database_only").length;
	return `${rows.length - not} modelled · ${not} not`;
};

const inDatabase = (rows: PhysicalRule[], declared: number) =>
	`${declared} declared · ${rows.filter((r) => r.drift !== "model_only").length} in the database`;

export interface DatabaseRowsOptions {
	/** One model's name when scoped — its rows only, no unmodelled section. */
	scopeName: string | null;
	canWrite: boolean;
	introspecting: boolean;
	onIntrospect: () => void;
}

export function databaseRows(
	physical: PhysicalSchema | undefined,
	loading: boolean,
	opts: DatabaseRowsOptions,
): RowSpec[] {
	const introspect = opts.canWrite ? (
		<Button
			variant="outline"
			disabled={opts.introspecting}
			onClick={opts.onIntrospect}
		>
			<RefreshCw /> Introspect
		</Button>
	) : null;

	if (loading || !physical)
		return [
			{
				panels: ["Labels", "Relationship types"].map((title) => ({
					kind: "text" as const,
					title,
					options: { text: "…" },
				})),
			},
		];

	if (!physical.captured_at)
		return [
			{
				panels: [
					{
						kind: "text",
						options: { text: "" },
						render: (
							<EmptyState
								className="py-10"
								icon={<Database />}
								title="Never introspected"
								description="Introspect reads the labels, relationship types, indexes and constraints the database holds, and this tab marks each against the models."
								actions={introspect}
							/>
						),
					},
				],
			},
		];

	const connector = physical.connector ?? "This connector";
	const notReported = (what: "indexes" | "constraints", declared: number) => (
		<EmptyState
			className="py-6"
			title={`${connector} does not report ${what}.`}
			description={`${opts.scopeName ?? "The models"} ${opts.scopeName ? "declares" : "declare"} ${declared}; there is nothing to check them against.`}
		/>
	);

	const toolbar = (
		<SectionHeader
			bare
			title={
				<span
					className={
						physical.stale
							? "font-normal text-warning"
							: "font-normal text-muted-foreground"
					}
				>
					{connector} · captured{" "}
					{formatRelativeTime(new Date(physical.captured_at))} · by{" "}
					<span className="font-mono">introspect</span>
					{physical.stale ? " · data was imported since" : ""}
				</span>
			}
			actions={
				<>
					{(Object.keys(DRIFT) as Drift[]).map((d) => (
						<DriftMark key={d} drift={d} />
					))}
					{introspect}
				</>
			}
		/>
	);

	return [
		{
			panels: [{ kind: "text", options: { text: "" }, render: toolbar }],
		},
		{
			panels: [
				{
					kind: "text",
					title: "Labels",
					aside: modelled(physical.labels),
					flush: true,
					options: { text: "" },
					render: table(
						typeColumns("label", "nodes"),
						physical.labels,
						"No labels",
					),
				},
				{
					kind: "text",
					title: "Relationship types",
					aside: modelled(physical.relationship_types),
					flush: true,
					options: { text: "" },
					render: table(
						typeColumns("type", "edges"),
						physical.relationship_types,
						"No relationship types",
					),
				},
			],
		},
		{
			panels: [
				{
					kind: "text",
					title: "Indexes",
					aside: physical.lists_schema
						? inDatabase(physical.indexes, physical.declared_indexes)
						: "not reported",
					flush: true,
					options: { text: "" },
					render: physical.lists_schema
						? table(ruleColumns, physical.indexes, "No indexes")
						: notReported("indexes", physical.declared_indexes),
				},
				{
					kind: "text",
					title: "Constraints",
					aside: physical.lists_schema
						? inDatabase(physical.constraints, physical.declared_constraints)
						: "not reported",
					flush: true,
					options: { text: "" },
					render: physical.lists_schema
						? table(ruleColumns, physical.constraints, "No constraints")
						: notReported("constraints", physical.declared_constraints),
				},
			],
		},
	];
}

/** Rows that disagree with the models — the Overview's drift tile (MP9). */
export function driftCount(physical: PhysicalSchema | undefined) {
	if (!physical?.captured_at) return null;
	const rows = [
		...physical.labels,
		...physical.relationship_types,
		...physical.indexes,
		...physical.constraints,
	];
	const off = rows.filter((r) => r.drift !== "in_both");
	const labels = [...physical.labels, ...physical.relationship_types].filter(
		(r) => r.drift !== "in_both",
	).length;
	return { total: off.length, labels, rules: off.length - labels };
}
