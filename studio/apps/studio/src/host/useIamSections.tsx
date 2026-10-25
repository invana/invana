/**
 * The IAM product's sections as workbook tabs (the-iam-product.md) — the
 * shared `useSectionTabs`, with IAM's openers and section bodies. A policy,
 * an agent's access and a group open as declared pages; an agent's builder
 * page opens in Agents.
 */

import {
	SECTIONS as IAM_SECTIONS,
	type IamOpen,
	IamOpenContext,
	IamSectionBody,
	type IamSectionKey,
	panelOf,
	sectionOfPanel,
} from "@invana-studio/iam";
import { boardPageId, type OpenBoard } from "@invana-studio/shell";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { useBoardPage } from "@/host/useBoardPage";
import {
	type SectionTabs,
	type SectionTabsSpec,
	useSectionTabs,
} from "@/host/useSectionTabs";

const IAM_TABS: SectionTabsSpec<IamSectionKey> = {
	prefix: "iam-section:",
	homeId: "iam:home",
	home: "home",
	sectionOfPanel,
	panelOf,
	// IAM's kinds are filters inside a page, never path tabs.
	firstTab: () => null,
	spec: (key) => IAM_SECTIONS[key],
};

interface Deps {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The IAM product is the one open. */
	enabled: boolean;
	openBoard: (board: OpenBoard) => void;
	boardPage: ReturnType<typeof useBoardPage>;
	setActiveBoardId: (id: string | null) => void;
	/** The data canvas in front, and the work canvas a page drove. */
	activeCanvasId: string | null;
	workPageId: string | null;
}

export function useIamSections({
	username,
	graphSlug,
	openBoard,
	...deps
}: Deps): SectionTabs & { openers: IamOpen } {
	const tabs = useSectionTabs(IAM_TABS, deps);
	const { goTo } = tabs;
	const navigate = useNavigate();

	const openers = useMemo<IamOpen>(
		() => ({
			policy: (name) => openBoard({ kind: "policy", subjectId: name }),
			agent: (id) => openBoard({ kind: "iam_agent", subjectId: id }),
			group: (name) => openBoard({ kind: "iam_group", subjectId: name }),
			section: (key) => goTo(key),
			agentInAgents: (id) =>
				navigate(
					`/u/${username}/${graphSlug}/agents/agents?page=${encodeURIComponent(boardPageId("agent", id))}`,
				),
			agentsInAgents: () =>
				navigate(`/u/${username}/${graphSlug}/agents/agents`),
		}),
		[openBoard, goTo, navigate, username, graphSlug],
	);

	const pages =
		username && graphSlug
			? tabs.pagesOf((key) =>
					key === "home" ? null : (
						<IamOpenContext.Provider value={openers}>
							<IamSectionBody
								section={key}
								username={username}
								graphSlug={graphSlug}
							/>
						</IamOpenContext.Provider>
					),
				)
			: [];

	return { ...tabs, pages, openers };
}
