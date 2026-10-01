import type { CanvasConfig } from "@invana/canvas";
import type { PreviewCardRow } from "@invana/canvas-ui";

/** The two templates the Detail switcher picks between. */
export type Detail = "circles" | "cards";

/** The three node types `settings.json` colours. */
export type TaskNodeType = "task.llm" | "task.graph_read" | "task.none";

/** The key `settings.json`'s colour lookups read — one per node type. */
export type TaskTone = "llm" | "graph_read" | "none";

export interface TaskNodeData {
	title: string;
	/** The real bound or layer, printed on a card — finer than the node's type. */
	bound: string;
	/** What colours the node — its type's key, never the raw `bound`. */
	tone: TaskTone;
	/** `lucide/<name>`. */
	icon: string;
	summary: string;
	stepKey: string;
	ordinal: number;
	/** Extra rows on the hover card. */
	rows: PreviewCardRow[];
}

export interface TaskEdgeData {
	kind: "binding" | "require" | "sequence";
	description: string;
}

/**
 * A step's emphasis, drawn by the node and edge states `settings.json`
 * declares: `wide` rings a step whose spread is wide in the kit's `--warning`
 * (`38 92% 42%`, as a number because the canvas takes numbers), `rare` dims a
 * step few runs take and the edges that reach it.
 */
export type TaskFlowState = "wide" | "rare";

export interface TaskFlowNode {
	id: string;
	type: TaskNodeType;
	data: TaskNodeData;
	states?: TaskFlowState[];
}

export interface TaskFlowEdge {
	id: string;
	source: string;
	target: string;
	data: TaskEdgeData;
	states?: TaskFlowState[];
}

export interface TaskFlowData {
	nodes: TaskFlowNode[];
	edges: TaskFlowEdge[];
}

export type TaskFlowTemplates = Record<Detail, Partial<CanvasConfig>>;

/** A bound or a layer, onto the node type that colours it. */
export function taskNodeTypeOf(bound: string | null | undefined): TaskNodeType {
	switch (bound) {
		case "llm":
			return "task.llm";
		case "graph_read":
		case "graph_write":
		case "schema_write":
		case "ingest":
		case "graph data":
			return "task.graph_read";
		default:
			return "task.none";
	}
}

/** A bound or a layer, onto the tone that colours its node. */
export function taskToneOf(bound: string | null | undefined): TaskTone {
	return taskNodeTypeOf(bound).slice("task.".length) as TaskTone;
}
