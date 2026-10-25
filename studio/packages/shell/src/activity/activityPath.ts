/**
 * Where Activity lives on a Graph: `/u/:user/:graph/activity/<tab>[/:id]`.
 *
 * The tab is a path level, so it is a crumb and survives a reload. Schedules
 * drills in — `/activity/schedules/<schedule>` is that schedule's page, inside
 * the tab. A run is read on its page in Agents (`runPagePath`). A
 * change's compare is `/activity/changes/<kind>/<record>?a=&b=`: it belongs to
 * Events, whose Changes filter lists the changes, so Events stays lit.
 */

import { RECORD_KINDS, type RecordKind } from "./changes/history";

export const ACTIVITY_TABS = [
	"inbox",
	"runs",
	"schedules",
	"events",
	"rules",
	"channels",
] as const;

export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export interface ActivityLocation {
	tab: ActivityTab;
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
					change: { kind, id: decodeURIComponent(c[2]) },
				}
			: null;
	}
	const m = pathname.match(ACTIVITY);
	if (!m) return null;
	const tab = ACTIVITY_TABS.find((t) => t === m[1]);
	if (!tab) return null;
	const id = m[2] ? decodeURIComponent(m[2]) : null;
	if (id && tab === "schedules") return { tab, scheduleId: id };
	if (id) return null;
	return { tab };
}

/** The path of an Activity tab, or of one schedule in Schedules. */
export function activityPath(
	graph: { username: string; graphSlug: string },
	tab: ActivityTab,
	id?: string,
): string {
	const base = `/u/${graph.username}/${graph.graphSlug}/activity/${tab}`;
	return id ? `${base}/${encodeURIComponent(id)}` : base;
}

/**
 * A run's page: Agents › Runs with the run open as a workbook tab. Every run is
 * read there, whichever product listed it.
 */
export function runPagePath(
	graph: { username: string; graphSlug: string },
	runId: string,
): string {
	const page = encodeURIComponent(`run:${runId}`);
	return `/u/${graph.username}/${graph.graphSlug}/agents/runs?page=${page}`;
}

/** Every ask waiting on a person: Agents › Approvals. */
export function approvalsPath(graph: {
	username: string;
	graphSlug: string;
}): string {
	return `/u/${graph.username}/${graph.graphSlug}/agents/approvals`;
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
