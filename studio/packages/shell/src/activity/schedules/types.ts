/**
 * Wire shapes of a Graph's schedules and their firings
 * (docs/for-developers/modules/operate/features/schedules.md).
 *
 * A schedule names an agent and plain instructions, a 5-field cron read in an
 * IANA zone, and where what it finds is delivered. Every firing is recorded,
 * skips and failures included, with the reason.
 */

export type MissedPolicy = "catch_up" | "run_all" | "skip";
export type OverlapPolicy = "skip" | "allow";
type ScheduleStatus = "active" | "paused";
export type FiringOutcome = "queued" | "opened" | "skipped" | "failed";

export interface Schedule {
	id: string;
	graph_id: string;
	name: string;
	agent_id: string | null;
	instructions: string;
	cron: string;
	timezone: string;
	status: ScheduleStatus;
	missed: MissedPolicy;
	overlap: OverlapPolicy;
	deliver_in_app: boolean;
	recipient_ids: string[];
	channel_ids: string[];
	approve_outward: boolean;
	approver_ids: string[];
	approval_deadline_s: number;
	next_fire_at: string | null;
	owner_id: string | null;
	created_at: string;
	updated_at: string;
}

/** What New schedule sends. Members and channels go by id or name. */
export interface ScheduleWrite {
	name: string;
	/** The agent's key or id. */
	agent: string;
	instructions: string;
	cron: string;
	timezone?: string;
	missed?: MissedPolicy;
	overlap?: OverlapPolicy;
	deliver_in_app?: boolean;
	recipients?: string[];
	channels?: string[];
	approve_outward?: boolean;
	approvers?: string[];
	approval_deadline_s?: number;
}

export type ScheduleUpdate = Partial<ScheduleWrite>;

export interface ScheduleListResponse {
	items: Schedule[];
	total: number;
}

export interface Firing {
	id: string;
	schedule_id: string;
	due_at: string;
	fired_at: string | null;
	outcome: FiringOutcome;
	catch_up: boolean;
	/** Run now, rather than the cron. */
	manual: boolean;
	run_id: string | null;
	reason: string;
	delivered_at: string | null;
}

export interface FiringListResponse {
	items: Firing[];
	total: number;
}
