/**
 * Wire shapes of the inbox, notification rules, channels and approvals
 * (docs/for-developers/modules/operate/features/notifications.md ·
 * approvals.md).
 *
 * In-app is not a channel: a rule's `in_app` and a schedule's
 * `deliver_in_app` write inbox rows; channels are only what leaves Invana.
 */

export type ChannelKind = "email" | "slack" | "webhook";

export interface Channel {
	id: string;
	name: string;
	kind: ChannelKind;
	/** Masked — the credential is write-only. */
	target: string;
	ready: boolean;
	/** Why it is not ready, else empty. */
	reason: string;
	created_at: string;
}

export interface ChannelWrite {
	name: string;
	kind: ChannelKind;
	/** Email: the addresses; Slack and webhook: the URL to post to. */
	target: string;
	/** Webhook only: the HMAC signing secret. */
	secret?: string | null;
}

export interface ChannelListResponse {
	items: Channel[];
	total: number;
}

/** Matched against an event's details, e.g. `{ status: "failed" }`. */
export type RuleMatch = Record<string, unknown>;

export interface NotificationRule {
	id: string;
	name: string;
	/** Event action patterns: `run.finish`, `approval.*`. */
	events: string[];
	match: RuleMatch;
	member_ids: string[];
	roles: string[];
	/** Whoever the run or act was on behalf of. */
	requester: boolean;
	in_app: boolean;
	channel_ids: string[];
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

/** What a rule's dialog sends. Members and channels go by id or name. */
export interface NotificationRuleWrite {
	name: string;
	events: string[];
	match?: RuleMatch;
	members?: string[];
	roles?: string[];
	requester?: boolean;
	in_app?: boolean;
	channels?: string[];
	enabled?: boolean;
}

export type NotificationRuleUpdate = Partial<NotificationRuleWrite>;

export interface NotificationRuleListResponse {
	items: NotificationRule[];
	total: number;
}

type NotificationKind =
	| "event"
	| "approval"
	| "reminder"
	| "expired"
	| "delivery";

export interface Notification {
	id: string;
	kind: NotificationKind | string;
	title: string;
	body: string;
	event_id: string | null;
	rule_id: string | null;
	approval_id: string | null;
	schedule_id: string | null;
	run_id: string | null;
	target_kind: string | null;
	target_id: string | null;
	read_at: string | null;
	created_at: string;
}

export interface InboxResponse {
	items: Notification[];
	unread: number;
	/** Approvals waiting on the reader, counted until decided. */
	approvals_waiting: number;
}

type ApprovalStatus = "pending" | "approved" | "declined" | "expired";

export interface Approval {
	id: string;
	subject_kind: string;
	subject_id: string;
	run_id: string | null;
	schedule_id: string | null;
	title: string;
	/** Exactly what will be sent. */
	payload: Record<string, unknown>;
	approver_ids: string[];
	requested_by_id: string | null;
	deadline_at: string;
	reminded_at: string | null;
	status: ApprovalStatus | string;
	decided_by_id: string | null;
	decided_at: string | null;
	note: string;
	created_at: string;
	/** `access` · `budget` · `delegation` · `send` · `question` · `publish`. */
	kind?: string;
	/** The person at the root, then each agent to the one asking. */
	asked_by?: { kind: string; id?: string | null; name: string }[];
	/** One line: what is wanted. */
	wants?: string;
	/** Why it went to these approvers — `world owner`, `started the run`. */
	routed_reason?: string;
	approver_names?: string[];
	step_run_id?: string | null;
	run_number?: number | null;
	/** `run` · `always` — how a delegation was allowed. */
	scope?: string | null;
	/** The reader is a named approver and it is still pending. */
	can_decide?: boolean;
	decided_by_name?: string | null;
}

/** A page of asks, with the engine's counts for the Waiting tabs. */
export interface ApprovalPage {
	items: Approval[];
	total: number;
	next_cursor?: string | null;
	applied?: unknown;
	for_you: number;
	pending: number;
}
