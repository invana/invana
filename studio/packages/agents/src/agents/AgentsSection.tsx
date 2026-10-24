/**
 * the agents — every agent in the Graph, what bounds it, and what it is
 * doing right now.
 *
 * *As a graph owner, I want to see every agent in this graph, who or what
 * created it, and what it is bound by, so that spawned agents are never
 * invisible and a refusal is predictable before it happens.*
 *
 * **An agent binds no provider** ([providers-and-models.md](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)).
 * It carries standing limits — an envelope, a budget — and optionally a
 * guardrail of its own; the world, whose `cast` names the model, comes with
 * the work. So the row draws its guardrail, not a model id: a list that
 * printed a model would be printing the one thing an agent no longer decides.
 *
 * Three things this section is careful about:
 *
 * - **Ephemeral agents are hidden, not absent.** A spawned helper exists for
 *   one task and would otherwise grow the list without bound — but it is
 *   fully present in lineage and in the trace, so the toggle reveals rather
 *   than resurrects. Hidden ones are *counted* in the status bar.
 * - **A spawned agent nests under its parent.** The `└` gutter is the whole
 *   answer to "where did this come from?" without opening the lineage.
 * - **Retire names the open tasks before it happens.** A count is not enough to
 *   decide with, so the confirm lists them.
 *
 * Selecting a row gives a quick look under the list — which one is this, and
 * is it healthy; **Open** opens the agent's page in `mainSection`
 * (`agent:<id>`), and the list stays here beside it. A row carries no
 * actions: pausing and retiring are the page's.
 */

import {
	Button,
	CardFooter,
	FilterBar,
	FilterChip,
	type PanelStackSection,
	PropertyList,
	PropertyRow,
	Spinner,
	StatusDot,
} from "@invana/ui";
import type { ListUrl } from "@invana-studio/core";
import {
	agentTone,
	DetailBlock,
	DetailProse,
	DetailStatus,
	FilterSelect,
	PanelStatusBar,
	RecordRow,
	type StackSectionUi,
	StatusCount,
	StatusCrumb,
	stackSection,
} from "@invana-studio/ui";
import { Bot, ChevronRight, Plus, Shield } from "lucide-react";
import { useMemo } from "react";
import {
	chipsOf,
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	PAGE,
	setOne,
} from "../lists";
import { tokenBudgetLine, tokenMonthLine } from "./CeilingsTable";
import {
	useAgentMetersQuery,
	useAgentSkillsAndCallablesQuery,
	useAgentsQuery,
} from "./queries";
import type { Agent, AgentEdge } from "./types";

const KIND_OPTIONS = ["seeded", "authored", "spawned"].map((value) => ({
	value,
	label: value,
}));
const STATUS_OPTIONS = ["active", "paused", "retired"].map((value) => ({
	value,
	label: value,
}));

/** The page of agents the URL asks for — the header's count and the rows read one query. */
function useAgentList(username: string, graphSlug: string, list: ListUrl) {
	return useAgentsQuery(username, graphSlug, { ...list.query, limit: PAGE });
}

export interface AgentsSectionProps {
	/** The URL's search and filters — the funnel writes them, the rows are the engine's answer. */
	list: ListUrl;
	ui: StackSectionUi;
	username: string;
	graphSlug: string;
	/** Opens the agent's page in `mainSection` — the one surface that edits. */
	onOpenAgentPage: (id: string) => void;
	/** The agent the canvas is drawing, and the one the summary states. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	/** An edge selected on the lineage canvas — an *event*, not an agent. */
	selectedEdge?: AgentEdge | null;
	onOpenLineage?: (agentId: string) => void;
	onOpenTask?: (taskId: string) => void;
	onNewAgent?: () => void;
	defaultSize?: number | string;
}

export function agentsSection(props: AgentsSectionProps): PanelStackSection {
	const { ui, onNewAgent, defaultSize, list } = props;
	const showEphemeral = filterValue(list, "ephemeral") === "shown";

	return stackSection(
		{
			id: "agents",
			label: "Agents",
			icon: Bot,
			count: <AgentsCount {...props} />,
			searchable: true,
			searchPlaceholder: "Search agents",
			filtered: Object.keys(list.query.filters ?? {}).length > 0,
			filterBar: (
				<FilterBar>
					<FilterSelect
						label="kind"
						value={filterValue(list, "kind")}
						options={KIND_OPTIONS}
						onChange={(v) => setOne(list, "kind", v)}
					/>
					<FilterSelect
						label="status"
						value={filterValue(list, "status")}
						options={STATUS_OPTIONS}
						onChange={(v) => setOne(list, "status", v)}
					/>
					{/* A chip that toggles rather than selects. `active` is the kit's
					    pressed look; `aria-pressed` is what says so out loud. */}
					<FilterChip
						label="show ephemeral"
						active={showEphemeral}
						aria-pressed={showEphemeral}
						onClick={() =>
							setOne(list, "ephemeral", showEphemeral ? "" : "shown")
						}
					/>
				</FilterBar>
			),
			headerActions: onNewAgent
				? [{ key: "new", name: "New agent", icon: Plus, onClick: onNewAgent }]
				: undefined,
			defaultSize,
			children: () => <AgentsBody {...props} />,
		},
		ui,
	);
}

/** `7`, or `2 of 7 match` while a search or a filter is applied — the engine's two counts. */
function AgentsCount({ username, graphSlug, list }: AgentsSectionProps) {
	return <>{matchCount(useAgentList(username, graphSlug, list).data)}</>;
}

function AgentsBody({
	username,
	graphSlug,
	onOpenAgentPage,
	selectedAgentId,
	onSelectAgent,
	selectedEdge,
	onOpenLineage,
	list,
}: AgentsSectionProps) {
	const query = useAgentList(username, graphSlug, list);

	const all = query.data?.items ?? [];
	const defaultId = query.data?.default_agent_id ?? null;
	const selected = all.find((a) => a.id === selectedAgentId) ?? null;
	const chips = chipsOf(query.data, list);

	const byId = useMemo(() => new Map(all.map((a) => [a.id, a])), [all]);
	const rows = useMemo(() => byFamily(all), [all]);
	// Spawned helpers are left out unless asked for; the Graph's count of them
	// says how many.
	const ephemeralHidden =
		filterValue(list, "ephemeral") === "shown"
			? 0
			: (query.data?.ephemeral ?? 0);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ListStrip page={query.data} list={list} />
			<div className="min-h-0 flex-1 overflow-y-auto">
				{query.isLoading ? (
					<div className="px-3 py-4">
						<Spinner />
					</div>
				) : rows.length === 0 ? (
					chips.length ? (
						<FilteredEmpty noun="agent" filters={chips} onClear={list.clear} />
					) : (
						<p className="px-3 py-4 text-base text-muted-foreground">
							No agents yet. Every graph is seeded with Explorer, Query and
							Modeller — try refreshing.
						</p>
					)
				) : (
					rows.map(({ agent, depth }) => (
						<RecordRow
							key={agent.id}
							className="border-b border-border/60"
							active={agent.id === selectedAgentId}
							onClick={() =>
								onSelectAgent(agent.id === selectedAgentId ? null : agent.id)
							}
							tone={agentTone(agent.status)}
							indent={depth}
							title={agent.name}
							status={agent.kind}
							subtitle={
								<span className="flex min-w-0 flex-col">
									<span className="flex min-w-0 items-center gap-1">
										<Shield className="size-3 shrink-0" />
										<span className="truncate">
											{guardrailLine(agent, byId)}
										</span>
									</span>
									<span className="truncate">
										{rowTokenLine(
											agent,
											query.data?.tokens_this_month[agent.id] ?? 0,
										)}
									</span>
								</span>
							}
						/>
					))
				)}
			</div>

			{selectedEdge ? (
				<EdgeDetail edge={selectedEdge} byId={byId} />
			) : selected ? (
				<AgentQuickLook
					username={username}
					graphSlug={graphSlug}
					agent={selected}
					isDefault={selected.id === defaultId}
				/>
			) : null}

			{selected ? (
				<CardFooter className="shrink-0 gap-2 border-t">
					<Button
						size="sm"
						variant="outline"
						onClick={() => onOpenAgentPage(selected.id)}
					>
						<ChevronRight /> Open
					</Button>
				</CardFooter>
			) : null}

			<PanelStatusBar
				left={
					<>
						<StatusCrumb active>Agents</StatusCrumb>
						<StatusCrumb
							onClick={
								selected && onOpenLineage
									? () => onOpenLineage(selected.id)
									: undefined
							}
						>
							{selected ? selected.name : "Lineage"}
						</StatusCrumb>
					</>
				}
				middle={
					ephemeralHidden
						? [
								<StatusCount key="eph" tone="warning">
									{ephemeralHidden} ephemeral hidden
								</StatusCount>,
							]
						: []
				}
			/>
		</div>
	);
}

/**
 * Parents first, each followed by the helpers it spawned. Sorting the flat
 * list would scatter a family across the list, which is exactly the thing the
 * `└` gutter exists to prevent.
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

/** `own guardrail` · `Graph guardrails only` — what holds it besides the Graph. */
function guardrailLine(agent: Agent, byId: Map<string, Agent>): string {
	const own = agent.guardrail_name ?? "Graph guardrails only";
	if (agent.kind !== "spawned") return own;
	const parent = agent.parent_agent_id ? byId.get(agent.parent_agent_id) : null;
	return `${own} · spawned by ${parent?.name ?? "an agent"}`;
}

/** A row carries only what the agent set; a blank run budget is the Graph's. */
const GRAPH_RUN_BUDGET = "the Graph's run budget";

/** The run budget the agent set, under either of its names. */
function ownRunBudget(agent: Agent): number | undefined {
	return agent.budget?.max_tokens_run ?? agent.budget?.max_tokens;
}

/** `up to 8k tokens a run · 1.2m of 5m tokens this month` — the month only once it ran. */
function rowTokenLine(agent: Agent, used: number): string {
	const run = tokenBudgetLine(ownRunBudget(agent), GRAPH_RUN_BUDGET);
	return used
		? `${run} · ${tokenMonthLine(used, agent.budget?.max_tokens_month)}`
		: run;
}

/**
 * The selected row's quick look: which one is this, and is it
 * healthy. Everything else is on the page, one click on by **Open**.
 */
function AgentQuickLook({
	username,
	graphSlug,
	agent,
	isDefault,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	isDefault: boolean;
}) {
	const meters = useAgentMetersQuery(username, graphSlug, agent.id);
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const m = meters.data;
	const skills = can.data?.skills ?? [];
	const lacking = skills.filter((s) => s.missing.length).length;
	return (
		<div className="shrink-0 border-t">
			<div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
				<StatusDot tone={agentTone(agent.status)} />
				<span className="min-w-0 flex-1 truncate font-semibold">
					{agent.name}
				</span>
				<DetailStatus>{agent.kind}</DetailStatus>
				{isDefault ? <DetailStatus>Graph default</DetailStatus> : null}
			</div>
			<div className="px-3 py-2">
				{agent.description ? (
					<p className="truncate pb-1 text-muted-foreground">
						{agent.description}
					</p>
				) : null}
				<PropertyList labelWidth={84}>
					<PropertyRow label="guardrail">
						<span className="flex items-center gap-1">
							<Shield className="size-3 shrink-0 text-muted-foreground" />
							{agent.guardrail_name ?? "Graph guardrails only"}
						</span>
					</PropertyRow>
					<PropertyRow label="tokens">
						{m
							? tokenBudgetLine(m.max_tokens_run)
							: tokenBudgetLine(ownRunBudget(agent), GRAPH_RUN_BUDGET)}
					</PropertyRow>
					<PropertyRow label="this month">
						{m ? tokenMonthLine(m.tokens_this_month, m.max_tokens_month) : "…"}
					</PropertyRow>
					<PropertyRow label="at once">
						{m ? `${m.running} of ${m.max_concurrent_runs ?? "∞"} runs` : "…"}
					</PropertyRow>
					<PropertyRow label="skills">
						{can.data ? (
							<>
								{skills.length} bound
								{lacking ? (
									<span className="text-warning">
										{" "}
										· {lacking} need{lacking === 1 ? "s" : ""} attention
									</span>
								) : null}
							</>
						) : (
							"…"
						)}
					</PropertyRow>
				</PropertyList>
			</div>
		</div>
	);
}

/**
 * An edge on a lineage canvas **is an event**, and selecting it is the point of
 * the trace (lineage.md): actor, on behalf of whom, caused by what. Nothing
 * else in Studio shows a single causal hop this directly — the Activity tree
 * shows the shape, this shows the one link.
 */
function EdgeDetail({
	edge,
	byId,
}: {
	edge: AgentEdge;
	byId: Map<string, Agent>;
}) {
	const verbs: Record<string, string> = {
		spawned: "agent.spawn",
		authored: "agent.create",
		assigned: "task.assign",
		delegated_for: "run.delegate",
	};
	const name = (id: string) => byId.get(id)?.name ?? id;
	return (
		<DetailBlock title={verbs[edge.kind] ?? edge.kind} subtitle="one event">
			<PropertyRow label="event" mono>
				{verbs[edge.kind] ?? edge.kind}
				{edge.event_id ? (
					<span className="text-muted-foreground"> · {edge.event_id}</span>
				) : null}
			</PropertyRow>
			<PropertyRow label="actor">{name(edge.source)}</PropertyRow>
			<PropertyRow label="target">{name(edge.target)}</PropertyRow>
			<PropertyRow label="reads as">
				{edge.label}
				<DetailProse>the causal hop, not the whole chain</DetailProse>
			</PropertyRow>
		</DetailBlock>
	);
}
