/**
 * A1 · the agents — every agent in the Graph, what bounds it, and what it is
 * doing right now.
 *
 * *As a graph owner, I want to see every agent in this graph, who or what
 * created it, and what it is bound by, so that spawned agents are never
 * invisible and a refusal is predictable before it happens.*
 *
 * **An agent binds no provider** ([PM1](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)).
 * It carries standing limits — an envelope, a budget — and optionally a
 * guardrail of its own; the world, whose `cast` names the model, comes with
 * the work (AG24). So the row draws its guardrail, not a model id: a list that
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
 * is it healthy (AG36); **Open** opens the agent's page in `mainSection`
 * (`agent:<id>`, AG34), and the list stays here beside it. A row carries no
 * actions: pausing and retiring are the page's (AG37).
 */

import {
	useAgentMetersQuery,
	useAgentSkillsAndCallablesQuery,
	useAgentsQuery,
} from "@/hooks/queries/useWork";
import {
	AgentChipRow,
	DetailBlock,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { RecordRow } from "@/pages/graphs-detail/shared/RecordRow";
import {
	type StackSectionUi,
	stackSection,
} from "@/pages/graphs-detail/shared/StackSection";
import { agentTone } from "@/pages/graphs-detail/shared/statusTone";
import type { Agent, AgentEdge } from "@/types/work";
import { FilterSelect } from "@/ui/FilterSelect";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import {
	Button,
	CardFooter,
	FilterBar,
	FilterChip,
	type PanelStackSection,
	Progress,
	PropertyList,
	PropertyRow,
	Spinner,
	StatusDot,
} from "@invana/ui";
import { Bot, ChevronRight, Plus, Shield } from "lucide-react";
import { useMemo } from "react";

const KIND_OPTIONS = ["seeded", "authored", "spawned"].map((value) => ({
	value,
	label: value,
}));
const STATUS_OPTIONS = ["active", "paused", "retired"].map((value) => ({
	value,
	label: value,
}));

/** What narrows the list — behind the section's funnel (AG36). */
export interface AgentFilters {
	kind: string;
	status: string;
	showEphemeral: boolean;
}

export const NO_AGENT_FILTERS: AgentFilters = {
	kind: "",
	status: "",
	showEphemeral: false,
};

export interface AgentsSectionProps {
	filters: AgentFilters;
	onFilters: (next: AgentFilters) => void;
	/** The rows the list shows, beside the section's title. */
	count?: number;
	ui: StackSectionUi;
	username: string;
	graphSlug: string;
	/** Opens the agent's page in `mainSection` — the one surface that edits. */
	onOpenAgentPage: (id: string) => void;
	/** The agent the canvas is drawing, and the one the summary states. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	/** An edge selected on the lineage canvas — an *event*, not an agent (D7). */
	selectedEdge?: AgentEdge | null;
	onOpenLineage?: (agentId: string) => void;
	onOpenTask?: (taskId: string) => void;
	onNewAgent?: () => void;
	defaultSize?: number | string;
}

export function agentsSection(props: AgentsSectionProps): PanelStackSection {
	const { ui, onNewAgent, defaultSize, filters, onFilters, count } = props;
	const patch = (next: Partial<AgentFilters>) =>
		onFilters({ ...filters, ...next });

	return stackSection(
		{
			id: "agents",
			label: "Agents",
			icon: Bot,
			count,
			searchable: true,
			searchPlaceholder: "Search agents",
			filtered:
				Boolean(filters.kind || filters.status) || filters.showEphemeral,
			filterBar: (
				<FilterBar>
					<FilterSelect
						label="kind"
						value={filters.kind}
						options={KIND_OPTIONS}
						onChange={(kind) => patch({ kind })}
					/>
					<FilterSelect
						label="status"
						value={filters.status}
						options={STATUS_OPTIONS}
						onChange={(status) => patch({ status })}
					/>
					{/* A chip that toggles rather than selects. `active` is the kit's
					    pressed look; `aria-pressed` is what says so out loud. */}
					<FilterChip
						label="show ephemeral"
						active={filters.showEphemeral}
						aria-pressed={filters.showEphemeral}
						onClick={() => patch({ showEphemeral: !filters.showEphemeral })}
					/>
				</FilterBar>
			),
			headerActions: onNewAgent
				? [{ key: "new", name: "New agent", icon: Plus, onClick: onNewAgent }]
				: undefined,
			defaultSize,
			children: ({ search }) => <AgentsBody {...props} search={search} />,
		},
		ui,
	);
}

function AgentsBody({
	username,
	graphSlug,
	onOpenAgentPage,
	selectedAgentId,
	onSelectAgent,
	selectedEdge,
	onOpenLineage,
	filters,
	search,
}: AgentsSectionProps & { search: string }) {
	// Always fetch the full list (ephemeral included): the *count* of what is
	// hidden belongs in the status bar, so the filter has to happen here rather
	// than at the endpoint.
	const query = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});

	const all = query.data?.items ?? [];
	const defaultId = query.data?.default_agent_id ?? null;
	// One grouped read for the whole list, on the list response (C10).
	const spend = query.data?.spend_this_month ?? {};
	const selected = all.find((a) => a.id === selectedAgentId) ?? null;

	const byId = useMemo(() => new Map(all.map((a) => [a.id, a])), [all]);
	const ordered = useMemo(() => visibleAgents(all, filters), [all, filters]);
	const ephemeralHidden = filters.showEphemeral
		? 0
		: all.filter((a) => a.lifetime === "ephemeral").length;

	const rows = ordered.filter(({ agent }) =>
		agent.name.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto">
				{query.isLoading ? (
					<div className="px-3 py-4">
						<Spinner />
					</div>
				) : rows.length === 0 ? (
					<p className="px-3 py-4 text-base text-muted-foreground">
						{all.length
							? "No agent matches those filters."
							: "No agents yet. Every graph is seeded with Explorer, Query and Modeller — try refreshing."}
					</p>
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
										{spendLine(agent, spend)?.text ??
											"nothing priced this month"}
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
					spend={spendLine(selected, spend)}
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
 * `└` gutter exists to prevent. Shared with the header's count, so the number
 * beside the title is the rows below it.
 */
export function visibleAgents(
	all: Agent[],
	filters: AgentFilters,
): { agent: Agent; depth: number }[] {
	const visible = all.filter(
		(a) =>
			(filters.showEphemeral || a.lifetime !== "ephemeral") &&
			(!filters.kind || a.kind === filters.kind) &&
			(!filters.status || a.status === filters.status),
	);
	const ids = new Set(visible.map((a) => a.id));
	const roots = visible.filter(
		(a) => !a.parent_agent_id || !ids.has(a.parent_agent_id),
	);
	const out: { agent: Agent; depth: number }[] = [];
	const walk = (agent: Agent, depth: number) => {
		out.push({ agent, depth });
		for (const child of visible.filter((c) => c.parent_agent_id === agent.id))
			walk(child, depth + 1);
	};
	for (const root of roots) walk(root, 0);
	return out;
}

/** `own guardrail` · `Graph guardrails only` — what holds it besides the Graph (AG10). */
function guardrailLine(agent: Agent, byId: Map<string, Agent>): string {
	const own = agent.guardrail_name ?? "Graph guardrails only";
	if (agent.kind !== "spawned") return own;
	const parent = agent.parent_agent_id ? byId.get(agent.parent_agent_id) : null;
	return `${own} · spawned by ${parent?.name ?? "an agent"}`;
}

/**
 * `$1.84 of $40.00 this month` — spend against the ceiling it is bounded by
 * ([C10](../../../../../docs/for-developers/modules/agents/features/author-an-agent.md)),
 * *before* the ceiling is reached rather than after.
 *
 * **Absent is not zero.** An agent with no priced run this month is not in the
 * map at all, because a subscription endpoint publishes no per-token rate and
 * *nothing spent* and *nothing known* are different facts (OB4) — so the row
 * says nothing rather than drawing a reassuring `$0.00`.
 */
function spendLine(
	agent: Agent,
	spend: Record<string, number>,
): { text: string; meter: number | undefined } | null {
	const spent = spend[agent.id];
	if (spent == null) return null;
	// Both names for the month ceiling are read, for one release (EB8).
	const ceiling =
		agent.budget?.max_cost_usd_month ?? agent.budget?.max_cost_usd;
	return {
		text: ceiling
			? `$${spent.toFixed(2)} of $${ceiling.toFixed(2)} this month`
			: `$${spent.toFixed(2)} this month`,
		meter: ceiling ? Math.min(1, spent / ceiling) : undefined,
	};
}

/**
 * The selected row's quick look (AG36): which one is this, and is it
 * healthy. Everything else is on the page, one click on by **Open**.
 */
function AgentQuickLook({
	username,
	graphSlug,
	agent,
	isDefault,
	spend,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	isDefault: boolean;
	/** Spend against the month ceiling, or null when nothing is priced. */
	spend: { text: string; meter: number | undefined } | null;
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
					<PropertyRow label="spend">
						{/* A meter only against a real ceiling — without one a bar
						    would invent a limit nobody set. */}
						{spend ? (
							<span className="flex items-center gap-2">
								{spend.meter != null ? (
									<Progress value={spend.meter * 100} className="h-1 w-16" />
								) : null}
								{spend.text}
							</span>
						) : (
							<span className="text-muted-foreground">
								nothing priced this month
							</span>
						)}
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

export { AgentChipRow };
