/**
 * Activity — what the agent is using and has done (AG23): the meters, each
 * beside the limit that caps it, its runs, its sessions, its lineage and its
 * event feed.
 *
 * **Sessions are private to whoever opened them.** The Graph-wide number is a
 * count, `meters.sessions`, which names no thread; the list under it is the
 * reader's own (AG31 · AG32).
 */

import {
	useAgentLineageQuery,
	useAgentMetersQuery,
	useAgentSessionsQuery,
	useRunsQuery,
} from "@/hooks/queries/useWork";
import { formatRelativeTime } from "@/lib/time";
import { CeilingsTable } from "@/pages/graphs-detail/features/agents/CeilingsTable";
import {
	type AgentDraft,
	usd,
} from "@/pages/graphs-detail/features/agents/agentDraft";
import { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import type { Agent, AgentMeters, TaskRunSummary } from "@/types/work";
import { PanelSection } from "@/ui/PanelSection";
import {
	Button,
	Eyebrow,
	MetricGrid,
	MetricTile,
	PropertyList,
	PropertyRow,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useState } from "react";

/** How a run ended, in the reader's words and tone (CA8). */
function outcomeOf(run: TaskRunSummary): { text: string; tone: string } {
	if (!run.finished_at && run.status !== "failed" && run.status !== "cancelled")
		return {
			text: run.status === "queued" ? "queued" : "running",
			tone: "text-info",
		};
	switch (run.outcome) {
		case "answered":
			return { text: "answered", tone: "text-success" };
		case "conversed":
			return { text: "small talk", tone: "text-muted-foreground" };
		case "cannot_answer":
			return { text: "cannot answer", tone: "text-warning" };
		case "failed":
			return { text: "failed", tone: "text-destructive" };
		default:
			return { text: run.outcome ?? run.status, tone: "text-muted-foreground" };
	}
}

const share = (used: number, cap?: number | null) =>
	cap ? Math.min(used / cap, 1) : undefined;

function Meters({ m }: { m: AgentMeters }) {
	return (
		<MetricGrid minTileWidth={112} gap={6}>
			<MetricTile
				label="Running"
				value={
					m.max_concurrent_runs == null
						? m.running
						: `${m.running} of ${m.max_concurrent_runs}`
				}
				caption="slots in use"
				meter={share(m.running, m.max_concurrent_runs)}
			/>
			<MetricTile
				label="Queued"
				value={m.queued}
				caption="waiting for a slot"
			/>
			<MetricTile
				label="Runs"
				value={m.runs_this_month.toLocaleString()}
				caption="this month"
			/>
			<MetricTile
				label="Sessions"
				value={m.sessions.toLocaleString()}
				caption="asking through it"
			/>
			{/* Absent is not zero (AG11): a month with no priced run draws a dash,
			    never a reassuring $0.00. */}
			<MetricTile
				label="Spent"
				value={m.spend_this_month == null ? "—" : usd(m.spend_this_month)}
				caption={
					m.spend_this_month == null
						? "nothing priced this month"
						: m.max_cost_usd_month == null
							? "this month"
							: `of ${usd(m.max_cost_usd_month)}`
				}
				meter={
					m.spend_this_month == null
						? undefined
						: share(m.spend_this_month, m.max_cost_usd_month)
				}
			/>
		</MetricGrid>
	);
}

export function AgentActivityTab({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
	onOpenLineage,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
	onOpenLineage: () => void;
}) {
	const meters = useAgentMetersQuery(username, graphSlug, agent.id);
	const runs = useRunsQuery(username, graphSlug, {
		agentId: agent.id,
		limit: 8,
	});
	const sessions = useAgentSessionsQuery(username, graphSlug, agent.id);
	const lineage = useAgentLineageQuery(username, graphSlug, agent.id);
	const runsPanel = useLeftSection();
	// Limits read as text until Edit, as drawn (AG38).
	const [editingLimits, setEditingLimits] = useState(false);
	const m = meters.data;
	const children = (lineage.data?.nodes ?? []).filter(
		(n) => n.kind === "agent" && n.id !== agent.id,
	);
	const mine = sessions.data?.items ?? [];
	// What a run reads where the agent is silent: the meters carry every
	// effective ceiling (AG31), so the page shows the Graph's number, not a dash.
	const ceilings = m
		? Object.fromEntries(
				Object.entries(m).filter(
					(e): e is [string, number] =>
						e[0].startsWith("max_") && typeof e[1] === "number",
				),
			)
		: undefined;

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			{m ? <Meters m={m} /> : <Spinner />}

			{/* What it did on the left, what caps it and who asks through it on
			    the right; one column when `rightSection` takes the room. */}
			<div className="grid items-start gap-2.5 @[760px]:grid-cols-[5fr_4fr]">
				<div className="flex min-w-0 flex-col gap-2.5">
					<PanelSection
						card
						title="Runs"
						action={
							<Button
								size="sm"
								variant="ghost"
								onClick={() => runsPanel.setSection("runs")}
							>
								Open in Runs
							</Button>
						}
					>
						{runs.isLoading ? (
							<Spinner />
						) : !runs.data?.items.length ? (
							<p className="text-muted-foreground">
								This agent has not run yet.
							</p>
						) : (
							<Table bordered={false} density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Run</TableHead>
										<TableHead>Ask</TableHead>
										<TableHead>Outcome</TableHead>
										<TableHead>Cost</TableHead>
										<TableHead>When</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{runs.data.items.map((run) => {
										const outcome = outcomeOf(run);
										return (
											<TableRow key={run.id}>
												<TableCell className="font-mono">
													{run.id.slice(0, 4)}
												</TableCell>
												<TableCell className="w-full max-w-0 truncate">
													{run.body ?? run.task_title ?? run.workflow_key}
												</TableCell>
												<TableCell
													className={`whitespace-nowrap ${outcome.tone}`}
												>
													{outcome.text}
												</TableCell>
												<TableCell className="font-mono">
													{run.cost_usd != null ? usd(run.cost_usd) : "—"}
												</TableCell>
												<TableCell className="whitespace-nowrap text-muted-foreground">
													{run.queued_at
														? formatRelativeTime(new Date(run.queued_at))
														: "—"}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</PanelSection>

					<PanelSection
						card
						title="Lineage"
						action={
							<Button size="sm" variant="ghost" onClick={onOpenLineage}>
								Open lineage
							</Button>
						}
					>
						<PropertyList labelWidth={96}>
							<PropertyRow label="created">
								{agent.kind} by {agent.created_by_kind} ·{" "}
								{new Date(agent.created_at).toLocaleDateString()}
							</PropertyRow>
							<PropertyRow label="spawned">
								{m
									? m.spawned_this_month
										? `${m.spawned_this_month} this month${m.max_children != null ? ` · up to ${m.max_children} per run` : ""}`
										: agent.policy.can_spawn
											? "none this month"
											: "none — it may not spawn"
									: "…"}
							</PropertyRow>
							<PropertyRow label="depth">
								{m
									? m.depth
										? `${m.depth} — a child${m.max_depth != null ? `, of at most ${m.max_depth}` : ""}`
										: "0 — a root agent"
									: "…"}
							</PropertyRow>
							<PropertyRow label="related">
								{children.length
									? children.map((n) => n.label).join(" · ")
									: "none"}
							</PropertyRow>
						</PropertyList>
					</PanelSection>
				</div>

				<div className="flex min-w-0 flex-col gap-2.5">
					<PanelSection
						card
						title="Limits"
						action={
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setEditingLimits(!editingLimits)}
							>
								{editingLimits ? "Done" : "Edit"}
							</Button>
						}
					>
						<Eyebrow>Spend</Eyebrow>
						<CeilingsTable
							group="budget"
							values={draft.budget}
							effective={ceilings}
							readOnly={!editingLimits}
							onChange={(budget) => onPatch({ budget })}
						/>
						<Eyebrow className="mt-2">Reach</Eyebrow>
						<CeilingsTable
							group="reach"
							values={draft.budget}
							effective={ceilings}
							readOnly={!editingLimits}
							onChange={(budget) => onPatch({ budget })}
						/>
					</PanelSection>

					<PanelSection
						card
						title="Sessions"
						hint={
							m
								? `${m.sessions} asking through ${agent.name}, in the Graph`
								: undefined
						}
					>
						<Eyebrow aside={mine.length || undefined}>Yours</Eyebrow>
						{sessions.isLoading ? (
							<Spinner />
						) : mine.length ? (
							<ul className="space-y-1">
								{mine.map((s) => (
									<li key={s.id} className="flex items-baseline gap-2">
										<span className="min-w-0 flex-1 truncate">
											{s.title || "Untitled session"}
										</span>
										<span className="shrink-0 text-sm text-muted-foreground">
											{formatRelativeTime(s.updatedAt)}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-muted-foreground">
								You have no sessions with this agent. Others' sessions are
								theirs — only their count is shown.
							</p>
						)}
					</PanelSection>
				</div>
			</div>
		</div>
	);
}
