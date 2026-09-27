/**
 * A library plan as `TaskFlowCanvas` data
 * ([LB35](docs/for-developers/modules/workflows/features/the-library.md)): the
 * plan's own nodes and edges, drawn the way a skill's plan and a run of it are.
 * `order` is drawn as `require` and `binding` stays `binding`. A node carries
 * no status, because nothing ran *here*: given the page's `steps`, its third
 * line is its p50, plus the one fact worth a pixel — how often it runs if not
 * every time, its failure count if above zero, its p95 if the spread is wide.
 */

import {
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	taskNodeTypeOf,
} from "@/canvases/taskflow";
import { formatElapsed } from "@/lib/time";
import { LAYER_ICON } from "@/pages/graphs-detail/features/skills/taskFlowFromPlan";
import type { PlanPerformance, TaskPlanDetail } from "@/types/work";

type StepMeasures = PlanPerformance["steps"][number];

const ms = (v: number) => formatElapsed(Math.round(v));

/** A p95 this far over its p50 makes a step unpredictable (LB33). */
export const WIDE_SPREAD = 4;

function medianLine(step: StepMeasures | undefined): string {
	if (!step || step.p50_ms == null) return "";
	const facts = [`p50 ${ms(step.p50_ms)}`];
	if (step.ran_in != null && step.ran_in < 1)
		facts.push(`runs in ${Math.round(step.ran_in * 100)}%`);
	if (step.failed > 0) facts.push(`${step.failed} failed`);
	if (step.p95_ms != null && step.p95_ms >= WIDE_SPREAD * step.p50_ms)
		facts.push(`p95 ${ms(step.p95_ms)}`);
	return facts.join(" · ");
}

export function taskFlowFromWorkflow(
	plan: TaskPlanDetail,
	steps?: StepMeasures[],
): TaskFlowData {
	const measured = new Map(steps?.map((s) => [s.step_key, s]));
	const nodes: TaskFlowNode[] = plan.nodes.map((node, i) => ({
		id: node.id,
		type: taskNodeTypeOf(node.layer),
		data: {
			title: node.label || node.task || node.id,
			bound: node.layer,
			icon: LAYER_ICON[node.layer] ?? "lucide/square-function",
			summary: medianLine(measured.get(node.id)),
			stepKey: node.form === "human" ? "a person" : node.task,
			ordinal: i,
			rows: [
				// A **count**, never a claim: a pin lives on one agent's envelope.
				...(node.pinned_by_count > 0
					? [{ label: "pinned by", value: String(node.pinned_by_count) }]
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
		id: `${edge.kind}:${edge.source}->${edge.target}:${i}`,
		source: edge.source,
		target: edge.target,
		data: {
			kind: edge.kind === "binding" ? "binding" : "require",
			description: edge.label,
		},
	}));

	return { nodes, edges };
}
