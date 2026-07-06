// Node-expand / graph-traversal types (RFC-035) — mirrors the engine's
// FilterGroup / SortSpec DSL and the explorer expand request/response schemas.

import type { GraphData } from "./query";

export type FilterOp =
	| "eq"
	| "neq"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "in"
	| "not_in"
	| "contains"
	| "starts_with"
	| "ends_with"
	| "is_null"
	| "is_not_null";

export interface FilterExpression {
	property: string;
	op: FilterOp;
	value?: unknown;
}

export interface FilterGroup {
	operator: "and" | "or";
	conditions: (FilterExpression | FilterGroup)[];
}

export type SortDirection = "asc" | "desc";

export interface SortSpec {
	property: string;
	direction: SortDirection;
}

export type ExpandDirection = "in" | "out" | "both";

/** Shared body for every expand request. */
export interface ExpandBase {
	vertex_id: string;
	direction?: ExpandDirection;
	filters?: FilterGroup | null;
	sort?: SortSpec[];
	limit?: number;
	offset?: number;
	/** The session this expand belongs to (RFC-046) — when set, the engine logs
	 *  the expand as a turn in that session's thread. */
	session_id?: string;
}

export type ExpandNeighborsRequest = ExpandBase;

export interface ExpandByEdgeTypeRequest extends ExpandBase {
	edge_label: string;
}

export interface ExpandByNodeTypeRequest extends ExpandBase {
	neighbor_label: string;
}

export interface NeighborExpandResponse {
	data: GraphData;
	total: number;
	offset: number;
	limit: number;
	returned: number;
	has_more: boolean;
}

/** Discriminated request handed to `useExpandNode` — picks the focused endpoint. */
export type ExpandRequest =
	| { kind: "neighbors"; body: ExpandNeighborsRequest }
	| { kind: "by-edge-type"; body: ExpandByEdgeTypeRequest }
	| { kind: "by-node-type"; body: ExpandByNodeTypeRequest };

/** Stable identity for a node's expand pagination state. */
export function expandKey(req: ExpandRequest): string {
	const b = req.body;
	const edge = req.kind === "by-edge-type" ? req.body.edge_label : "";
	const node = req.kind === "by-node-type" ? req.body.neighbor_label : "";
	return `${b.vertex_id}:${b.direction ?? "both"}:${edge}:${node}`;
}
