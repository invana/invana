/**
 * A1 · the agents — every agent in the Graph, what bounds it, and what it is
 * doing right now.
 *
 * *As a graph owner, I want to see every agent in this graph, who or what
 * created it, and what it is bound by, so that spawned agents are never
 * invisible and a refusal is predictable before it happens.*
 *
 * **An agent binds no provider** ([PM1](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)).
 * It carries three bounds — an envelope, a budget and a **lens** — and the
 * lens's `cast` names the model. So the row draws the world it works in, not a
 * model id: `llm_config_id` is gone, and a list that still printed a model
 * would be printing the one thing an agent no longer decides.
 *
 * Three things this drawer is careful about:
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
 * Selecting a row states the agent beside the list; **Open** drills in to
 * {@link AgentDetail} through `&agent=`, which is the gesture that survives a
 * reload.
 */

import {
	useAgentLineageQuery,
	useAgentMutations,
	useAgentsQuery,
	useLifecyclePreviewQuery,
	useTasksQuery,
} from "@/hooks/queries/useWork";
import { AgentDetail } from "@/pages/graphs-detail/features/agents/AgentDetail";
import { LifecycleDialog } from "@/pages/graphs-detail/features/agents/LifecycleDialog";
import {
	AgentChipRow,
	DetailBlock,
	DetailPlaceholder,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import {
	agentTone,
	humanStatus,
} from "@/pages/graphs-detail/shared/statusTone";
import type { Agent, AgentEdge, AgentUpdate, LifecycleAct } from "@/types/work";
import { FilterSelect } from "@/ui/FilterSelect";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import {
	Button,
	CardFooter,
	FilterBar,
	FilterChip,
	LensChip,
	MetricTile,
	type PanelStackSection,
	PropertyRow,
	Spinner,
} from "@invana/ui";
import {
	Bot,
	GitBranch,
	Pause,
	Play,
	Plus,
	SquareArrowOutUpRight,
	Star,
} from "lucide-react";
import { useMemo, useState } from "react";

const KIND_OPTIONS = ["seeded", "authored", "spawned"].map((value) => ({
	value,
	label: value,
}));
const STATUS_OPTIONS = ["active", "paused", "retired"].map((value) => ({
	value,
	label: value,
}));

export interface AgentsDrawerProps {
	ui: TaskDrawerUi;
	username: string;
	graphSlug: string;
	/** The drilled-in agent — `&agent=`, the one surface that edits. */
	agentId: string | null;
	onOpenAgent: (id: string | null) => void;
	/** The agent the canvas is drawing, and the one the summary states. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	/** An edge selected on the lineage canvas — an *event*, not an agent (D7). */
	selectedEdge?: AgentEdge | null;
	onOpenLineage?: (agentId: string) => void;
	onOpenEnvelope?: (agentId: string) => void;
	onOpenTask?: (taskId: string) => void;
	onNewAgent?: () => void;
	defaultSize?: number | string;
}

export function agentsDrawerSection(
	props: AgentsDrawerProps,
): PanelStackSection {
	const { ui, agentId, onOpenAgent, onNewAgent, defaultSize } = props;

	return taskDrawerSection(
		{
			id: "agents",
			label: "Agents",
			icon: Bot,
			trail: agentId ? <AgentsTrail {...props} /> : undefined,
			onBack: () => onOpenAgent(null),
			searchable: true,
			searchPlaceholder: "Search agents",
			headerActions: onNewAgent
				? [{ key: "new", name: "New agent", icon: Plus, onClick: onNewAgent }]
				: undefined,
			defaultSize,
			children: ({ search }) => <AgentsBody {...props} search={search} />,
		},
		ui,
	);
}

/** The drilled-in agent's name, resolved off the same list the drawer reads. */
function AgentsTrail({ username, graphSlug, agentId }: AgentsDrawerProps) {
	const query = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const agent = (query.data?.items ?? []).find((a) => a.id === agentId);
	return <>{agent?.name ?? "Agent"}</>;
}

function AgentsBody({
	username,
	graphSlug,
	agentId,
	onOpenAgent,
	selectedAgentId,
	onSelectAgent,
	selectedEdge,
	onOpenLineage,
	onOpenEnvelope,
	onOpenTask,
	onNewAgent,
	search,
}: AgentsDrawerProps & { search: string }) {
	const [showEphemeral, setShowEphemeral] = useState(false);
	const [kindFilter, setKindFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	// One dialog for both acts: pausing blocks the same todos retiring blocks,
	// so it earns the same confirm (LC10). Resume is not here — it takes
	// nothing away.
	const [confirming, setConfirming] = useState<{
		agent: Agent;
		act: LifecycleAct;
	} | null>(null);

	// Always fetch the full list (ephemeral included): the *count* of what is
	// hidden belongs in the status bar, so the filter has to happen here rather
	// than at the endpoint.
	const query = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const mutations = useAgentMutations(username, graphSlug);
	const preview = useLifecyclePreviewQuery(
		username,
		graphSlug,
		confirming?.agent.id,
		confirming?.act,
	);
	const lineage = useAgentLineageQuery(
		username,
		graphSlug,
		selectedAgentId ?? undefined,
	);
	const tasks = useTasksQuery(username, graphSlug, {
		assignee: selectedAgentId ?? undefined,
		enabled: selectedAgentId !== null,
	});
	// The subline names the provenance and the live work — both are questions
	// the list is opened to ask ("where did this come from?", "is anything
	// waiting on me?"). One unfiltered task list answers the counts for every
	// row; the bound rides on the row's own record now (AG8), so nothing here
	// resolves a second list to draw it.
	const allTasks = useTasksQuery(username, graphSlug);
	const liveOf = useMemo(() => {
		const counts = new Map<string, { running: number; waiting: number }>();
		for (const task of allTasks.data?.items ?? []) {
			if (task.assignee_kind !== "agent" || !task.assignee_id) continue;
			const c = counts.get(task.assignee_id) ?? { running: 0, waiting: 0 };
			if (task.status === "in_progress") c.running += 1;
			else if (task.status === "needs_input" || task.status === "blocked")
				c.waiting += 1;
			counts.set(task.assignee_id, c);
		}
		return counts;
	}, [allTasks.data]);

	const all = query.data?.items ?? [];
	const defaultId = query.data?.default_agent_id ?? null;
	// One grouped read for the whole list, on the list response (C10).
	const spend = query.data?.spend_this_month ?? {};
	const selected = all.find((a) => a.id === selectedAgentId) ?? null;
	const openAgent = agentId
		? (all.find((a) => a.id === agentId) ?? null)
		: null;

	const byId = useMemo(() => new Map(all.map((a) => [a.id, a])), [all]);
	const ephemeralHidden = showEphemeral
		? 0
		: all.filter((a) => a.lifetime === "ephemeral").length;

	/**
	 * Parents first, each followed by the helpers it spawned. Sorting the flat
	 * list would scatter a family across the list, which is exactly the thing
	 * the `└` gutter exists to prevent.
	 */
	const ordered = useMemo(() => {
		const visible = all.filter(
			(a) =>
				(showEphemeral || a.lifetime !== "ephemeral") &&
				(!kindFilter || a.kind === kindFilter) &&
				(!statusFilter || a.status === statusFilter),
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
	}, [all, showEphemeral, kindFilter, statusFilter]);

	// The drilled-in agent replaces the list inside this drawer — the envelope
	// needs the room, and the LLMs drawer below keeps its place (G33).
	if (openAgent) {
		return (
			<AgentDetail
				username={username}
				graphSlug={graphSlug}
				agent={openAgent}
				isDefault={openAgent.id === defaultId}
				isSaving={mutations.update.isPending}
				onBack={() => onOpenAgent(null)}
				onSave={(data: AgentUpdate) =>
					mutations.update.mutate({ id: openAgent.id, data })
				}
				onPause={() => setConfirming({ agent: openAgent, act: "pause" })}
				onResume={() => mutations.resume.mutate(openAgent.id)}
				onRetire={() => setConfirming({ agent: openAgent, act: "retire" })}
				onSetDefault={() => mutations.setDefault.mutate(openAgent.id)}
				onOpenTask={onOpenTask}
				onOpenLineage={() => onOpenLineage?.(openAgent.id)}
				onOpenEnvelope={() => onOpenEnvelope?.(openAgent.id)}
				onBindSkill={(skillId) => {
					// Cleared first, so the card under the chip is this click's
					// refusal and never the last one's (BN11).
					mutations.bindSkill.reset();
					mutations.bindSkill.mutate({ id: openAgent.id, skillId });
				}}
				onUnbindSkill={(skillId) => {
					mutations.bindSkill.reset();
					mutations.unbindSkill.mutate({ id: openAgent.id, skillId });
				}}
				bindError={mutations.bindSkill.error}
				isBinding={
					mutations.bindSkill.isPending || mutations.unbindSkill.isPending
				}
			/>
		);
	}

	const rows = ordered.filter(({ agent }) =>
		agent.name.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<FilterBar>
				<FilterSelect
					label="kind"
					value={kindFilter}
					options={KIND_OPTIONS}
					onChange={setKindFilter}
				/>
				<FilterSelect
					label="status"
					value={statusFilter}
					options={STATUS_OPTIONS}
					onChange={setStatusFilter}
				/>
				{/* A chip that toggles rather than selects. `active` is the kit's
				    pressed look; `aria-pressed` is what says so out loud. */}
				<FilterChip
					label="show ephemeral"
					active={showEphemeral}
					aria-pressed={showEphemeral}
					onClick={() => setShowEphemeral((v) => !v)}
				/>
			</FilterBar>

			<div className="flex-1 overflow-y-auto">
				{query.isLoading ? (
					<div className="p-4">
						<Spinner />
					</div>
				) : rows.length === 0 ? (
					<p className="p-4 text-base text-muted-foreground">
						{all.length
							? "No agent matches those filters."
							: "No agents yet. Every graph is seeded with Explorer, Query and Modeller — try refreshing."}
					</p>
				) : (
					rows.map(({ agent, depth }) => (
						<WorkRow
							key={agent.id}
							active={agent.id === selectedAgentId}
							onClick={() =>
								onSelectAgent(agent.id === selectedAgentId ? null : agent.id)
							}
							tone={agentTone(agent.status)}
							indent={depth}
							title={
								<>
									{agent.name}
									{agent.id === defaultId ? (
										<span
											className="ml-1.5 text-primary"
											title="graph default agent"
										>
											default
										</span>
									) : null}
								</>
							}
							status={humanStatus(agent.status)}
							statusTone={agentTone(agent.status)}
							subtitle={
								<span className="flex min-w-0 items-center gap-1.5">
									{/* The bound, on the row. `undefined` reads *Everything*,
									    which is a state and not a blank (AG5). */}
									<LensChip
										lens={
											agent.lens_name
												? { name: agent.lens_name, kind: "world" }
												: undefined
										}
									/>
									<span className="truncate">
										{agentSubline(
											agent,
											byId,
											liveOf.get(agent.id),
											spendLine(agent, spend)?.text,
										)}
									</span>
								</span>
							}
							actions={
								<>
									{onOpenLineage ? (
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											title="Draw the lineage"
											onClick={(e) => {
												e.stopPropagation();
												onSelectAgent(agent.id);
												onOpenLineage(agent.id);
											}}
										>
											<GitBranch className="h-3.5 w-3.5" />
										</Button>
									) : null}
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										title={agent.status === "paused" ? "Resume" : "Pause"}
										onClick={(e) => {
											e.stopPropagation();
											if (agent.status === "paused")
												mutations.resume.mutate(agent.id);
											else setConfirming({ agent, act: "pause" });
										}}
									>
										{agent.status === "paused" ? (
											<Play className="h-3.5 w-3.5" />
										) : (
											<Pause className="h-3.5 w-3.5" />
										)}
									</Button>
								</>
							}
						/>
					))
				)}
			</div>

			{selectedEdge ? (
				<EdgeDetail edge={selectedEdge} byId={byId} />
			) : selected ? (
				<AgentSummary
					agent={selected}
					isDefault={selected.id === defaultId}
					spend={spendLine(selected, spend)}
					lineageCount={lineage.data?.nodes.length ?? 0}
					childCount={
						all.filter((a) => a.parent_agent_id === selected.id).length
					}
					tasks={tasks.data?.items ?? []}
					onOpenTask={onOpenTask}
				/>
			) : (
				<DetailPlaceholder hint="Pick an agent to see its brief, its three bounds and its work — or open its lineage on the canvas." />
			)}

			<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
				{onNewAgent ? (
					<Button size="sm" onClick={onNewAgent}>
						<Plus /> New agent
					</Button>
				) : null}
				{selected ? (
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => onOpenAgent(selected.id)}
						>
							<SquareArrowOutUpRight /> Open
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={selected.status === "retired"}
							onClick={() => {
								if (selected.status === "paused")
									mutations.resume.mutate(selected.id);
								else setConfirming({ agent: selected, act: "pause" });
							}}
						>
							{selected.status === "paused" ? <Play /> : <Pause />}
							{selected.status === "paused" ? "Resume" : "Pause"}
						</Button>
						{selected.id !== defaultId && selected.status === "active" ? (
							<>
								<span className="flex-1" />
								<Button
									size="sm"
									variant="ghost"
									onClick={() => mutations.setDefault.mutate(selected.id)}
								>
									<Star /> Set as default
								</Button>
							</>
						) : null}
					</>
				) : null}
			</CardFooter>

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
							Lineage
						</StatusCrumb>
					</>
				}
				middle={[
					`${rows.length} agent${rows.length === 1 ? "" : "s"}`,
					...(ephemeralHidden
						? [
								<StatusCount key="eph" tone="warning">
									{ephemeralHidden} ephemeral hidden
								</StatusCount>,
							]
						: []),
				]}
			/>

			<LifecycleDialog
				agent={confirming?.agent ?? null}
				act={confirming?.act ?? null}
				items={preview.data?.items}
				isLoading={preview.isLoading}
				onCancel={() => setConfirming(null)}
				onConfirm={() => {
					if (!confirming) return;
					if (confirming.act === "retire")
						mutations.retire.mutate({ id: confirming.agent.id });
					else mutations.pause.mutate(confirming.agent.id);
					setConfirming(null);
				}}
			/>
		</div>
	);
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
 * `authored by ravi · 2 skills · 1 running` — provenance first, because the
 * question the list is scanned for is *where did this come from*. The bound is
 * drawn as a chip beside this, not written into it.
 */
function agentSubline(
	agent: Agent,
	byId: Map<string, Agent>,
	live: { running: number; waiting: number } | undefined,
	spend?: string,
): string {
	const bits: string[] = [];
	if (agent.kind === "spawned") {
		const parent = agent.parent_agent_id
			? byId.get(agent.parent_agent_id)
			: null;
		bits.push(parent ? `spawned by ${parent.name}` : "spawned");
	} else if (agent.kind === "seeded") bits.push("seeded");
	else bits.push("authored");
	if (agent.lifetime === "ephemeral") bits.push("ephemeral");
	if (agent.skill_ids?.length)
		bits.push(
			`${agent.skill_ids.length} skill${agent.skill_ids.length === 1 ? "" : "s"}`,
		);
	if (spend) bits.push(spend);
	// Live work last, because it is the bit that changes while you look at it.
	if (live?.running) bits.push(`${live.running} running`);
	if (live?.waiting) bits.push(`${live.waiting} needs input`);
	return bits.join(" · ");
}

/**
 * The selected row, stated. This is the read-only grammar; the *editable* one
 * lives in {@link AgentDetail} behind **Open**, and keeping them visibly
 * different is what stops this block from reading as a broken form.
 */
function AgentSummary({
	agent,
	isDefault,
	spend,
	lineageCount,
	childCount,
	tasks,
	onOpenTask,
}: {
	agent: Agent;
	isDefault: boolean;
	/** Spend against the month ceiling, or null when nothing is priced. */
	spend: { text: string; meter: number | undefined } | null;
	lineageCount: number;
	childCount: number;
	tasks: { id: string; title: string; status: string }[];
	onOpenTask?: (id: string) => void;
}) {
	const spec = agent.workflow_spec as {
		allow?: string[];
		templates?: string[];
	};
	return (
		<DetailBlock
			title={`${agent.name} · work`}
			subtitle={
				lineageCount > 1
					? `lineage: ${childCount} child${childCount === 1 ? "" : "ren"} · ${lineageCount} nodes`
					: agent.description || undefined
			}
		>
			<PropertyRow label="status">
				<DetailStatus tone={agentTone(agent.status)}>
					{humanStatus(agent.status)}
				</DetailStatus>
				{agent.lifetime === "ephemeral" ? (
					<>
						{" "}
						<DetailStatus>ephemeral</DetailStatus>
					</>
				) : null}
				{isDefault ? (
					<DetailProse>the graph default for new sessions</DetailProse>
				) : null}
			</PropertyRow>
			<PropertyRow label="works in">
				{/* The third bound, stated where the other two are read (AG6). */}
				<LensChip
					lens={
						agent.lens_name
							? { name: agent.lens_name, kind: "world" }
							: undefined
					}
				/>
			</PropertyRow>
			<PropertyRow label="spend">
				{/* The meter is only drawn against a **real ceiling** — without one
				    a bar would invent a limit nobody set. */}
				{spend ? (
					<MetricTile
						label="this month"
						value={spend.text}
						meter={spend.meter}
						tone={spend.meter && spend.meter >= 0.9 ? "warning" : undefined}
					/>
				) : (
					<DetailProse>
						nothing priced this month — a subscription endpoint publishes no
						per-token rate, so there is no number rather than a zero
					</DetailProse>
				)}
			</PropertyRow>
			<PropertyRow label="allows" mono>
				{(spec.allow ?? []).length
					? `${spec.allow?.length} steps`
					: "nothing yet"}
			</PropertyRow>
			{spec.templates?.length ? (
				<PropertyRow label="workflows" mono>
					{spec.templates.join(" · ")}
				</PropertyRow>
			) : null}
			<PropertyRow label={`work (${tasks.length})`}>
				{tasks.length ? (
					<ul className="space-y-0.5">
						{tasks.slice(0, 5).map((task) => (
							<li key={task.id}>
								<button
									type="button"
									onClick={() => onOpenTask?.(task.id)}
									className="truncate text-left hover:text-primary"
								>
									{task.title}
								</button>
								<span className="text-muted-foreground">
									{" "}
									· {humanStatus(task.status)}
								</span>
							</li>
						))}
					</ul>
				) : (
					<span className="text-muted-foreground">no tasks</span>
				)}
			</PropertyRow>
		</DetailBlock>
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
