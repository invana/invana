/**
 * Where Activity lives on a Graph: `/u/:user/:graph/activity/<tab>[/:id]`.
 *
 * The tab is a path level, so it is a crumb and survives a reload. Runs and
 * Schedules drill in — `/activity/runs/<run>` is that run's page and
 * `/activity/schedules/<schedule>` that schedule's, inside the tab. A
 * change's compare is `/activity/changes/<kind>/<record>?a=&b=`: it belongs to
 * Events, whose Changes filter lists the changes, so Events stays lit.
 */

import { RECORD_KINDS, type RecordKind } from "./changes/history";

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
	/** The schedule open in the Schedules tab. */
	scheduleId?: string | null;
	/** The record whose versions the compare page reads. */
	change?: { kind: RecordKind; id: string };
}

const ACTIVITY = /^\/u\/[^/]+\/[^/]+\/activity\/([^/]+)(?:\/([^/]+))?\/?$/;
const CHANGE = /^\/u\/[^/]+\/[^/]+\/activity\/changes\/([^/]+)\/([^/]+)\/?$/;

/** The Activity tab (and run, or change) a pathname opens, or null off Activity. */
export function activityOf(pathname: string): ActivityLocation | null {
	const c = pathname.match(CHANGE);
	if (c) {
		const kind = RECORD_KINDS.find((k) => k === c[1]);
		return kind
			? {
					tab: "events",
					runId: null,
					change: { kind, id: decodeURIComponent(c[2]) },
				}
			: null;
	}
	const m = pathname.match(ACTIVITY);
	if (!m) return null;
	const tab = ACTIVITY_TABS.find((t) => t === m[1]);
	if (!tab) return null;
	const id = m[2] ? decodeURIComponent(m[2]) : null;
	if (id && tab === "schedules") return { tab, runId: null, scheduleId: id };
	if (id && tab !== "runs") return null;
	return { tab, runId: id };
}

/** The path of an Activity tab, or of one run in Runs or schedule in Schedules. */
export function activityPath(
	graph: { username: string; graphSlug: string },
	tab: ActivityTab,
	id?: string,
): string {
	const base = `/u/${graph.username}/${graph.graphSlug}/activity/${tab}`;
	return id ? `${base}/${encodeURIComponent(id)}` : base;
}

/** The change log: Events with its Changes filter on. */
export function changesPath(graph: {
	username: string;
	graphSlug: string;
}): string {
	return `${activityPath(graph, "events")}?filter=changes`;
}

/**
 * The compare page of one record. `b` alone compares it with the version
 * before; neither opens the newest change.
 */
export function comparePath(
	graph: { username: string; graphSlug: string },
	kind: RecordKind,
	id: string,
	versions: { a?: string | null; b?: string | null } = {},
): string {
	const q = new URLSearchParams();
	if (versions.a) q.set("a", versions.a);
	if (versions.b) q.set("b", versions.b);
	const qs = q.toString();
	return `/u/${graph.username}/${graph.graphSlug}/activity/changes/${kind}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
}
