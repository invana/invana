/**
 * Domain audit event types — wire shape mirrors the engine's `EventRead`
 * (see `engine/src/invana/events/schemas.py`).
 */

/**
 * Which kind of principal emitted the event — the engine's `ActorKind`.
 *
 * Five, not three: `agent` and `external` were missing here, and an `agent`
 * row carries a null `actor` (the actor is not a user), so every agent's
 * event read as a deleted user.
 */
export type ActorKind = "user" | "agent" | "system" | "external" | "anonymous";

export interface ActorRef {
	id: string;
	username: string;
	display_name: string;
}

export interface AuditEvent {
	id: string;
	graph_id: string | null;
	actor: ActorRef | null;
	actor_kind: ActorKind;
	/**
	 * The agent's name, on the rows where `actor` is null because the actor is
	 * not a user. From the agents table, or the event's own snapshot when the
	 * agent is gone.
	 */
	actor_name: string | null;
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
