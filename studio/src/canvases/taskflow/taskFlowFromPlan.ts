/**
 * A skill's plan as `TaskFlowCanvas` data (SK16): the plan's own nodes and
 * edges. `order` is drawn as `require` — the canvas's word for *must settle
 * first* — and `binding` stays `binding`.
 */

import {
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	taskNodeTypeOf,
	taskToneOf,
} from "@/canvases/taskflow";
import type {
	SkillLayer,
	SkillPlaybookRead,
} from "@/pages/graphs-detail/features/skills/types";

/** A layer's icon on the canvas — shared with the library's plans (LB35). */
export const LAYER_ICON: Record<SkillLayer, string> = {
	"graph data": "lucide/database",
	llm: "lucide/sparkles",
	"third party": "lucide/globe",
	cache: "lucide/archive",
	human: "lucide/user",
	agent: "lucide/square-function",
};

export function taskFlowFromPlan(plan: SkillPlaybookRead): TaskFlowData {
	const nodes: TaskFlowNode[] = plan.nodes.map((node, i) => ({
		id: node.id,
		type: taskNodeTypeOf(node.layer),
		data: {
			title: node.label || node.task || node.id,
			bound: node.layer,
			tone: taskToneOf(node.layer),
			icon: LAYER_ICON[node.layer] ?? "lucide/square-function",
			summary: node.source_span ?? "",
			stepKey: node.form === "human" ? "a person" : node.task,
			ordinal: i,
			rows: [
				...(node.source_plan_key
					? [{ label: "from", value: node.source_plan_key, mono: true }]
					: []),
				...Object.entries(node.args).map(([k, v]) => ({
					label: k,
					value: String(v),
					mono: true,
				})),
			],
		},
	}));

	const edges: TaskFlowEdge[] = plan.edges.map((edge, i) => ({
		id: `${edge.source}->${edge.target}:${i}`,
		source: edge.source,
		target: edge.target,
		data: {
			kind: edge.kind === "binding" ? "binding" : "require",
			description: edge.label,
		},
	}));

	return { nodes, edges };
}
