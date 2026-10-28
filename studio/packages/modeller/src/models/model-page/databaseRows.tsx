/**
 * The Database tab — what the database holds, each row marked against the
 * models (the-model-page.md).
 *
 * The rows are the mirror's and the counts are live. Unmodelled rows sort
 * first (the engine's order). A connector that cannot list its indexes says so
 * in their place; a mirror that was never captured offers `Introspect` and
 * draws no marks.
 */

import type { RowSpec } from "@invana/boards";
import { type ColumnDef, DataTable } from "@invana/tables";
import { EmptyState, MarkChip, type MarkTone, SectionHeader } from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { Database, RefreshCw } from "lucide-react";
import type {
	Drift,
	PhysicalRule,
	PhysicalSchema,
	PhysicalType,
} from "../types";

const DRIFT: Record<Drift, { tone: MarkTone; glyph: string; label: string }> = {
	in_both: { tone: "success", glyph: "●", label: "in both" },
	model_only: { tone: "warning", glyph: "◐", label: "model only" },
	database_only: { tone: "destructive", glyph: "◑", label: "database only" },
};

/** A glyph beside the word, so drift is never colour alone. */
function DriftMark({ drift }: { drift: Drift }) {
	const d = DRIFT[drift];
	return (
		<MarkChip tone={d.tone}>
			{d.glyph} {d.label}
		</MarkChip>
	);
}

const nf = new Intl.NumberFormat();

/** An edge type several stitches share reads `3 stitches`, the pairs on hover. */
const modelsCell = (models: string[]) =>
	models.length > 1 && models.every((m) => m.includes("⇄")) ? (
		<span title={models.join(" · ")}>{models.length} stitches</span>
	) : models.length ? (
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
			emptyState={<EmptyState className="py-6" title={empty} />}
		/>
	);
}

const modelled = (tally: PhysicalSchema["labels_tally"]) =>
	`${tally.modelled} modelled · ${tally.unmodelled} not`;

const inDatabase = (present: number, declared: number) =>
	`${declared} declared · ${present} in the database`;

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
		<ActButton
			area="model"
			variant="outline"
			disabled={opts.introspecting}
			onClick={opts.onIntrospect}
		>
			<RefreshCw /> Introspect
		</ActButton>
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
					aside: modelled(physical.labels_tally),
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
					aside: modelled(physical.relationship_types_tally),
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
						? inDatabase(physical.indexes_present, physical.declared_indexes)
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
						? inDatabase(
								physical.constraints_present,
								physical.declared_constraints,
							)
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

/** Rows that disagree with the models — the Overview's drift tile, as the engine counted them. */
export function driftCount(physical: PhysicalSchema | undefined) {
	if (!physical?.captured_at) return null;
	return physical.drift;
}
