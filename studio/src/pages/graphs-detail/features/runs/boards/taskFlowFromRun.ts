/**
 * A run's tasks as `TaskFlowCanvas` data (SR32): one node per task group, keyed
 * by the head step's id so a click opens that step.
 *
 * A `TaskRun` records order and a lane, not dependencies, so the edges are
 * `sequence` edges in `seq` order — a drawn branch would be invented. The
 * plan's real edges replace them once `plan_snapshot` is on the trace.
 */

import {
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	taskNodeTypeOf,
	taskToneOf,
} from "@/canvases/taskflow";
import { formatDuration } from "@/lib/time";
import {
	durationMs,
	type TaskGroup,
} from "@/pages/graphs-detail/shared/dashboards/shared";

function iconOf(bound: string | null): string {
	if (bound === "llm") return "lucide/sparkles";
	if (bound?.startsWith("graph_") || bound === "schema_write")
		return "lucide/database";
	if (bound === "ingest") return "lucide/upload";
	return "lucide/square-function";
}

export function taskFlowFromRun(groups: TaskGroup[]): TaskFlowData {
	const nodes: TaskFlowNode[] = groups.map((group, i) => {
		const { head } = group;
		const ms =
			head.duration_ms ?? durationMs(head.started_at, head.finished_at);
		return {
			id: head.id,
			type: taskNodeTypeOf(head.bound),
			data: {
				title: group.label,
				bound: head.bound ?? "none",
				tone: taskToneOf(head.bound),
				icon: iconOf(head.bound),
				summary: head.detail,
				stepKey: group.taskKey,
				ordinal: i,
				rows: [
					{ label: "status", value: head.status },
					...(ms == null ? [] : [{ label: "took", value: formatDuration(ms) }]),
					...(group.lanes > 1
						? [{ label: "lanes", value: String(group.lanes) }]
						: []),
					...(group.attempts > 1
						? [{ label: "attempts", value: String(group.attempts) }]
						: []),
				],
			},
		};
	});

	const edges: TaskFlowEdge[] = nodes.slice(1).map((node, i) => ({
		id: `${nodes[i].id}->${node.id}`,
		source: nodes[i].id,
		target: node.id,
		data: { kind: "sequence", description: "ran after it, in seq order" },
	}));

	return { nodes, edges };
}
