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
import { RunBoardPage } from "./runs/boards/RunBoardPage";
import { useRunStep } from "./runs/boards/useRunStep";
import { RunsBoardPage } from "./runs/RunsBoardPage";

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

/** What a tab with no engine records yet says, and what unlocks it. */
const NOT_YET: Partial<
	Record<ActivityTab, { title: string; description: string; locks: string[] }>
> = {
	approvals: {
		title: "No approvals yet",
		description:
			"Anything a run would send outside Invana waits here, showing exactly what it will send, until an approver says yes or no. A run waiting on a person's answer shows in the Inbox.",
		locks: ["Opens when schedules can send outside Invana"],
	},
	schedules: {
		title: "No schedules yet",
		description:
			"A schedule runs an agent's instructions or a skill on a cron and delivers what it finds to a channel. It needs no project.",
		locks: ["Opens when the engine runs schedules"],
	},
	rules: {
		title: "No rules yet",
		description:
			"A rule says which events reach whom, and on which channel — a failed run, a slower agent, a change to a model.",
		locks: ["Opens when the engine records notifications"],
	},
	channels: {
		title: "No channels yet",
		description:
			"In app, email, Slack and webhook. Rules and schedules deliver through them.",
		locks: ["Opens when the engine records notifications"],
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
 * **Inbox** is what needs a person — runs waiting on an answer and recent
 * failures, until the engine records notifications.
 * **Events** is the Graph's writes; its Changes filter is the change log, and
 * a change's compare (`/activity/changes/<kind>/<record>`) opens inside it,
 * with the tab strip kept and Events lit.
 * A tab whose records the engine does not
 * keep yet draws the kit's `EmptyState`, with one lock per thing that opens
 * it — never an empty table.
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
	const { tab, runId, change } = location;
	// The Inbox tab carries its count; the other tabs have no source for one yet.
	const inbox = useInbox(graph);

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
				label:
					value === "inbox" && inbox.items.length
						? `${LABELS.inbox} · ${inbox.items.length}`
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
