/**
 * The agent roster (docs/for-developers/modules/work/spec.md J3), and the way into one agent's own surface.
 *
 * *As a graph owner, I want to see every agent in this graph, who or what
 * created it, and what it has done, so that spawned agents are never
 * invisible.*
 *
 * Three things this panel is careful about:
 *
 * - **Ephemeral agents are hidden, not absent.** A spawned helper exists for
 *   one task and would otherwise grow the roster without bound — but it is
 *   fully present in lineage and in the trace, so the toggle reveals rather
 *   than resurrects. Hidden ones are *counted* in the status bar, because a
 *   roster that silently omits rows is one nobody can trust.
 * - **A spawned agent nests under its parent.** The `└` gutter is the whole
 *   answer to "where did this come from?" without opening the lineage.
 * - **Retire names the open tasks before it happens.** A count is not enough
 *   to decide with, so the confirm lists them.
 *
 * Selecting a row states the agent in the detail block; **Open** takes you into
 * {@link AgentDetail}, the one work surface that edits.
 */

import { useLLMProvidersQuery } from "@/hooks/queries/useLLMProviders";
import {
	useAgentLineageQuery,
	useAgentMutations,
	useAgentsQuery,
	useRetirePreviewQuery,
	useTasksQuery,
} from "@/hooks/queries/useWork";
import { AgentDetail } from "@/pages/graphs-detail/features/agents/AgentDetail";
import {
	AgentChipRow,
	DetailBlock,
	DetailPlaceholder,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { ListPanelChrome } from "@/pages/graphs-detail/shared/ListPanel";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import {
	agentTone,
	humanStatus,
} from "@/pages/graphs-detail/shared/statusTone";
import type { Agent, AgentEdge, AgentUpdate } from "@/types/work";
import { FilterSelect } from "@/ui/FilterSelect";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	CardFooter,
	FilterBar,
	FilterChip,
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

interface Props {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	/** The agent whose lineage is on the canvas, and the one the detail shows. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	/** An edge selected on the lineage canvas — an *event*, not an agent (D7). */
	selectedEdge?: AgentEdge | null;

	/** Open the lineage as a canvas tab. */
	onOpenLineage?: (agentId: string) => void;
	/** Open the envelope as a canvas tab. */
	onOpenEnvelope?: (agentId: string) => void;
	onOpenTask?: (taskId: string) => void;
	onNewAgent?: () => void;
}

export function AgentsPanel({
	username,
	graphSlug,
	onClose,
	selectedAgentId,
	onSelectAgent,
	selectedEdge,
	onOpenLineage,
	onOpenEnvelope,
	onOpenTask,
	onNewAgent,
}: Props) {
	const [showEphemeral, setShowEphemeral] = useState(false);
	const [kindFilter, setKindFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [retiring, setRetiring] = useState<Agent | null>(null);
	/** Selecting a row states it; opening one edits it. Two different gestures. */
	const [opened, setOpened] = useState<string | null>(null);

	// Always fetch the full roster (ephemeral included): the *count* of what is
	// hidden belongs in the status bar, so the filter has to happen here rather
	// than at the endpoint.
	const query = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const mutations = useAgentMutations(username, graphSlug);
	const preview = useRetirePreviewQuery(
		username,
		graphSlug,
		retiring?.id,
		retiring !== null,
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
	// The roster's subline names the model and the live work, which is what the
	// hi-fi puts there — and both are the questions you open the roster to ask
	// ("which mind is this?", "is anything waiting on me?"). One unfiltered task
	// list answers the counts for every row; one provider list answers the model.
	const llms = useLLMProvidersQuery(username, graphSlug);
	const allTasks = useTasksQuery(username, graphSlug);
	const modelOf = useMemo(() => {
		const byId = new Map(
			(llms.data?.items ?? []).map((l) => [l.id, l.model_id]),
		);
		return (agent: Agent) =>
			agent.llm_config_id ? (byId.get(agent.llm_config_id) ?? null) : null;
	}, [llms.data]);
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
	const selected = all.find((a) => a.id === selectedAgentId) ?? null;
	const openAgent = opened ? (all.find((a) => a.id === opened) ?? null) : null;

	const byId = useMemo(() => new Map(all.map((a) => [a.id, a])), [all]);
	const ephemeralHidden = showEphemeral
		? 0
		: all.filter((a) => a.lifetime === "ephemeral").length;

	/**
	 * Parents first, each followed by the helpers it spawned. Sorting the flat
	 * list would scatter a family across the roster, which is exactly the thing
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

	// One agent's surface replaces the roster entirely — it takes the whole
	// panel rather than opening beside the list, because the envelope needs
	// the room.
	if (openAgent) {
		return (
			<ListPanelChrome
				title={
					<Breadcrumb>
						<BreadcrumbList className="gap-1 font-semibold sm:gap-1">
							<BreadcrumbItem>Agents</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem className="min-w-0">
								<BreadcrumbPage className="truncate font-semibold">
									{openAgent.name}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				}
				icon={Bot}
				onRefresh={() => query.refetch()}
				isRefreshing={query.isFetching}
				listControls={false}
				onClose={onClose}
			>
				{() => (
					<AgentDetail
						username={username}
						graphSlug={graphSlug}
						agent={openAgent}
						isDefault={openAgent.id === defaultId}
						isSaving={mutations.update.isPending}
						onBack={() => setOpened(null)}
						onSave={(data: AgentUpdate) =>
							mutations.update.mutate({ id: openAgent.id, data })
						}
						onPause={() => mutations.pause.mutate(openAgent.id)}
						onResume={() => mutations.resume.mutate(openAgent.id)}
						onRetire={() => setRetiring(openAgent)}
						onSetDefault={() => mutations.setDefault.mutate(openAgent.id)}
						onOpenTask={onOpenTask}
						onOpenLineage={() => onOpenLineage?.(openAgent.id)}
						onOpenEnvelope={() => onOpenEnvelope?.(openAgent.id)}
					/>
				)}
			</ListPanelChrome>
		);
	}

	return (
		<>
			<ListPanelChrome
				title="Agents"
				icon={Bot}
				onRefresh={() => query.refetch()}
				isRefreshing={query.isFetching}
				searchable
				searchLabel="Search agents"
				onClose={onClose}
				leadingActions={
					onNewAgent
						? [
								{
									key: "new",
									name: "New agent",
									icon: Plus,
									onClick: onNewAgent,
								},
							]
						: undefined
				}
			>
				{({ search }) => {
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
								{/* A chip that toggles rather than selects. `active` is the
								    kit's pressed look; `aria-pressed` is what says so out loud. */}
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
									<p className="p-4 text-sm text-muted-foreground">
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
												onSelectAgent(
													agent.id === selectedAgentId ? null : agent.id,
												)
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
												<span className="truncate">
													{agentSubline(
														agent,
														byId,
														modelOf(agent),
														liveOf.get(agent.id),
													)}
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
														title={
															agent.status === "paused" ? "Resume" : "Pause"
														}
														onClick={(e) => {
															e.stopPropagation();
															(agent.status === "paused"
																? mutations.resume
																: mutations.pause
															).mutate(agent.id);
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
									lineageCount={lineage.data?.nodes.length ?? 0}
									childCount={
										all.filter((a) => a.parent_agent_id === selected.id).length
									}
									tasks={tasks.data?.items ?? []}
									onOpenTask={onOpenTask}
								/>
							) : (
								<DetailPlaceholder hint="Pick an agent to see its brief, envelope and bounds — or open its lineage on the canvas." />
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
											onClick={() => setOpened(selected.id)}
										>
											<SquareArrowOutUpRight /> Open
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={selected.status === "retired"}
											onClick={() =>
												(selected.status === "paused"
													? mutations.resume
													: mutations.pause
												).mutate(selected.id)
											}
										>
											{selected.status === "paused" ? <Play /> : <Pause />}
											{selected.status === "paused" ? "Resume" : "Pause"}
										</Button>
										{selected.id !== defaultId &&
										selected.status === "active" ? (
											<>
												<span className="flex-1" />
												<Button
													size="sm"
													variant="ghost"
													onClick={() =>
														mutations.setDefault.mutate(selected.id)
													}
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
										<StatusCrumb active>Roster</StatusCrumb>
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
						</div>
					);
				}}
			</ListPanelChrome>

			<AlertDialog
				open={retiring !== null}
				onOpenChange={(open) => !open && setRetiring(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Retire {retiring?.name}?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-2 text-sm">
								<p>
									Retiring is not deleting — the row stays so lineage and every
									trace entry still read by name.
								</p>
								{preview.data?.open_task_titles.length ? (
									<div>
										<p className="font-medium text-foreground">
											{preview.data.open_task_titles.length} open task
											{preview.data.open_task_titles.length === 1 ? "" : "s"}{" "}
											will be blocked:
										</p>
										<ul className="mt-1 list-disc pl-5 text-muted-foreground">
											{preview.data.open_task_titles.map((t) => (
												<li key={t}>{t}</li>
											))}
										</ul>
									</div>
								) : (
									<p className="text-muted-foreground">No open tasks.</p>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (retiring) mutations.retire.mutate({ id: retiring.id });
								setRetiring(null);
							}}
						>
							Retire
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

/**
 * `authored by ravi · claude-opus-5 · 2 skills` — provenance first, because the
 * question a roster is scanned for is *where did this come from*.
 */
function agentSubline(
	agent: Agent,
	byId: Map<string, Agent>,
	model: string | null,
	live: { running: number; waiting: number } | undefined,
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
	if (model) bits.push(model);
	if (agent.skill_ids?.length)
		bits.push(
			`${agent.skill_ids.length} skill${agent.skill_ids.length === 1 ? "" : "s"}`,
		);
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
	lineageCount,
	childCount,
	tasks,
	onOpenTask,
}: {
	agent: Agent;
	isDefault: boolean;
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
 * the trace (docs/for-developers/modules/agents/features/lineage.md): actor, on behalf of whom, caused by what. Nothing
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
