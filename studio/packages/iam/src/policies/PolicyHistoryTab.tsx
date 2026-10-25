/**
 * A policy's **History** — every saved version: who saved it, when, why, and
 * how many statements and limits it had, as the engine counted them. A draft
 * has none until it is saved.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { EmptyState } from "@invana/ui";
import { formatShortDateTime } from "@invana-studio/core";
import { usePolicyVersionsQuery } from "../queries";
import type { PolicyVersionRead } from "../types";
import { ReadState } from "./policyParts";

const COLUMNS: ColumnDef<PolicyVersionRead>[] = [
	{
		id: "version",
		header: "Version",
		cell: ({ row }) => (
			<span className="font-mono">v{row.original.version}</span>
		),
	},
	{
		id: "saved_by",
		header: "Saved by",
		cell: ({ row }) => row.original.saved_by ?? "—",
	},
	{
		id: "when",
		header: "When",
		cell: ({ row }) => (
			<span className="text-muted-foreground">
				{formatShortDateTime(new Date(row.original.saved_at))}
			</span>
		),
	},
	{
		id: "why",
		header: "Why",
		cell: ({ row }) => row.original.why ?? "—",
	},
	{
		id: "statements",
		header: "Statements",
		cell: ({ row }) => (
			<span className="font-mono">{row.original.statement_count}</span>
		),
	},
	{
		id: "limits",
		header: "Limits",
		cell: ({ row }) => (
			<span className="font-mono">{row.original.limit_count}</span>
		),
	},
];

export function PolicyHistoryTab({
	username,
	graphSlug,
	name,
}: {
	username: string;
	graphSlug: string;
	name: string;
}) {
	const query = usePolicyVersionsQuery(username, graphSlug, name);
	const versions = query.data;
	if (!versions)
		return (
			<ReadState
				loading={query.isLoading}
				error={query.error}
				what="this policy's versions"
				onRetry={() => void query.refetch()}
			/>
		);
	if (versions.length === 0)
		return (
			<EmptyState
				title="Not saved yet"
				description="A draft has no versions — saving it writes v1."
			/>
		);
	return (
		<DataTable
			columns={COLUMNS}
			data={versions}
			enableSorting={false}
			getRowId={(row) => String(row.version)}
		/>
	);
}
