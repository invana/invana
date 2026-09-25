import type { CanvasConfig } from "@invana/canvas";
import type { PreviewCardRow } from "@invana/canvas-ui";

/** The two templates the Detail switcher picks between (TF4). */
export type Detail = "circles" | "cards";

/** The three node types `settings.json` colours (TF6). */
export type TaskNodeType = "task.llm" | "task.graph_read" | "task.none";

export interface TaskNodeData {
	title: string;
	/** The real bound or layer, printed on a card — finer than the node's type. */
	bound: string;
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

export interface TaskFlowNode {
	id: string;
	type: TaskNodeType;
	data: TaskNodeData;
}

export interface TaskFlowEdge {
	id: string;
	source: string;
	target: string;
	data: TaskEdgeData;
}

export interface TaskFlowData {
	nodes: TaskFlowNode[];
	edges: TaskFlowEdge[];
}

export type TaskFlowTemplates = Record<Detail, Partial<CanvasConfig>>;

/** A bound or a layer, onto the node type that colours it (TF6). */
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
