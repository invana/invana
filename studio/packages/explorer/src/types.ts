// Node-expand / graph-traversal types (docs/for-developers/modules/explore/features/graph-canvas.md) — mirrors the engine's
// FilterGroup / SortSpec DSL and the explorer expand request/response schemas.

import type { GraphData } from "@invana-studio/core";

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
interface ExpandBase {
	vertex_id: string;
	direction?: ExpandDirection;
	filters?: FilterGroup | null;
	sort?: SortSpec[];
	limit?: number;
	offset?: number;
	/** The session this expand belongs to (docs/for-developers/modules/explore/features/boards.md) — when set, the engine logs
	 *  the expand as a turn in that session's thread. */
	session_id?: string;
	/** The world the canvas has picked, exactly as an ask's `lens_id` — the
	 *  expansion runs under it (graph-canvas.md). */
	lens_id?: string;
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
	/** The `expand-neighbours@1` run this answer came from. */
	run_id?: string | null;
}

/**
 * What `explorer.shareAnswer` is handed: one settled answer, where it lives,
 * and the words it was asked and answered in.
 */
export interface ShareAnswerArgs {
	username: string;
	graphSlug: string;
	/** The thread the answer is in — the live link opens it. */
	sessionId: string;
	/** The reply's own message, kept on a snapshot as the answer it froze. */
	messageId: string;
	/** The run behind the answer — its emissions, and the snapshot's subject. */
	runId: string;
	/** What was asked, as typed. */
	question: string;
	/** The reply's sentence. */
	answer: string;
	/** The world the run was frozen in, named as it was; absent is Everything. */
	worldName?: string;
}

/** One dataset version the Graph has bound — `publisher/name@v`, into a type. */
export interface BoundDataset {
	address: string;
	typeName: string;
	modelName: string | null;
}

/** Discriminated request handed to `useExpandNode` — picks the focused endpoint. */
export type ExpandRequest =
	| { kind: "neighbors"; body: ExpandNeighborsRequest }
	| { kind: "by-edge-type"; body: ExpandByEdgeTypeRequest }
	| { kind: "by-node-type"; body: ExpandByNodeTypeRequest };

/** What *Schedule this* hands `explorer.scheduleQuestion`. */
export interface ScheduleQuestionArgs {
	username: string;
	graphSlug: string;
	question: string;
}
