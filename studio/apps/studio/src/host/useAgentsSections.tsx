/**
 * The Agents product's sections as workbook tabs (the-agents-shell.md) — the
 * shared `useSectionTabs`, with Agents' openers and section bodies. LLMs
 * drills into an endpoint in a modal, named by `?provider=`.
 */

import {
	type AgentsOpen,
	AgentsOpenContext,
	AgentsSectionBody,
	type AgentsSectionKey,
	firstTab,
	SECTIONS,
} from "@invana-studio/agents";
import type { OpenBoard } from "@invana-studio/shell";
import { useMemo } from "react";
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

	const openers = useMemo<AgentsOpen>(
		() => ({
			agent: (id) => openBoard({ kind: "agent", subjectId: id }),
			skill: (id) => openBoard({ kind: "skill", subjectId: id }),
			func: (key) => openBoard({ kind: "function", subjectId: key }),
			plugin: (name) => openBoard({ kind: "plugin", subjectId: name }),
			plan: (id) => openBoard({ kind: "plan_runs", subjectId: id }),
			template: (id) => openBoard({ kind: "template", subjectId: id }),
			pool: (name) => openBoard({ kind: "worker_pool", subjectId: name }),
			worker: (name) => openBoard({ kind: "worker", subjectId: name }),
			run: (id, stepId) =>
				openBoard({ kind: "run", subjectId: id, runId: id, stepId }),
			section: (key, tab) => goTo(key, tab),
		}),
		[openBoard, goTo],
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
