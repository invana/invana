/**
 * A skill's plan as `TaskFlowCanvas` data: the plan's own nodes and
 * edges. `order` is drawn as `require` — the canvas's word for *must settle
 * first* — and `binding` stays `binding`.
 *
 * Handlers — the lines under `## When things go wrong` — are drawn beside the
 * step they guard, joined by a `binding` edge; a handler that names no step
 * hangs off the plan's last step. `lineOf` says where a span reads in the text
 * on screen, so each node can say which line it came from.
 */

import {
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	taskNodeTypeOf,
	taskToneOf,
} from "@invana-studio/canvases";
import type { SkillLayer, SkillPlaybookRead } from "./types";

/** A layer's icon on the canvas — shared with the library's plans. */
export const LAYER_ICON: Record<SkillLayer, string> = {
	"graph data": "lucide/database",
	llm: "lucide/sparkles",
	"third party": "lucide/globe",
	cache: "lucide/archive",
	human: "lucide/user",
	agent: "lucide/square-function",
};

/** A handler's node id, by its place under `## When things go wrong`. */
export const handlerNodeId = (i: number) => `handler:${i}`;

/** One handler row as the plan carries it. */
export interface PlanHandler {
	span: string;
	step_id: string | null;
}

/** The step a handler guards: the one it names, else the plan's last step. */
export function guardedStep(
	plan: SkillPlaybookRead,
	handler: PlanHandler,
): string | null {
	if (handler.step_id && plan.nodes.some((n) => n.id === handler.step_id))
		return handler.step_id;
	return plan.nodes.at(-1)?.id ?? null;
}

const fromLine = (n: number | null) => (n ? `from line ${n}` : "no line");

export function taskFlowFromPlan(
	plan: SkillPlaybookRead,
	handlers: PlanHandler[] = [],
	lineOf: (span: string | null) => number | null = () => null,
): TaskFlowData {
	const nodes: TaskFlowNode[] = plan.nodes.map((node, i) => ({
		id: node.id,
		type: taskNodeTypeOf(node.layer),
		data: {
			title: node.task || node.label || node.id,
			bound: node.layer,
			tone: taskToneOf(node.layer),
			icon: LAYER_ICON[node.layer] ?? "lucide/square-function",
			summary: node.source_span ?? "",
			stepKey: node.form === "human" ? "a person" : node.task,
			ordinal: i,
			rows: [
				{
					label: "step",
					value: `${i + 1} · ${fromLine(lineOf(node.source_span))}`,
				},
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

	// A plan with no edges is its steps in order, drawn as a sequence.
	const sequence: TaskFlowEdge[] = plan.edges.length
		? []
		: plan.nodes.slice(1).map((node, i) => ({
				id: `${plan.nodes[i].id}->${node.id}:seq`,
				source: plan.nodes[i].id,
				target: node.id,
				data: { kind: "sequence", description: "" },
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
	edges.push(...sequence);

	handlers.forEach((h, i) => {
		const id = handlerNodeId(i);
		nodes.push({
			id,
			type: "task.none",
			data: {
				title: h.span,
				bound: "handler",
				tone: "none",
				icon: "lucide/shield-alert",
				summary: h.span,
				stepKey: "handler",
				ordinal: plan.nodes.length + i,
				rows: [{ label: "handler", value: fromLine(lineOf(h.span)) }],
			},
		});
		const guarded = guardedStep(plan, h);
		if (guarded)
			edges.push({
				id: `${guarded}->${id}`,
				source: guarded,
				target: id,
				data: { kind: "binding", description: "when it goes wrong" },
			});
	});

	return { nodes, edges };
}
