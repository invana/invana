/**
 * The Activity product's sections as workbook tabs (shell.md › Activity) —
 * the shared `useSectionTabs`, with Activity's openers and section bodies.
 *
 * Runs, Approvals and Ledger are the agents package's pages; Schedules,
 * Events, Inbox, Rules and Channels the shell's, framed by the Activity
 * package. A run opens as the `run` record page beside them. Activity has no
 * Home: it lands on Runs, and its last open section cannot close.
 *
 * The agents pages open records through `AgentsOpenContext`; here a run opens
 * its record page, a section moves within Activity, and anything else an
 * agents page links to — an agent, a skill, a function, a plan — opens in the
 * Agents product.
 */

import {
	ActivitySectionBody,
	type ActivityShellSection,
} from "@invana-studio/activity";
import {
	type AgentsOpen,
	AgentsOpenContext,
	ApprovalsPage,
	LedgerPage,
	type RunSectionKey,
	RunsListPage,
	type SectionPageProps,
} from "@invana-studio/agents";
import {
	ACTIVITY_SECTIONS,
	type ActivitySectionKey,
	activityPanelOf,
	activitySectionOfPanel,
	boardPageId,
	type OpenBoard,
} from "@invana-studio/shell";
import { type ComponentType, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { useBoardPage } from "@/host/useBoardPage";
import {
	type SectionTabs,
	type SectionTabsSpec,
	useSectionTabs,
} from "@/host/useSectionTabs";

const ACTIVITY_TABS: SectionTabsSpec<ActivitySectionKey> = {
	prefix: "activity-section:",
	homeId: "activity:home",
	sectionOfPanel: activitySectionOfPanel,
	panelOf: activityPanelOf,
	firstTab: (key) => ACTIVITY_SECTIONS[key].tabs[0]?.key ?? null,
	spec: (key) => ACTIVITY_SECTIONS[key],
};

/** The sections whose pages are the agents package's. */
const RUN_PAGES: Record<RunSectionKey, ComponentType<SectionPageProps>> = {
	runs: RunsListPage,
	approvals: ApprovalsPage,
	ledger: LedgerPage,
};

const isRunSection = (key: string): key is RunSectionKey => key in RUN_PAGES;

interface Deps {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The Activity product is the one open. */
	enabled: boolean;
	openBoard: (board: OpenBoard) => void;
	boardPage: ReturnType<typeof useBoardPage>;
	setActiveBoardId: (id: string | null) => void;
	/** The data canvas in front, and the work canvas a page drove. */
	activeCanvasId: string | null;
	workPageId: string | null;
}

export function useActivitySections({
	username,
	graphSlug,
	openBoard,
	...deps
}: Deps): SectionTabs & { openers: AgentsOpen } {
	const tabs = useSectionTabs(ACTIVITY_TABS, deps);
	const { goTo } = tabs;
	const navigate = useNavigate();

	const openers = useMemo<AgentsOpen>(() => {
		const inAgents = (
			section: string,
			kind: Parameters<typeof boardPageId>[0],
			id: string,
		) =>
			navigate(
				`/u/${username}/${graphSlug}/agents/${section}?page=${encodeURIComponent(boardPageId(kind, id))}`,
			);
		return {
			agent: (id) => inAgents("agents", "agent", id),
			skill: (id) => inAgents("skills", "skill", id),
			func: (key) => inAgents("functions", "function", key),
			plan: (id) => inAgents("functions", "plan_runs", id),
			template: (id) => inAgents("functions", "template", id),
			plugin: (name) =>
				navigate(
					`/settings/plugins?page=${encodeURIComponent(`plugin:${name}`)}`,
				),
			run: (id, stepId) =>
				openBoard({ kind: "run", subjectId: id, runId: id, stepId }),
			section: (key, tab) =>
				isRunSection(key)
					? goTo(key, tab)
					: navigate(`/u/${username}/${graphSlug}/agents/${key}`),
		};
	}, [openBoard, goTo, navigate, username, graphSlug]);

	const pages =
		username && graphSlug
			? tabs.pagesOf((key, { tab, here }) => {
					if (isRunSection(key)) {
						const Page = RUN_PAGES[key];
						return (
							<AgentsOpenContext.Provider value={openers}>
								<Page
									username={username}
									graphSlug={graphSlug}
									tab={tab}
									onTab={(t) => goTo(key, t)}
									detail={null}
									onDetail={() => {}}
								/>
							</AgentsOpenContext.Provider>
						);
					}
					return (
						<ActivitySectionBody
							section={key as ActivityShellSection}
							username={username}
							graphSlug={graphSlug}
							here={here}
							onOpenRun={(id) => openers.run(id)}
						/>
					);
				})
			: [];

	return { ...tabs, pages, openers };
}
