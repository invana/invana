/**
 * IAM › **Groups** (board `iam.groups`) — the Graph's groups, who is in each
 * (people and agents) and the policies attached to it.
 *
 * *As an owner, I want a policy attached once, to a team, so that every
 * member holds it without my granting each.*
 *
 * The list is on the list contract (`?q=`; the engine filters and counts). A
 * row opens the group's page as a tab of its own. *New group* is a modal and
 * the `iam` area's: without iam-admin it shows disabled, naming who holds it.
 * A group with no members reads `—`.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { EmptyState, SearchInput } from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { SectionBody } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIamOpen } from "../open";
import {
	CountChip,
	joined,
	ListStrip,
	NameDialog,
	PAGE,
	ReadState,
} from "../people/listParts";
import { useGroupMutations, useGroupsQuery } from "../queries";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import type { GroupRow } from "../types";

/** `sam · lee · 2 more` — two names, then the engine's count of the rest. */
function members(names: string[], count: number): string {
	if (!count) return "—";
	const shown = names.slice(0, 2);
	const rest = count - shown.length;
	return rest > 0 ? `${shown.join(" · ")} · ${rest} more` : shown.join(" · ");
}

export function GroupsPage({ username, graphSlug }: SectionPageProps) {
	const open = useIamOpen();
	const list = useListParams();
	const [search] = useSearchParams();
	const query = useGroupsQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const { create } = useGroupMutations({ username, graphSlug });
	const [making, setMaking] = useState(false);
	const columns = useMemo(groupColumns, []);
	const page = query.data;
	const filtered = (page?.applied ?? list.pending).length > 0;

	return (
		<SectionPage
			section="groups"
			chips={<CountChip page={page} noun="groups" />}
			actions={
				<ActButton
					area="iam"
					size="sm"
					onClick={() => {
						create.reset();
						setMaking(true);
					}}
				>
					<Plus className="size-3.5" />
					New group
				</ActButton>
			}
		>
			<SectionBody>
				<div className="flex flex-wrap items-center gap-2">
					<SearchInput
						inputSize="sm"
						className="w-64"
						placeholder="Find a group"
						value={search.get("q") ?? ""}
						onChange={list.setQ}
					/>
				</div>
				<ListStrip page={page} list={list} />
				{!page ? (
					<ReadState
						loading={query.isLoading}
						error={query.error}
						what="the groups of this Graph"
						onRetry={() => void query.refetch()}
					/>
				) : (
					<DataTable
						columns={columns}
						data={page.items}
						loading={query.isFetching}
						enableSorting={false}
						getRowId={(row) => row.id}
						onRowClick={(row) => open.group(row.name)}
						emptyState={
							<EmptyState
								title={filtered ? "No group matches" : "No groups yet"}
								description={
									filtered
										? "Remove a filter above, or clear them all."
										: "A group holds people and agents; a policy attached to it reaches every member."
								}
							/>
						}
					/>
				)}
			</SectionBody>
			<NameDialog
				open={making}
				title="New group"
				description="A team of people and agents. Every member holds the policies attached to the group."
				nameLabel="Name"
				submitLabel="Create group"
				pending={create.isPending}
				error={create.error}
				onOpenChange={setMaking}
				onSubmit={(name, description) =>
					create.mutate(
						{ name, description: description || undefined },
						{
							onSuccess: (group) => {
								setMaking(false);
								open.group(group.name);
							},
						},
					)
				}
			/>
		</SectionPage>
	);
}

function groupColumns(): ColumnDef<GroupRow>[] {
	return [
		{
			id: "group",
			header: "Group",
			cell: ({ row }) => (
				<span className="font-medium">{row.original.name}</span>
			),
		},
		{
			id: "people",
			header: "People",
			cell: ({ row }) =>
				members(row.original.people, row.original.people_count),
		},
		{
			id: "agents",
			header: "Agents",
			cell: ({ row }) =>
				members(row.original.agents, row.original.agents_count),
		},
		{
			id: "policies",
			header: "Policies",
			cell: ({ row }) => joined(row.original.policies),
		},
	];
}
