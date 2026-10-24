/**
 * **Agents** — every authored and seeded agent in the Graph as one table, at
 * `/agents/agents` (the-agents-shell.md › Agents).
 *
 * *As a builder, I want every agent in this Graph on one page — what it is
 * offered, what it is doing and how it ran this week — so that I can find the
 * one to look at without opening each.*
 *
 * The list is on the list contract (list-contract.md): `All · Live · Drafts`, the
 * search box, the kind and status selects and the spawned-helpers toggle all
 * write the URL (`?q=` · `?f.status=` · `?f.kind=` · `?f.ephemeral=shown`),
 * the engine filters, and the applied-filters strip names what is applied
 * with *N of M match* and *Clear all*. The browser never narrows a row.
 *
 * - **Spawned helpers are hidden, not absent.** One exists for one task and
 *   would grow the list without bound; the engine counts them, the toolbar
 *   says how many, and the toggle reveals them nested under their parent.
 * - **Every number is the engine's.** Runs and served are Performance's
 *   7-day agent rows, joined by id; the month budget is the list's
 *   `tokens_this_month` against the agent's own `max_tokens_month`.
 *
 * A row opens the agent's page as a workbook tab beside this one. A row
 * carries no acts: pausing, retiring and editing are the page's. *New agent*
 * makes a draft and opens it on the builder.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Badge,
	EmptyState,
	FilterBar,
	FilterChip,
	Progress,
	SearchInput,
	SegmentedControl,
	Spinner,
	StatusDot,
} from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { agentTone, FilterSelect } from "@invana-studio/ui";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFleetPerformanceQuery } from "../fleet/queries";
import type { PerformanceRow } from "../fleet/types";
import {
	chipsOf,
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	PAGE,
	setOne,
} from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState, pct, tokens } from "../overview/fleetParts";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { useSkillsQuery } from "../skills/queries";
import { NewAgentButton } from "./NewAgentButton";
import { useAgentsQuery } from "./queries";
import type { Agent } from "./types";

const KIND_OPTIONS = ["seeded", "authored", "spawned"].map((value) => ({
	value,
	label: value,
}));
const STATUS_OPTIONS = ["draft", "active", "paused", "retired"].map(
	(value) => ({
		value,
		label: value,
	}),
);

/**
 * `All` asks for no status (the engine leaves retired out); `Live` is
 * `active`; `Drafts` is `draft` — agents not yet created.
 */
const SHOWING = [
	{ value: "all", label: "All" },
	{ value: "live", label: "Live" },
	{ value: "drafts", label: "Drafts" },
];
const SHOWING_STATUS: Record<string, string> = {
	live: "active",
	drafts: "draft",
};

interface Row {
	agent: Agent;
	/** How deep under the agent that spawned it. */
	depth: number;
	skills: string[];
	perf: PerformanceRow | undefined;
	tokensThisMonth: number;
}

export function AgentsListPage({ username, graphSlug }: SectionPageProps) {
	const open = useAgentsOpen();
	const list = useListParams();
	const [search] = useSearchParams();
	const query = useAgentsQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const skills = useSkillsQuery(username, graphSlug, { limit: PAGE });
	const perf = useFleetPerformanceQuery(username, graphSlug, "7d");
	const columns = useMemo(agentColumns, []);

	const page = query.data;
	const chips = chipsOf(page, list);
	const status = filterValue(list, "status");
	const showEphemeral = filterValue(list, "ephemeral") === "shown";

	const rows = useMemo<Row[]>(() => {
		const names = new Map(
			(skills.data?.items ?? []).map((s) => [s.id, s.name]),
		);
		const perfById = new Map((perf.data?.agents ?? []).map((r) => [r.id, r]));
		return byFamily(page?.items ?? []).map(({ agent, depth }) => ({
			agent,
			depth,
			skills: agent.skill_ids.flatMap((id) => names.get(id) ?? []),
			perf: perfById.get(agent.id),
			tokensThisMonth: page?.tokens_this_month[agent.id] ?? 0,
		}));
	}, [page, skills.data, perf.data]);

	return (
		<SectionPage
			section="agents"
			actions={<NewAgentButton username={username} graphSlug={graphSlug} />}
			chips={
				page ? (
					<Badge variant="outline" tone="muted" size="xs">
						{matchCount(page, "agents")}
					</Badge>
				) : null
			}
		>
			<SectionBody>
				<div className="flex flex-wrap items-center gap-2">
					<SegmentedControl
						size="sm"
						aria-label="Showing"
						value={
							status === "active"
								? "live"
								: status === "draft"
									? "drafts"
									: status
										? ""
										: "all"
						}
						onValueChange={(v) =>
							setOne(list, "status", SHOWING_STATUS[v] ?? "")
						}
						options={SHOWING}
					/>
					<SearchInput
						inputSize="sm"
						className="w-64"
						placeholder="Find an agent"
						value={search.get("q") ?? ""}
						onChange={list.setQ}
					/>
					<FilterBar>
						<FilterSelect
							label="kind"
							value={filterValue(list, "kind")}
							options={KIND_OPTIONS}
							onChange={(v) => setOne(list, "kind", v)}
						/>
						<FilterSelect
							label="status"
							value={status}
							options={STATUS_OPTIONS}
							onChange={(v) => setOne(list, "status", v)}
						/>
						{/* A chip that toggles rather than selects; `aria-pressed` says so. */}
						<FilterChip
							label="show spawned helpers"
							active={showEphemeral}
							aria-pressed={showEphemeral}
							onClick={() =>
								setOne(list, "ephemeral", showEphemeral ? "" : "shown")
							}
						/>
					</FilterBar>
					{page && page.ephemeral > 0 ? (
						<span className="ml-auto text-muted-foreground">
							{page.ephemeral} spawned helper{page.ephemeral === 1 ? "" : "s"} ·
							see them in their runs
						</span>
					) : null}
				</div>
				<ListStrip page={page} list={list} />
				{query.isLoading ? (
					<Spinner />
				) : query.error ? (
					<FleetReadState
						loading={false}
						error={query.error}
						what="the agents"
					/>
				) : rows.length === 0 ? (
					chips.length ? (
						<FilteredEmpty noun="agent" filters={chips} onClear={list.clear} />
					) : (
						<EmptyState
							title="No agents yet"
							description="Every Graph is seeded with its own agents — try refreshing."
						/>
					)
				) : (
					<DataTable
						columns={columns}
						data={rows}
						enableSorting={false}
						getRowId={(row) => row.agent.id}
						rowIndent={(row) => row.depth}
						onRowClick={(row) => open.agent(row.agent.id)}
					/>
				)}
			</SectionBody>
		</SectionPage>
	);
}

function agentColumns(): ColumnDef<Row>[] {
	return [
		{
			id: "agent",
			header: "Agent",
			cell: ({ row }) => (
				<span className="font-medium">{row.original.agent.name}</span>
			),
		},
		{
			id: "version",
			header: "Version",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{row.original.agent.kind} · v{row.original.agent.version}
				</span>
			),
		},
		{
			id: "skills",
			header: "Skills",
			cell: ({ row }) =>
				row.original.skills.length ? (
					row.original.skills.join(" · ")
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			id: "now",
			header: "Now",
			cell: ({ row }) => (
				<span className="inline-flex items-center gap-1.5">
					<StatusDot tone={agentTone(row.original.agent.status)} />
					{row.original.agent.status}
				</span>
			),
		},
		{
			id: "runs",
			header: "Runs · 7 days",
			cell: ({ row }) => (
				<span className="font-mono">{row.original.perf?.runs ?? "—"}</span>
			),
		},
		{
			id: "served",
			header: "Served",
			cell: ({ row }) => (
				<span className="font-mono">{pct(row.original.perf?.success)}</span>
			),
		},
		{
			id: "budget",
			header: "Month budget",
			cell: ({ row }) => <BudgetCell row={row.original} />,
		},
	];
}

/** The month's tokens against the agent's own month budget, when it set one. */
function BudgetCell({ row }: { row: Row }) {
	const max = row.agent.budget?.max_tokens_month;
	if (!max)
		return (
			<span className="font-mono text-muted-foreground">
				{tokens(row.tokensThisMonth)}
			</span>
		);
	return (
		<span className="inline-flex items-center gap-2">
			<Progress
				size="sm"
				className="w-20"
				value={Math.min(100, (row.tokensThisMonth / max) * 100)}
				aria-label={`${row.agent.name} month budget`}
			/>
			<span className="font-mono text-muted-foreground">
				{tokens(row.tokensThisMonth)} of {tokens(max)}
			</span>
		</span>
	);
}

/**
 * Parents first, each followed by the helpers it spawned. Sorting the flat
 * list would scatter a family across it, which the indent exists to prevent.
 */
function byFamily(rows: Agent[]): { agent: Agent; depth: number }[] {
	const ids = new Set(rows.map((a) => a.id));
	const roots = rows.filter(
		(a) => !a.parent_agent_id || !ids.has(a.parent_agent_id),
	);
	const out: { agent: Agent; depth: number }[] = [];
	const walk = (agent: Agent, depth: number) => {
		out.push({ agent, depth });
		for (const child of rows.filter((c) => c.parent_agent_id === agent.id))
			walk(child, depth + 1);
	};
	for (const root of roots) walk(root, 0);
	return out;
}
