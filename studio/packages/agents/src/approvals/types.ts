/**
 * Alert rules as the engine returns them (docs/for-developers/modules/operate/features/approvals.md).
 * Asks themselves are the shell's `Approval`.
 */

interface AlertMatch {
	act: string;
	touched: string;
	verdict: string[];
	refused_by: string[];
	threshold: { count: number; window_s: number } | null;
}

export interface AlertRule {
	id: string;
	name: string;
	enabled: boolean;
	match: AlertMatch;
	/** The match in one line — `graph.write.* on Fare · allowed`. */
	match_line: string;
	notify_user_ids: string[];
	/** Who it notifies, by username. */
	notify_line: string;
	last_fired_at: string | null;
	created_at: string;
}

export interface AlertRuleCreate {
	name: string;
	enabled?: boolean;
	match: Partial<AlertMatch>;
	notify_user_ids: string[];
}

export type AlertRuleUpdate = Partial<AlertRuleCreate>;

/** The Waiting tab's view — its `?f.view=`. */
export type ApprovalsView = "for_you" | "all" | "answered";
