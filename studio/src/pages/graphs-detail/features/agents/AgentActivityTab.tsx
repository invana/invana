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
	useAgentActivityQuery,
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
import { DetailStatus } from "@/pages/graphs-detail/shared/DetailRows";
import {
	verdictLabel,
	verdictTone,
} from "@/pages/graphs-detail/shared/statusTone";
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
} from "@invana/ui";

/** `template nl-compare@3 · 7 steps · 1 replan` — where the plan came from. */
function planProvenance(plan: TaskRunSummary): string {
	const source = plan.plan_origin ?? "no plan recorded";
	const bits = [
		source.startsWith("template:")
			? `template ${source.slice("template:".length)}`
			: source,
		`${plan.step_count} step${plan.step_count === 1 ? "" : "s"}`,
	];
	if (plan.replans)
		bits.push(`${plan.replans} replan${plan.replans === 1 ? "" : "s"}`);
	return bits.join(" · ");
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
	const events = useAgentActivityQuery(username, graphSlug, agent.id);
	const m = meters.data;
	const children = (lineage.data?.nodes ?? []).filter(
		(n) => n.kind === "agent" && n.id !== agent.id,
	);
	const mine = sessions.data?.items ?? [];

	return (
		<>
			<PanelSection title="Now" hint="each beside the limit that caps it">
				{m ? <Meters m={m} /> : <Spinner />}
			</PanelSection>

			{/* The artboard's two columns when the page is wide enough: what it
			    did on the left, what caps it and who asks through it on the
			    right. One column when `rightSection` takes the room. */}
			<div className="grid @min-[760px]:grid-cols-2 @min-[760px]:divide-x divide-border">
				<div className="min-w-0">
					<PanelSection title="Runs" hint="what this agent has run">
						{runs.isLoading ? (
							<Spinner />
						) : !runs.data?.items.length ? (
							<p className="text-muted-foreground">
								This agent has not run yet.
							</p>
						) : (
							<ul className="space-y-1.5">
								{runs.data.items.map((plan) => (
									<li key={plan.id} className="flex items-start gap-2">
										<span className="min-w-0 flex-1">
											<span className="block truncate">
												{plan.body ?? plan.task_title ?? plan.workflow_key}
											</span>
											<span className="block truncate text-sm text-muted-foreground">
												<span className="font-mono">{plan.id.slice(0, 4)}</span>{" "}
												· {planProvenance(plan)}
												{plan.cost_usd != null
													? ` · ${usd(plan.cost_usd)}`
													: ""}
												{plan.queued_at
													? ` · ${formatRelativeTime(new Date(plan.queued_at))}`
													: ""}
											</span>
										</span>
										{/* Absent `served` means the run never reached Verify —
									    drawn as the status, because "nobody asked" and "asked
									    and failed" are different facts. */}
										<DetailStatus
											tone={
												plan.served
													? verdictTone(plan.served)
													: plan.status === "failed"
														? "error"
														: "muted"
											}
										>
											{plan.served ? verdictLabel(plan.served) : plan.status}
										</DetailStatus>
									</li>
								))}
							</ul>
						)}
					</PanelSection>

					<PanelSection
						title="Lineage"
						action={
							<Button
								variant="link"
								size="sm"
								className="h-auto p-0"
								onClick={onOpenLineage}
							>
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

					<PanelSection title="Events" hint="newest first">
						{events.isLoading ? (
							<Spinner />
						) : events.data?.items.length ? (
							<ul className="space-y-1">
								{events.data.items.slice(0, 20).map((e) => (
									<li key={e.id} className="flex items-baseline gap-2">
										<span className="min-w-0 flex-1 truncate font-mono text-sm">
											{e.action}
											{e.target_kind ? (
												<span className="text-muted-foreground">
													{" "}
													· {e.target_kind}
												</span>
											) : null}
										</span>
										<span className="shrink-0 text-sm text-muted-foreground">
											{formatRelativeTime(new Date(e.created_at))}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-muted-foreground">Nothing recorded yet.</p>
						)}
					</PanelSection>
				</div>
				<div className="min-w-0">
					<PanelSection
						title="Limits"
						hint="empty means the Graph default applies"
					>
						<Eyebrow>Spend</Eyebrow>
						<CeilingsTable
							group="budget"
							values={draft.budget}
							onChange={(budget) => onPatch({ budget })}
						/>
						<Eyebrow className="mt-2">Reach</Eyebrow>
						<CeilingsTable
							group="reach"
							values={draft.budget}
							onChange={(budget) => onPatch({ budget })}
						/>
					</PanelSection>

					<PanelSection
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
		</>
	);
}
