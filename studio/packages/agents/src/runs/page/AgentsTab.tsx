/**
 * A run › **Agents** — who spawned whom.
 *
 * - **Tree** (the default): on the layered canvas, a column per depth — what
 *   started the run (the Todo or the session), the root agent, and every
 *   helper under the agent that made it, each with its state in words and
 *   `tokens/escrow`. A pending delegation ask hangs off the agent asking,
 *   dashed; selecting it opens Approvals › Waiting.
 * - **By role** (`&view=role`, offered past 50 agents): one card per role with
 *   a bar of its agents by state, and one cell per agent.
 *
 * Every count is the engine's; the page formats them.
 */

import { HeatStrip, SegmentedBar, SegmentedBarLegend } from "@invana/charts";
import { SegmentedControl } from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { PanelSection, type Tone } from "@invana-studio/ui";
import { useMemo } from "react";
import { TabReadState } from "../../agents/agentParts";
import { useAgentsOpen } from "../../open";
import { tokens } from "../../overview/fleetParts";
import { useRunAgentsQuery } from "../queries";
import type { RunAgentNode, RunAgents } from "../types";
import { useRunParam } from "./useRunParam";

/** The states a role's bar and cells are drawn in — status colours, named once. */
const STATES = [
	{ key: "served", label: "served", color: "var(--color-success)" },
	{ key: "running", label: "running", color: "var(--color-info)" },
	{ key: "waiting", label: "waiting", color: "var(--color-warning)" },
	{
		key: "not served",
		label: "no progress · loop · time",
		color: "var(--color-destructive)",
	},
	{
		key: "stopped",
		label: "stopped · parent ended",
		color: "var(--color-muted-foreground)",
	},
];

/** Which of the drawn states a run falls in — the engine's own `by_state` words. */
function stateOf(status: string, exitReason: string | null): string {
	if (exitReason === "served") return "served";
	if (exitReason === "stopped" || exitReason === "parent_ended")
		return "stopped";
	if (exitReason) return "not served";
	if (status === "queued" || status === "running") return "running";
	if (status.startsWith("awaiting") || status === "needs_input")
		return "waiting";
	return "stopped";
}

const TONE: Record<string, Tone> = {
	served: "success",
	running: "running",
	waiting: "warning",
	"not served": "error",
	stopped: "muted",
};

export function AgentsTab({
	username,
	graphSlug,
	runId,
	live,
	large,
}: {
	username: string;
	graphSlug: string;
	runId: string;
	live: boolean;
	/** Past 50 agents — *By role* is offered. */
	large: boolean;
}) {
	const agents = useRunAgentsQuery(username, graphSlug, runId, live);
	const [view, setView] = useRunParam(runId, "view");
	const byRole = large && view === "role";

	if (!agents.data)
		return (
			<TabReadState
				loading={agents.isLoading}
				error={agents.error}
				what="this run's agents"
				onRetry={() => void agents.refetch()}
			/>
		);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{large ? (
				<div className="shrink-0 px-3 pt-3">
					<SegmentedControl
						size="sm"
						aria-label="View"
						value={byRole ? "role" : "tree"}
						onValueChange={(v) => setView(v === "role" ? "role" : null)}
						options={[
							{ value: "tree", label: "Tree" },
							{ value: "role", label: "By role" },
						]}
					/>
				</div>
			) : null}
			{byRole ? <ByRole data={agents.data} /> : <Tree data={agents.data} />}
		</div>
	);
}

/** `no progress · 14k/30k` — its state, then its spend against its escrow. */
function subLine(node: RunAgentNode): string {
	const spend =
		node.budget != null
			? `${tokens(node.tokens)}/${tokens(node.budget)}`
			: tokens(node.tokens);
	return [node.state_line, spend].filter(Boolean).join(" · ");
}

function Tree({ data }: { data: RunAgents }) {
	const open = useAgentsOpen();
	const { nodes, edges } = useMemo(() => {
		const nodes: LayeredNode[] = [
			{
				id: "origin",
				label: data.origin_label,
				sub: data.origin_line,
				column: 0,
				tone: "muted",
			},
		];
		const edges: LayeredEdge[] = [];
		const depthOf = new Map(data.nodes.map((n) => [n.run_id, n.depth]));
		for (const n of data.nodes) {
			nodes.push({
				id: n.run_id,
				label: n.agent_name,
				sub: subLine(n),
				column: n.depth + 1,
				tone: TONE[stateOf(n.status, n.exit_reason)],
			});
			const parent =
				n.parent_run_id && depthOf.has(n.parent_run_id)
					? n.parent_run_id
					: "origin";
			edges.push({
				id: `${parent}->${n.run_id}`,
				source: parent,
				target: n.run_id,
				label: n.how === "root" ? undefined : n.how,
			});
		}
		for (const ask of data.asks) {
			const id = `ask:${ask.approval_id}`;
			nodes.push({
				id,
				label: ask.agent_name,
				sub: ask.line,
				column: (depthOf.get(ask.from_run_id) ?? 0) + 2,
				tone: "warning",
			});
			edges.push({
				id: `${ask.from_run_id}->${id}`,
				source: ask.from_run_id,
				target: id,
				label: "asks to delegate",
				dashed: true,
			});
		}
		return { nodes, edges };
	}, [data]);

	return (
		<div className="relative min-h-96 flex-1">
			<LayeredCanvas
				kind="data"
				nodes={nodes}
				edges={edges}
				onSelectNode={(id) => {
					if (id?.startsWith("ask:")) open.section("approvals", "waiting");
				}}
				emptyHint="No agent has started yet."
			/>
		</div>
	);
}

function ByRole({ data }: { data: RunAgents }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
			<SegmentedBarLegend series={STATES} />
			{data.roles.map((role) => (
				<PanelSection
					key={`${role.depth}:${role.role}`}
					card
					title={role.role}
					action={
						<span className="font-mono text-sm text-muted-foreground">
							×{role.agents}
						</span>
					}
				>
					<div className="flex flex-col gap-2">
						<SegmentedBar values={role.by_state} series={STATES} />
						<span className="text-sm text-muted-foreground">{role.line}</span>
						<HeatStrip
							states={STATES.map(({ key, label, color }) => ({
								key,
								label,
								color,
							}))}
							cells={role.cells.map((cell) => ({
								at: cell.run_id.slice(0, 8),
								state: stateOf(cell.status, cell.exit_reason),
							}))}
						/>
					</div>
				</PanelSection>
			))}
		</div>
	);
}
