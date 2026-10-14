import { EmptyState, EmptyStateLock, TabbedPanel } from "@invana/ui";
import {
	Activity,
	CalendarClock,
	History,
	Inbox,
	ListChecks,
	Lock,
	Radio,
	ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
	ACTIVITY_TABS,
	type ActivityLocation,
	type ActivityTab,
	activityPath,
} from "./activityPath";
import { ComparePage } from "./changes/ComparePage";
import { EventsTab } from "./events/EventsTab";
import { InboxTab } from "./inbox/InboxTab";
import { useInbox } from "./inbox/useInbox";
import { ChannelsTab } from "./notifications/channels/ChannelsTab";
import { useRulesQuery } from "./notifications/queries";
import { RulesTab } from "./notifications/rules/RulesTab";
import { RunBoardPage } from "./runs/boards/RunBoardPage";
import { useRunStep } from "./runs/boards/useRunStep";
import { RunsBoardPage } from "./runs/RunsBoardPage";
import { SchedulePage } from "./schedules/SchedulePage";
import { SchedulesTab } from "./schedules/SchedulesTab";

export interface ActivityPageProps {
	username: string;
	graphSlug: string;
	/** The tab and run the path opens. */
	location: ActivityLocation;
	/** `Retune` on a run page — Govern opens on the Graph. */
	onRetune?: () => void;
	/** `Compare` on a run page, once the second run is picked. */
	onCompare?: (runId: string, otherRunId: string) => void;
}

const LABELS: Record<ActivityTab, string> = {
	inbox: "Inbox",
	approvals: "Approvals",
	runs: "Runs",
	schedules: "Schedules",
	events: "Events",
	rules: "Rules",
	channels: "Channels",
};

const ICONS: Record<ActivityTab, React.ElementType> = {
	inbox: Inbox,
	approvals: ShieldCheck,
	runs: History,
	schedules: CalendarClock,
	events: Activity,
	rules: ListChecks,
	channels: Radio,
};

/** What a tab with no list of its own yet says, and where to look. */
const NOT_YET: Partial<
	Record<ActivityTab, { title: string; description: string; locks: string[] }>
> = {
	approvals: {
		title: "Approvals are reviewed from the Inbox",
		description:
			"Anything a schedule would send outside Invana waits for an approver, showing exactly what it will send. The approvals waiting on you sit at the top of the Inbox, each with Review.",
		locks: ["A list of every approval opens in a later release"],
	},
};

/**
 * Activity — the Graph's shared page for what ran, what was written and what
 * waits on a person, at `/u/:user/:graph/activity/<tab>[/:id]`.
 *
 * Seven tabs, in a fixed order: Inbox · Approvals · Runs · Schedules · Events
 * · Rules · Channels. Each tab is a path level, so switching one navigates and
 * the breadcrumb follows. **Runs** is the journal; a row opens that run's page
 * at `/activity/runs/<run>`, its step riding in `&step=`. The run page owns
 * `mainSection` — the tab strip steps aside and the breadcrumb
 * (`Activity › Runs › run:…`) is the way back up.
 * **Inbox** is what needs a person — approvals, runs waiting on an answer,
 * and what rules and schedules told them. **Schedules** drills in like Runs:
 * `/activity/schedules/<schedule>` is that schedule's page. **Rules** and
 * **Channels** are who hears about what, and where it is sent.
 * **Events** is the Graph's writes; its Changes filter is the change log, and
 * a change's compare (`/activity/changes/<kind>/<record>`) opens inside it,
 * with the tab strip kept and Events lit.
 * Approvals, whose own list is not built yet, draws the kit's `EmptyState`
 * pointing at the Inbox — never an empty table.
 *
 * It is not a product: whichever product the person came from keeps its
 * wordmark and `leftNav`, and the page fills `mainSection`. Run pages read
 * through `ActivitySlotsContext`, so the host provides it.
 */
export function ActivityPage({
	username,
	graphSlug,
	location,
	onRetune,
	onCompare,
}: ActivityPageProps) {
	const navigate = useNavigate();
	const { stepId, openStep } = useRunStep();
	const graph = { username, graphSlug };
	const { tab, runId, change, scheduleId } = location;
	// The Inbox and Rules tabs carry their counts; the others have none.
	const inbox = useInbox(graph);
	const rules = useRulesQuery(graph).data?.total ?? 0;
	const counts: Partial<Record<ActivityTab, number>> = {
		inbox: inbox.count,
		rules,
	};

	const body = (value: ActivityTab): ReactNode => {
		if (value === "runs") {
			return runId ? (
				<RunBoardPage
					username={username}
					graphSlug={graphSlug}
					runId={runId}
					stepId={stepId}
					onOpenStep={openStep}
					onRetune={onRetune}
					onCompare={onCompare ? (other) => onCompare(runId, other) : undefined}
					onOpenRun={(id) => navigate(activityPath(graph, "runs", id))}
				/>
			) : (
				<RunsBoardPage
					username={username}
					graphSlug={graphSlug}
					onOpenRun={(id) => navigate(activityPath(graph, "runs", id))}
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
					onOpenRun={(id) => navigate(activityPath(graph, "runs", id))}
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
		const empty = NOT_YET[value];
		return empty ? (
			<EmptyState
				className="h-full"
				icon={<ActivityIcon tab={value} />}
				title={empty.title}
				description={empty.description}
				locks={empty.locks.map((lock) => (
					<EmptyStateLock key={lock} icon={<Lock />}>
						{lock}
					</EmptyStateLock>
				))}
			/>
		) : null;
	};

	// A run page has its own tabs; two strips stacked would read as one page
	// nested in another.
	if (tab === "runs" && runId) return body("runs");

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

function ActivityIcon({ tab }: { tab: ActivityTab }) {
	const Icon = ICONS[tab];
	return <Icon className="size-6" />;
}
