/**
 * The Activity product's sections — what its rail names, what each page holds,
 * and the tabs a section carries. One table, read by the Activity product's
 * rail, the frame each section page draws (the Runs, Approvals and Ledger
 * pages the agents package owns, and the shell's own Schedules, Events,
 * Inbox, Rules and Channels) and the workbook's tabs, so a section's name and
 * icon cannot differ between them.
 *
 * It sits in the shell because both sides read it and neither may import the
 * other: the agents package frames its pages with it, the Activity product
 * lists it.
 *
 * The keys are Activity's own. The path's `panel` key is prefixed —
 * `activity/runs` is panel `activity-runs` — so nothing collides with another
 * product's section of the same name; `activityPanelOf` and
 * `activitySectionOfPanel` are the one place the two meet.
 */

import type { ProductIcon } from "@invana-studio/core";
import {
	Activity,
	Bell,
	CalendarClock,
	ClipboardList,
	Inbox,
	ListChecks,
	Play,
	Radio,
} from "lucide-react";

export type ActivitySectionKey =
	| "runs"
	| "approvals"
	| "ledger"
	| "schedules"
	| "events"
	| "inbox"
	| "rules"
	| "channels";

export interface ActivitySectionSpec {
	label: string;
	icon: ProductIcon;
	/** One line under the page's name: what it holds. */
	description: string;
	/** The section's tabs; the first is the section's own path. */
	tabs: { key: string; label: string }[];
}

export const ACTIVITY_SECTIONS: Record<
	ActivitySectionKey,
	ActivitySectionSpec
> = {
	runs: {
		label: "Runs",
		icon: Play,
		description:
			"Every run in this Graph — the numbers are the engine's, stored when each run settles",
		tabs: [],
	},
	approvals: {
		label: "Approvals",
		icon: Inbox,
		description:
			"Every ask waiting on a person — access, budget, delegation, sends, questions — routed to whoever owns the thing asked for. Access granted shows in IAM",
		tabs: [
			{ key: "waiting", label: "Waiting" },
			{ key: "alerts", label: "Alert rules" },
		],
	},
	ledger: {
		label: "Ledger",
		icon: ClipboardList,
		description:
			"Every act by a person or an agent — who, through which agents, what it touched, allowed or refused",
		tabs: [
			{ key: "rows", label: "Rows" },
			{ key: "actor", label: "By actor" },
			{ key: "record", label: "By record" },
			{ key: "refusals", label: "Refusals" },
			{ key: "export", label: "Export" },
		],
	},
	schedules: {
		label: "Schedules",
		icon: CalendarClock,
		description:
			"Agents that run on a clock — what fires in the coming week, and every schedule's firings",
		tabs: [],
	},
	events: {
		label: "Events",
		icon: Activity,
		description:
			"Every write to this Graph — its Changes filter is the change log, each change compared with the version before",
		tabs: [],
	},
	inbox: {
		label: "Inbox",
		icon: Bell,
		description:
			"What needs you — approvals, runs waiting on an answer, and what rules and schedules told you",
		tabs: [],
	},
	rules: {
		label: "Rules",
		icon: ListChecks,
		description:
			"Who hears about what — each rule matches events and delivers through its channels",
		tabs: [],
	},
	channels: {
		label: "Channels",
		icon: Radio,
		description:
			"Where notifications go — In app, and each email, Slack or webhook channel",
		tabs: [],
	},
};

const PANEL_PREFIX = "activity-";

/** The path's `panel` key for a section: `runs` → `activity-runs`. */
export const activityPanelOf = (key: ActivitySectionKey): string =>
	`${PANEL_PREFIX}${key}`;

/** The section a `panel` key names, or null when it is not Activity's. */
export function activitySectionOfPanel(
	panel: string | null,
): ActivitySectionKey | null {
	if (!panel?.startsWith(PANEL_PREFIX)) return null;
	const key = panel.slice(PANEL_PREFIX.length);
	return Object.hasOwn(ACTIVITY_SECTIONS, key)
		? (key as ActivitySectionKey)
		: null;
}
