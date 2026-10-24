/**
 * A library plan as `TaskFlowCanvas` data
 * ([the-library.md](docs/for-developers/modules/workflows/features/the-library.md)): the
 * plan's own nodes and edges, drawn the way a skill's plan and a run of it are.
 * `order` is drawn as `require` and `binding` stays `binding`. A node carries
 * no status, because nothing ran *here*: given the page's `steps`, its third
 * line is its p50, plus the one fact worth a pixel — how often it runs if not
 * every time, its failure count if above zero, its p95 if the spread is wide.
 * *Wide* and *rare* are the engine's verdicts; nothing here holds a threshold.
 */

import {
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	type TaskFlowState,
	taskNodeTypeOf,
	taskToneOf,
} from "@invana-studio/canvases";
import { formatElapsed } from "@invana-studio/core";
import { LAYER_ICON } from "../skills/taskFlowFromPlan";
import type { FlowDetail, PlanPerformance } from "./types";

type StepMeasures = PlanPerformance["steps"][number];

const ms = (v: number) => formatElapsed(Math.round(v));

function statesOf(step: StepMeasures | undefined): TaskFlowState[] {
	if (!step) return [];
	return [
		...(step.wide ? (["wide"] as const) : []),
		...(step.rare ? (["rare"] as const) : []),
	];
}

function medianLine(step: StepMeasures | undefined): string {
	if (!step || step.p50_ms == null) return "";
	const facts = [`p50 ${ms(step.p50_ms)}`];
	if (step.ran_in != null && step.ran_in < 1)
		facts.push(`runs in ${Math.round(step.ran_in * 100)}%`);
	if (step.failed > 0) facts.push(`${step.failed} failed`);
	if (step.wide && step.p95_ms != null) facts.push(`p95 ${ms(step.p95_ms)}`);
	return facts.join(" · ");
}

export function flowFromRows(
	plan: FlowDetail,
	steps?: StepMeasures[],
): TaskFlowData {
	const measured = new Map(steps?.map((s) => [s.step_key, s]));
	const nodes: TaskFlowNode[] = plan.nodes.map((node, i) => ({
		id: node.id,
		type: taskNodeTypeOf(node.layer),
		states: statesOf(measured.get(node.id)),
		data: {
			title: node.label || node.task || node.id,
			bound: node.layer,
			tone: taskToneOf(node.layer),
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

	const rare = new Set(
		nodes.filter((n) => n.states?.includes("rare")).map((n) => n.id),
	);
	const edges: TaskFlowEdge[] = plan.edges.map((edge, i) => ({
		id: `${edge.kind}:${edge.source}->${edge.target}:${i}`,
		source: edge.source,
		target: edge.target,
		data: {
			kind: edge.kind === "binding" ? "binding" : "require",
			description: edge.label,
		},
		states: rare.has(edge.source) || rare.has(edge.target) ? ["rare"] : [],
	}));

	return { nodes, edges };
}
