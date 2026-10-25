import { TabbedPanel } from "@invana/ui";
import {
	Activity,
	CalendarClock,
	History,
	Inbox,
	ListChecks,
	Radio,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
	ACTIVITY_TABS,
	type ActivityLocation,
	type ActivityTab,
	activityPath,
	runPagePath,
} from "./activityPath";
import { ComparePage } from "./changes/ComparePage";
import { EventsTab } from "./events/EventsTab";
import { InboxTab } from "./inbox/InboxTab";
import { useInbox } from "./inbox/useInbox";
import { ChannelsTab } from "./notifications/channels/ChannelsTab";
import { useRulesQuery } from "./notifications/queries";
import { RulesTab } from "./notifications/rules/RulesTab";
import { RunsBoardPage } from "./runs/RunsBoardPage";
import { SchedulePage } from "./schedules/SchedulePage";
import { SchedulesTab } from "./schedules/SchedulesTab";

export interface ActivityPageProps {
	username: string;
	graphSlug: string;
	/** The tab (and schedule, or change) the path opens. */
	location: ActivityLocation;
}

const LABELS: Record<ActivityTab, string> = {
	inbox: "Inbox",
	runs: "Runs",
	schedules: "Schedules",
	events: "Events",
	rules: "Rules",
	channels: "Channels",
};

const ICONS: Record<ActivityTab, React.ElementType> = {
	inbox: Inbox,
	runs: History,
	schedules: CalendarClock,
	events: Activity,
	rules: ListChecks,
	channels: Radio,
};

/**
 * Activity — the Graph's shared page for what ran, what was written and what
 * waits on a person, at `/u/:user/:graph/activity/<tab>[/:id]`.
 *
 * Six tabs, in a fixed order: Inbox · Runs · Schedules · Events · Rules ·
 * Channels. Each tab is a path level, so switching one navigates and the
 * breadcrumb follows. **Runs** is the journal; a row opens that run's page in
 * Agents › Runs, where every run is read. Every ask waiting on a person is
 * listed in Agents › Approvals.
 * **Inbox** is what needs a person — approvals, runs waiting on an answer,
 * and what rules and schedules told them. **Schedules** drills in like Runs:
 * `/activity/schedules/<schedule>` is that schedule's page. **Rules** and
 * **Channels** are who hears about what, and where it is sent.
 * **Events** is the Graph's writes; its Changes filter is the change log, and
 * a change's compare (`/activity/changes/<kind>/<record>`) opens inside it,
 * with the tab strip kept and Events lit.
 *
 * It is not a product: whichever product the person came from keeps its
 * wordmark and `leftNav`, and the page fills `mainSection`.
 */
export function ActivityPage({
	username,
	graphSlug,
	location,
}: ActivityPageProps) {
	const navigate = useNavigate();
	const graph = { username, graphSlug };
	const { tab, change, scheduleId } = location;
	const openRun = (id: string) => navigate(runPagePath(graph, id));
	// The Inbox and Rules tabs carry their counts; the others have none.
	const inbox = useInbox(graph);
	const rules = useRulesQuery(graph).data?.total ?? 0;
	const counts: Partial<Record<ActivityTab, number>> = {
		inbox: inbox.count,
		rules,
	};

	const body = (value: ActivityTab): ReactNode => {
		if (value === "runs") {
			return (
				<RunsBoardPage
					username={username}
					graphSlug={graphSlug}
					onOpenRun={openRun}
				/>
			);
		}
		if (value === "events") {
			return change ? (
				<ComparePage
					username={username}
					graphSlug={graphSlug}
					kind={change.kind}
					recordId={change.id}
				/>
			) : (
				<EventsTab username={username} graphSlug={graphSlug} />
			);
		}
		if (value === "inbox") return <InboxTab graph={graph} />;
		if (value === "schedules") {
			return scheduleId ? (
				<SchedulePage
					graph={graph}
					scheduleId={scheduleId}
					onDeleted={() => navigate(activityPath(graph, "schedules"))}
					onOpenRun={openRun}
				/>
			) : (
				<SchedulesTab
					graph={graph}
					onOpenSchedule={(id) =>
						navigate(activityPath(graph, "schedules", id))
					}
				/>
			);
		}
		if (value === "rules") return <RulesTab graph={graph} />;
		if (value === "channels") return <ChannelsTab graph={graph} />;
		return null;
	};

	return (
		<TabbedPanel
			className="h-full border-0"
			overflow
			activeTab={tab}
			onTabChange={(value) =>
				navigate(activityPath(graph, value as ActivityTab))
			}
			tabs={ACTIVITY_TABS.map((value) => ({
				value,
				name: LABELS[value],
				label: counts[value]
					? `${LABELS[value]} · ${counts[value]}`
					: LABELS[value],
				icon: ICONS[value],
				content: value === tab ? body(value) : null,
			}))}
		/>
	);
}
