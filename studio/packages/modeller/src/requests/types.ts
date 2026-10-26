/**
 * Requests — what analysts and agents asked to be modelled or allowed.
 *
 * The engine files a request where an ask fails (a guardrail refusal, an ask
 * the Graph could not answer) or when someone asks for a change; Studio reads
 * and resolves them. Shapes follow the engine's requests schemas.
 */

export type RequestKind = "guardrail" | "unanswered" | "change";

export type RequestSource = "explorer" | "agent" | "schedule" | "api";

export type RequestStatus = "open" | "done";

export type RequestResolution = "declined" | "allowed" | "modelled";

export type RequestAction = "decline" | "allow" | "model";

export interface ModelRequest {
	id: string;
	kind: RequestKind;
	/** The ask as asked. */
	title: string;
	/** What the run said. */
	detail: string | null;
	source: RequestSource;
	asked_by_id: string | null;
	/** The person's name, when a person asked. */
	asked_by: string | null;
	agent_id: string | null;
	/** The agent's name, when an agent asked. */
	agent: string | null;
	run_id: string | null;
	session_id: string | null;
	guardrail_id: string | null;
	/** The guardrail's name, frozen at filing. */
	blocked_by: string | null;
	/** How many times this open ask was asked. */
	asks: number;
	last_asked_at: string;
	status: RequestStatus;
	/** What resolving did — `allowed in EU · H1 2026`. */
	resolution_note: string | null;
	world: { id: string; name: string } | null;
	model: { id: string; name: string } | null;
	resolved_by: string | null;
	resolved_at: string | null;
	created_at: string;
}

export interface RequestPage {
	items: ModelRequest[];
	total: number;
	next_cursor?: string | null;
	/** The open count the rail badge reads — the engine's, never a row count. */
	open: number;
	/** Whether the reader holds the `modeller` role. */
	may_resolve?: boolean;
}

export interface RequestResolve {
	action: RequestAction;
	world_id?: string;
	model_id?: string;
	note?: string;
}
