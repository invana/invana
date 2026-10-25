/**
 * IAM › **Agents** (board `iam.agents`) — every agent's policies, how many
 * functions it may call and what was refused this week. Read-only: agents
 * are built in Agents; this page reads them.
 *
 * *As an owner, I want every agent's policies and effective access, read-only,
 * so that I see why an agent can or can't.*
 *
 * The list is on the list contract: the kind tabs `All · Authored · Seeded`
 * write `?f.kind=`, the search writes `?q=`, and the engine filters and counts.
 * Spawned agents are not listed — they hold their parent's access. *Functions
 * allowed* and *refused · 7 d* are the engine's. A row opens the agent's
 * access page as a tab of its own.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Button, EmptyState, SearchInput } from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { SectionBody } from "@invana-studio/ui";
import { Bot } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useIamOpen } from "../open";
import {
	CountChip,
	joined,
	KindTabs,
	ListStrip,
	PAGE,
	ReadState,
} from "../people/listParts";
import { useIamAgentsQuery } from "../queries";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import type { AgentAccessRow } from "../types";

const KIND_TABS = [
	{ value: "authored", label: "Authored" },
	{ value: "seeded", label: "Seeded" },
];

export function IamAgentsPage({ username, graphSlug }: SectionPageProps) {
	const open = useIamOpen();
	const list = useListParams();
	const [search] = useSearchParams();
	const query = useIamAgentsQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const columns = useMemo(agentColumns, []);
	const page = query.data;
	const filtered = (page?.applied ?? list.pending).length > 0;

	return (
		<SectionPage
			section="agents"
			graph={graphSlug}
			chips={<CountChip page={page} noun="agents" />}
			actions={
				// Agents is where an agent is built, and its list is where *New
				// agent* lives; opening it changes nothing, so it is not gated.
				<Button
					size="sm"
					variant="outline"
					onClick={() => open.agentsInAgents()}
				>
					<Bot className="size-3.5" />
					Build an agent in Agents
				</Button>
			}
		>
			<SectionBody>
				<div className="flex flex-wrap items-center gap-2">
					<KindTabs
						list={list}
						kinds={page?.kinds}
						tabs={KIND_TABS}
						label="Kind"
					/>
					<SearchInput
						inputSize="sm"
						className="w-64"
						placeholder="Find an agent"
						value={search.get("q") ?? ""}
						onChange={list.setQ}
					/>
					<span className="ml-auto text-muted-foreground">
						Spawned agents hold their parent's access, narrowed
					</span>
				</div>
				<ListStrip page={page} list={list} />
				{!page ? (
					<ReadState
						loading={query.isLoading}
						error={query.error}
						what="the agents of this Graph"
						onRetry={() => void query.refetch()}
					/>
				) : (
					<DataTable
						columns={columns}
						data={page.items}
						loading={query.isFetching}
						enableSorting={false}
						getRowId={(row) => row.agent_id}
						onRowClick={(row) => open.agent(row.agent_id)}
						emptyState={
							<EmptyState
								title={filtered ? "No agent matches" : "No agents yet"}
								description={
									filtered
										? "Remove a filter above, or clear them all."
										: "Agents are built in Agents; each holds policies like a person does."
								}
							/>
						}
					/>
				)}
			</SectionBody>
		</SectionPage>
	);
}

function agentColumns(): ColumnDef<AgentAccessRow>[] {
	return [
		{
			id: "agent",
			header: "Agent",
			size: 180,
			cell: ({ row }) => (
				<span className="font-semibold">{row.original.name}</span>
			),
		},
		{
			id: "kind",
			header: "Kind",
			size: 180,
			cell: ({ row }) => `${row.original.kind} · v${row.original.version}`,
		},
		{
			id: "policies",
			header: "Policies",
			size: 560,
			cell: ({ row }) => joined(row.original.policies),
		},
		{
			id: "functions_allowed",
			header: "Functions allowed",
			size: 160,
			cell: ({ row }) => row.original.functions_allowed.toLocaleString(),
		},
		{
			id: "refused",
			header: "Refused · 7 d",
			size: 120,
			cell: ({ row }) => row.original.refused_line,
		},
		{
			id: "owner",
			header: "Owner",
			size: 100,
			cell: ({ row }) => row.original.owner ?? "—",
		},
	];
}
