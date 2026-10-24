/**
 * A skill's plan as `TaskFlowCanvas` data: the plan's own nodes and
 * edges. `order` is drawn as `require` — the canvas's word for *must settle
 * first* — and `binding` stays `binding`.
 *
 * Every node is a card: a **step** reads `step N · from line N` and its bound
 * — the catalogue's, through `boundOf`, else the step's layer;
 * a **handler** — a line under `## When things go wrong` — reads
 * `handler · from line N` and hangs off the step it guards (the plan's last
 * step when it names none); a **gap** — a line the draw could not map —
 * reads `line N · "…"` and hangs off the step written just before it, one
 * card per line. Both side cards join by a `binding` edge, so the layout puts
 * them beside the spine of steps.
 *
 * The steps are one chain in plan order: the plan's own edges, and a
 * `sequence` edge between any two neighbours it leaves apart — where one
 * inlined plan ends and the next begins, or around a person's step. `kind` on a node's data is what the card's outline reads.
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

/** A gap's node id, by its place in the draw's unmapped lines. */
export const gapNodeId = (i: number) => `gap:${i}`;

/** One handler row as the plan carries it. */
export interface PlanHandler {
	span: string;
	step_id: string | null;
}

/** What a card on the skill's Flow is — the outline its template draws. */
type FlowCardKind = "step" | "handler" | "gap";

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

/** The step written last before `line` — else the first step. */
function stepBefore(
	plan: SkillPlaybookRead,
	line: number | null,
	lineOf: (span: string | null) => number | null,
): string | null {
	let at: string | null = plan.nodes[0]?.id ?? null;
	if (line == null) return plan.nodes.at(-1)?.id ?? null;
	for (const node of plan.nodes) {
		const l = lineOf(node.source_span);
		if (l != null && l <= line) at = node.id;
	}
	return at;
}

export function taskFlowFromPlan(
	plan: SkillPlaybookRead,
	handlers: PlanHandler[] = [],
	lineOf: (span: string | null) => number | null = () => null,
	unmapped: string[] = [],
	boundOf: (task: string) => string | null | undefined = () => null,
): TaskFlowData {
	const nodes: TaskFlowNode[] = plan.nodes.map((node, i) => {
		const line = lineOf(node.source_span);
		const bound = (node.task && boundOf(node.task)) || node.layer;
		const data = {
			title: node.task || node.label || node.id,
			bound,
			tone: taskToneOf(bound),
			icon: LAYER_ICON[node.layer] ?? "lucide/square-function",
			summary: node.source_span ?? "",
			stepKey: node.form === "human" ? "a person" : node.task,
			ordinal: i,
			kind: "step" as FlowCardKind,
			caption: `step ${i + 1} · ${fromLine(line)}`,
			/** A step's card draws its bound beside a swatch; a side card does not. */
			swatch: true,
			rows: [
				{ label: "step", value: `${i + 1} · ${fromLine(line)}` },
				...(node.source_plan_key
					? [{ label: "from", value: node.source_plan_key, mono: true }]
					: []),
				...Object.entries(node.args).map(([k, v]) => ({
					label: k,
					value: String(v),
					mono: true,
				})),
			],
		};
		return { id: node.id, type: taskNodeTypeOf(bound), data };
	});

	const edges: TaskFlowEdge[] = plan.edges.map((edge, i) => ({
		id: `${edge.source}->${edge.target}:${i}`,
		source: edge.source,
		target: edge.target,
		data: {
			kind: edge.kind === "binding" ? "binding" : "require",
			description: edge.label,
		},
	}));
	// Every step follows the one written before it: two neighbours the plan
	// does not join — the seam between two inlined plans, a person's step —
	// are joined in order, so the flow reads as one chain.
	const joined = new Set(
		plan.edges.flatMap((e) => [
			`${e.source}>${e.target}`,
			`${e.target}>${e.source}`,
		]),
	);
	plan.nodes.slice(1).forEach((node, i) => {
		const prev = plan.nodes[i].id;
		if (joined.has(`${prev}>${node.id}`)) return;
		edges.push({
			id: `${prev}->${node.id}:seq`,
			source: prev,
			target: node.id,
			data: { kind: "sequence", description: "" },
		});
	});

	const aside = (
		id: string,
		kind: FlowCardKind,
		title: string,
		caption: string,
		ordinal: number,
		from: string | null,
		description: string,
	) => {
		const data = {
			title,
			bound: kind,
			tone: "none" as const,
			icon: kind === "gap" ? "lucide/circle-help" : "lucide/shield-alert",
			summary: title,
			stepKey: kind,
			ordinal,
			kind,
			caption,
			rows: [{ label: kind, value: caption }],
		};
		nodes.push({ id, type: "task.none", data });
		if (from)
			edges.push({
				id: `${from}->${id}`,
				source: from,
				target: id,
				data: { kind: "binding", description },
			});
	};

	handlers.forEach((h, i) => {
		aside(
			handlerNodeId(i),
			"handler",
			h.span,
			`handler · ${fromLine(lineOf(h.span))}`,
			plan.nodes.length + i,
			guardedStep(plan, h),
			"when it goes wrong",
		);
	});
	[...new Set(unmapped)].forEach((span, i) => {
		const line = lineOf(span);
		aside(
			gapNodeId(i),
			"gap",
			"? no function",
			`${line ? `line ${line}` : "no line"} · “${span}”`,
			plan.nodes.length + handlers.length + i,
			stepBefore(plan, line, lineOf),
			"no function this skill may use does this",
		);
	});

	return { nodes, edges };
}
