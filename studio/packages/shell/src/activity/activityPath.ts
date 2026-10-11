/**
 * Where Activity lives on a Graph: `/u/:user/:graph/activity/<tab>[/:id]`.
 *
 * The tab is a path level, so it is a crumb and survives a reload. Only Runs
 * drills in — `/activity/runs/<run>` is that run's page, inside the tab.
 */

export const ACTIVITY_TABS = [
	"inbox",
	"approvals",
	"runs",
	"schedules",
	"events",
	"rules",
	"channels",
] as const;

export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export interface ActivityLocation {
	tab: ActivityTab;
	/** The run open in the Runs tab, or null for the journal. */
	runId: string | null;
}

const ACTIVITY = /^\/u\/[^/]+\/[^/]+\/activity\/([^/]+)(?:\/([^/]+))?\/?$/;

/** The Activity tab (and run) a pathname opens, or null off Activity. */
export function activityOf(pathname: string): ActivityLocation | null {
	const m = pathname.match(ACTIVITY);
	if (!m) return null;
	const tab = ACTIVITY_TABS.find((t) => t === m[1]);
	if (!tab) return null;
	if (m[2] && tab !== "runs") return null;
	return { tab, runId: m[2] ? decodeURIComponent(m[2]) : null };
}

/** The path of an Activity tab, or of one run in Runs. */
export function activityPath(
	graph: { username: string; graphSlug: string },
	tab: ActivityTab,
	runId?: string,
): string {
	const base = `/u/${graph.username}/${graph.graphSlug}/activity/${tab}`;
	return runId ? `${base}/${encodeURIComponent(runId)}` : base;
}
