/**
 * Domain audit event types — wire shape mirrors the engine's `EventRead`
 * (see `engine/src/invana/events/schemas.py`).
 */

export type ActorType = "user" | "system" | "anonymous";

export interface ActorRef {
	id: string;
	username: string;
	display_name: string;
}

export interface AuditEvent {
	id: string;
	graph_id: string | null;
	actor: ActorRef | null;
	actor_type: ActorType;
	action: string;
	target_kind: string | null;
	target_id: string | null;
	details: Record<string, unknown>;
	trace_id: string | null;
	created_at: string;
}

export interface EventListResponse {
	items: AuditEvent[];
	next_cursor: string | null;
}

export interface EventListFilters {
	cursor?: string;
	page_size?: number;
	graph_id?: string; // global endpoint only
	actor_id?: string;
	action_prefix?: string;
	/** Exact event-type set from the multi-select; serialized as repeated `action` params. */
	actions?: string[];
	since?: string;
	until?: string;
}

/** SSE frame payload (matches `iter_frames` in engine/src/invana/events/notify.py). */
export interface EventStreamFrame {
	id: string;
	graph_id: string | null;
	created_at: string;
}
