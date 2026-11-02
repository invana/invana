/**
 * The Agents product's sections as workbook tabs (the-agents-shell.md) — the
 * shared `useSectionTabs`, with Agents' openers and section bodies. LLMs
 * drills into an endpoint in a modal, named by `?provider=`.
 *
 * A run is read in Activity, the Graph product every run page lives in: a
 * run, and a link to Runs, Approvals or Ledger, go there.
 */

import {
	type AgentsOpen,
	AgentsOpenContext,
	AgentsSectionBody,
	type AgentsSectionKey,
	firstTab,
	SECTIONS,
} from "@invana-studio/agents";
import {
	activityPath,
	type OpenBoard,
	runPagePath,
} from "@invana-studio/shell";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { useBoardPage } from "@/host/useBoardPage";
import {
	type SectionTabs,
	type SectionTabsSpec,
	useSectionTabs,
} from "@/host/useSectionTabs";

const isSection = (key: string | null): key is AgentsSectionKey =>
	!!key && key in SECTIONS;

const AGENTS_TABS: SectionTabsSpec<AgentsSectionKey> = {
	prefix: "section:",
	homeId: "agents:home",
	home: "home",
	// An Agents section's panel key is its own key.
	sectionOfPanel: (panel) => (isSection(panel) ? panel : null),
	panelOf: (key) => key,
	firstTab,
	spec: (key) => SECTIONS[key],
	detail: { section: "llms", param: "provider" },
};

interface Deps {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The Agents product is the one open. */
	enabled: boolean;
	openBoard: (board: OpenBoard) => void;
	boardPage: ReturnType<typeof useBoardPage>;
	setActiveBoardId: (id: string | null) => void;
	/** The data canvas in front, and the work canvas a page drove. */
	activeCanvasId: string | null;
	workPageId: string | null;
}

export function useAgentsSections({
	username,
	graphSlug,
	openBoard,
	...deps
}: Deps): SectionTabs & {
	openers: AgentsOpen;
	/** The LLM endpoint open in its modal, when the path names one. */
	endpointId: string | null;
} {
	const tabs = useSectionTabs(AGENTS_TABS, deps);
	const { goTo } = tabs;
	const navigate = useNavigate();

	const openers = useMemo<AgentsOpen>(
		() => ({
			agent: (id) => openBoard({ kind: "agent", subjectId: id }),
			skill: (id) => openBoard({ kind: "skill", subjectId: id }),
			func: (key) => openBoard({ kind: "function", subjectId: key }),
			// A plugin is the install's: its page is in Settings, off the Graph.
			plugin: (name) =>
				navigate(
					`/settings/plugins?page=${encodeURIComponent(`plugin:${name}`)}`,
				),
			plan: (id) => openBoard({ kind: "plan_runs", subjectId: id }),
			template: (id) => openBoard({ kind: "template", subjectId: id }),
			run: (id, stepId) => {
				if (!username || !graphSlug) return;
				const path = runPagePath({ username, graphSlug }, id);
				navigate(stepId ? `${path}&step=${encodeURIComponent(stepId)}` : path);
			},
			section: (key, tab) => {
				if (key === "runs" || key === "approvals" || key === "ledger") {
					if (!username || !graphSlug) return;
					const path = activityPath({ username, graphSlug }, key);
					navigate(tab ? `${path}/${tab}` : path);
				} else goTo(key, tab);
			},
		}),
		[openBoard, goTo, navigate, username, graphSlug],
	);

	const pages =
		username && graphSlug
			? tabs.pagesOf((key, { tab, here }) =>
					key === "home" ? null : (
						<AgentsOpenContext.Provider value={openers}>
							<AgentsSectionBody
								section={key}
								username={username}
								graphSlug={graphSlug}
								tab={tab}
								onTab={(t) => goTo(key, t)}
								detail={here ? tabs.detailId : null}
								onDetail={(id) => goTo("llms", undefined, id)}
							/>
						</AgentsOpenContext.Provider>
					),
				)
			: [];

	return { ...tabs, pages, openers, endpointId: tabs.detailId };
}
