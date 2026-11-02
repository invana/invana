/**
 * The body of one of Activity's own section tabs — Schedules, Events, Inbox,
 * Rules and Channels, the shell's pages, each in the shared `SectionFrame`
 * filled from `ACTIVITY_SECTIONS`. Runs, Approvals and Ledger are the agents
 * package's pages, which frame themselves; the host draws those.
 *
 * A drill-in replaces the frame, since it carries its own header and crumbs:
 * a schedule open in Schedules is that schedule's page, and a change open
 * under Events is its compare. Both are read off the path, and only while the
 * section is the one the path names — a section left open behind another
 * shows its list.
 *
 *     <ActivitySectionBody section="schedules" username="admin"
 *       graphSlug="airways" here onOpenRun={openRun} />
 */

import {
	ACTIVITY_SECTIONS,
	type ActivitySectionKey,
	activityOf,
	activityPath,
	ChannelsTab,
	ComparePage,
	EventsTab,
	InboxTab,
	RulesTab,
	SchedulePage,
	SchedulesTab,
} from "@invana-studio/shell";
import { SectionBody, SectionFrame } from "@invana-studio/ui";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** The sections whose pages are the shell's. */
export type ActivityShellSection = Exclude<
	ActivitySectionKey,
	"runs" | "approvals" | "ledger"
>;

interface ActivitySectionBodyProps {
	section: ActivityShellSection;
	username: string;
	graphSlug: string;
	/** The section is the one the path names, so its drill-in is read. */
	here: boolean;
	/** A run's page, in Activity › Runs. */
	onOpenRun: (runId: string) => void;
}

export function ActivitySectionBody({
	section,
	username,
	graphSlug,
	here,
	onOpenRun,
}: ActivitySectionBodyProps) {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const graph = { username, graphSlug };
	const location = here ? activityOf(pathname) : null;

	if (section === "schedules" && location?.scheduleId) {
		return (
			<SchedulePage
				graph={graph}
				scheduleId={location.scheduleId}
				onDeleted={() => navigate(activityPath(graph, "schedules"))}
				onOpenRun={onOpenRun}
			/>
		);
	}
	if (section === "events" && location?.change) {
		return (
			<ComparePage
				username={username}
				graphSlug={graphSlug}
				kind={location.change.kind}
				recordId={location.change.id}
			/>
		);
	}

	const body: Record<ActivityShellSection, () => ReactNode> = {
		schedules: () => (
			<SchedulesTab
				graph={graph}
				onOpenSchedule={(id) => navigate(activityPath(graph, "schedules", id))}
			/>
		),
		events: () => (
			<SectionBody>
				<EventsTab username={username} graphSlug={graphSlug} />
			</SectionBody>
		),
		inbox: () => <InboxTab graph={graph} />,
		rules: () => <RulesTab graph={graph} />,
		channels: () => <ChannelsTab graph={graph} />,
	};

	return (
		<SectionFrame {...ACTIVITY_SECTIONS[section]} tabs={[]}>
			{body[section]()}
		</SectionFrame>
	);
}
