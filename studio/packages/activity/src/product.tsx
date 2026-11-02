/**
 * `activity` — the Activity product's `ProductDefinition`: what ran in a
 * Graph, what waits on a person, and the record of every act
 * (shell.md › Activity, the-agents-shell.md).
 *
 * A Graph product on the Agents shell — a rail and a workbook, with no
 * leftSection. Every rail item is a section page that opens as a tab of the
 * workbook; a run opens as a tab of its own (`?page=run:<id>`):
 *
 * | Rail | Path | Tabs or drill-in |
 * |---|---|---|
 * | Runs | `/activity/runs` | — a run opens as a tab |
 * | Approvals | `/activity/approvals` | Waiting · `alerts` |
 * | Ledger | `/activity/ledger` | Rows · `actor` · `record` · `refusals` · `export` |
 * | Schedules | `/activity/schedules[/:schedule]` | a schedule's page |
 * | Events | `/activity/events` | a change's compare, `/activity/changes/<kind>/<record>` |
 * | Inbox | `/activity/inbox` | — |
 * | Rules | `/activity/rules` | — |
 * | Channels | `/activity/channels` | — |
 *
 * It has no Home: the product lands on Runs. A tab is not a level of the
 * trail, so only a section and a drill-in carry a crumb. The page itself is
 * the app's product host, which composes every graph product's regions, so
 * the route's element is whatever the app puts in
 * `ActivityProductSlotsContext`.
 */
import type { ProductDefinition } from "@invana-studio/core";
import {
	ACTIVITY_SECTIONS,
	type ActivitySectionKey,
	ErrorPage,
	historyKey,
	type RecordHistory,
	type RecordKind,
	type Schedule,
	type ShellRouteHandle,
	scheduleKeys,
} from "@invana-studio/shell";
import { History } from "lucide-react";
import type { RouteObject } from "react-router-dom";
import { useActivityProductSlots } from "./ActivitySlots";
import { useActivityNavBadges } from "./navBadges";

function ActivityRoute() {
	const { Page } = useActivityProductSlots();
	return <Page />;
}

/** A UUID reads by its first block; a key (a plan's) is already short. */
const shortId = (id: string) =>
	/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? id.slice(0, 8) : id;

/** A section's level of the trail; its tabs and drill-in sit under it. */
function level(
	key: ActivitySectionKey,
	children: RouteObject[] = [],
): RouteObject {
	const handle: ShellRouteHandle = { crumb: ACTIVITY_SECTIONS[key].label };
	const tabs = ACTIVITY_SECTIONS[key].tabs.slice(1).map((t) => ({
		path: t.key,
	}));
	const under = [...tabs, ...children];
	return under.length
		? { path: key, handle, children: [{ index: true }, ...under] }
		: { path: key, handle };
}

/** A schedule's page: its name once read, its id until then. */
const schedule: RouteObject = {
	path: ":schedule",
	handle: {
		crumb: (p) => p.schedule && shortId(p.schedule),
		crumbTitle: (p) => p.schedule,
		crumbFrom: (p) =>
			p.username && p.graphSlug && p.schedule
				? {
						queryKey: scheduleKeys.one(
							{ username: p.username, graphSlug: p.graphSlug },
							p.schedule,
						),
						label: (data) => (data as Schedule).name,
					}
				: undefined,
	} satisfies ShellRouteHandle,
};

/** A change's compare, under Events: the record's name once read. */
const changes: RouteObject = {
	path: "changes",
	handle: { crumb: "Changes" } satisfies ShellRouteHandle,
	children: [
		{ index: true },
		{
			path: ":kind/:record",
			handle: {
				crumb: (p) => p.record && `${p.kind}:${shortId(p.record)}`,
				crumbTitle: (p) => p.record,
				crumbFrom: (p) =>
					p.username && p.graphSlug && p.kind && p.record
						? {
								queryKey: historyKey(
									{ username: p.username, graphSlug: p.graphSlug },
									p.kind as RecordKind,
									p.record,
								),
								label: (data) => (data as RecordHistory).name,
							}
						: undefined,
			} satisfies ShellRouteHandle,
		},
	],
};

const rail = (id: ActivitySectionKey) => ({
	id,
	label: ACTIVITY_SECTIONS[id].label,
	icon: ACTIVITY_SECTIONS[id].icon,
	to: id,
});

export const activity: ProductDefinition = {
	id: "activity",
	name: "Activity",
	tagline: "Runs, approvals, ledger",
	icon: History,
	scope: "graph",
	landing: "runs",
	nav: {
		groups: [
			[rail("runs"), rail("approvals"), rail("ledger")],
			[
				rail("schedules"),
				rail("events"),
				rail("inbox"),
				rail("rules"),
				rail("channels"),
			],
		],
		bottom: [],
	},
	useNavBadges: useActivityNavBadges,
	routes: [
		{
			path: "u/:username/:graphSlug/activity",
			// No crumb: the wordmark already reads `Invana Activity`.
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <ActivityRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				level("runs"),
				level("approvals"),
				level("ledger"),
				level("schedules", [schedule]),
				level("events"),
				changes,
				level("inbox"),
				level("rules"),
				level("channels"),
			],
		},
	],
};
