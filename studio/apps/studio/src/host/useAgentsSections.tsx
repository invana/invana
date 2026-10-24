/**
 * The Agents product's sections as workbook tabs (the-agents-shell.md).
 *
 * Agents has no leftSection: a rail item opens its section as a tab, or brings
 * its tab to the front. The path names the section in front, its tab (the
 * path's last segment) and, on LLMs, the endpoint open in its modal; the other
 * open section tabs are this session's, each remembering the tab it was left
 * on. With no section in the path — `/agents/home` — the workbook shows Home.
 *
 * What is in front is decided with the host's other pages in `useOpenPages`:
 * a record tab named by `?page=` first, then the section, unless a canvas was
 * brought forward since the section last was.
 */

import type { WorkbookPage } from "@invana/ui";
import {
	type AgentsOpen,
	AgentsOpenContext,
	AgentsSectionBody,
	type AgentsSectionKey,
	firstTab,
	SECTIONS,
} from "@invana-studio/agents";
import {
	type OpenBoard,
	SECTION_PARAM,
	usePageParams,
} from "@invana-studio/shell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { useBoardPage } from "@/host/useBoardPage";

/** The page id Home stands for: no tab is lit while it shows. */
export const AGENTS_HOME_ID = "agents:home";

const PREFIX = "section:";
type Section = Exclude<AgentsSectionKey, "home">;

const isSection = (key: string | null): key is AgentsSectionKey =>
	!!key && key in SECTIONS;

/** The section a workbook page id names, or null when it is another page. */
export const sectionOfPage = (id: string): Section | null => {
	const key = id.startsWith(PREFIX) ? id.slice(PREFIX.length) : null;
	return isSection(key) && key !== "home" ? key : null;
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
	enabled,
	openBoard,
	boardPage,
	setActiveBoardId,
	activeCanvasId,
	workPageId,
}: Deps) {
	const [params, setParams] = usePageParams();
	const panel = params.get("panel");
	const current: AgentsSectionKey | null =
		enabled && isSection(panel) ? panel : null;
	const pathTab = current
		? (params.get(SECTION_PARAM) ?? firstTab(current) ?? "")
		: "";
	const provider = current === "llms" ? params.get("provider") : null;

	// The open section tabs, in the order they were opened, each with the tab
	// it was left on.
	const [open, setOpen] = useState<{ key: Section; tab: string }[]>([]);
	// Whether the path's section is in front of the canvases.
	const [inFront, setInFront] = useState(true);

	useEffect(() => {
		if (!current || current === "home") return;
		setOpen((tabs) =>
			tabs.some((t) => t.key === current)
				? tabs.map((t) => (t.key === current ? { ...t, tab: pathTab } : t))
				: [...tabs, { key: current, tab: pathTab }],
		);
	}, [current, pathTab]);

	// A move to another section brings it in front of whatever was: a record
	// tab steps behind it, and so does a canvas.
	const previous = useRef(current);
	const { setPageId } = boardPage;
	useEffect(() => {
		if (previous.current === current) return;
		previous.current = current;
		if (!current) return;
		setInFront(true);
		setActiveBoardId(null);
		setPageId(null, { step: null });
	}, [current, setActiveBoardId, setPageId]);

	// A canvas that opens — an ask's answer, an agent's lineage — comes forward.
	useEffect(() => {
		if (activeCanvasId || workPageId) setInFront(false);
	}, [activeCanvasId, workPageId]);

	/** Put a section in the path, on a tab, with an endpoint open or not. */
	const goTo = useCallback(
		(key: AgentsSectionKey, tab?: string, endpoint?: string | null) => {
			setInFront(true);
			setActiveBoardId(null);
			setParams((prev) => {
				const next = new URLSearchParams(prev);
				next.set("panel", key);
				next.delete(SECTION_PARAM);
				if (tab) next.set(SECTION_PARAM, tab);
				for (const k of ["page", "tab", "step", "provider"]) next.delete(k);
				if (endpoint) next.set("provider", endpoint);
				return next;
			});
		},
		[setParams, setActiveBoardId],
	);

	const openers = useMemo<AgentsOpen>(
		() => ({
			agent: (id) => openBoard({ kind: "agent", subjectId: id }),
			skill: (id) => openBoard({ kind: "skill", subjectId: id }),
			func: (key) => openBoard({ kind: "function", subjectId: key }),
			plugin: (name) => openBoard({ kind: "plugin", subjectId: name }),
			plan: (id) => openBoard({ kind: "plan_runs", subjectId: id }),
			template: (id) => openBoard({ kind: "template", subjectId: id }),
			run: (id) => openBoard({ kind: "run", subjectId: id, runId: id }),
			section: (key, tab) => goTo(key, tab),
		}),
		[openBoard, goTo],
	);

	const pages: WorkbookPage[] =
		enabled && username && graphSlug
			? open.map(({ key, tab }) => {
					const spec = SECTIONS[key];
					const here = key === current;
					return {
						id: `${PREFIX}${key}`,
						title: spec.label,
						icon: spec.icon,
						closable: true,
						content: (
							<AgentsOpenContext.Provider value={openers}>
								<AgentsSectionBody
									section={key}
									username={username}
									graphSlug={graphSlug}
									tab={here ? pathTab : tab}
									onTab={(t) => goTo(key, t)}
									detail={here ? provider : null}
									onDetail={(id) => goTo("llms", undefined, id)}
								/>
							</AgentsOpenContext.Provider>
						),
					};
				})
			: [];

	const activeSectionId =
		current && current !== "home" ? `${PREFIX}${current}` : null;

	return {
		pages,
		/** The section tab the path names; null on Home and off Agents. */
		activeSectionId,
		/** What the path puts in front of the canvases — its section, or Home —
		 *  until a canvas comes forward. */
		frontId: inFront
			? (activeSectionId ?? (current === "home" ? AGENTS_HOME_ID : null))
			: null,
		openers,
		/** The LLM endpoint open in its modal, when the path names one. */
		endpointId: provider,
		select: (id: string) => {
			const key = sectionOfPage(id);
			const entry = open.find((t) => t.key === key);
			if (key) goTo(key, entry?.tab);
		},
		close: (id: string) => {
			const key = sectionOfPage(id);
			const rest = open.filter((t) => t.key !== key);
			setOpen(rest);
			if (key !== current) return;
			const next = rest.at(-1);
			if (next) goTo(next.key, next.tab);
			else goTo("home");
		},
		/** A canvas tab was picked: the section steps behind it. */
		stepBack: () => setInFront(false),
	};
}
