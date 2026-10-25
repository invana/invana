/**
 * A product's sections as workbook tabs — the Agents shell (the-agents-shell.md),
 * which Agents and IAM both use.
 *
 * Such a product has no leftSection: a rail item opens its section as a tab,
 * or brings its tab to the front. The path names the section in front, its
 * tab (the path's last segment) and, where a section drills into a record in
 * a modal, that record; the other open section tabs are this session's, each
 * remembering the tab it was left on. With no section in the path — the
 * product's `home` — the workbook shows Home.
 *
 * What is in front is decided with the host's other pages in `useOpenPages`:
 * a record tab named by `?page=` first, then the section, unless a canvas was
 * brought forward since the section last was.
 *
 * A product hands its sections table in; `useAgentsSections` and
 * `useIamSections` add the openers and the bodies.
 */

import type { WorkbookPage } from "@invana/ui";
import type { ProductIcon } from "@invana-studio/core";
import { SECTION_PARAM, usePageParams } from "@invana-studio/shell";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { useBoardPage } from "@/host/useBoardPage";

/** What a product says about its sections. */
export interface SectionTabsSpec<K extends string> {
	/** The page id prefix of a section's tab. */
	prefix: string;
	/** The page id Home stands for: no tab is lit while it shows. */
	homeId: string;
	/** The section that is Home. */
	home: K;
	/** The section a `panel` key names, or null when it is not this product's. */
	sectionOfPanel: (panel: string | null) => K | null;
	/** The `panel` key a section writes. */
	panelOf: (key: K) => string;
	/** The tab a section opens on when the path names none. */
	firstTab: (key: K) => string | null;
	/** The tab's title and icon. */
	spec: (key: K) => { label: string; icon: ProductIcon };
	/** A section that drills into a record in a modal, and the param naming it. */
	detail?: { section: K; param: string };
}

/** What every product's sections hand the host. */
export interface SectionTabs {
	/** The open section tabs. */
	pages: WorkbookPage[];
	/** The page id Home stands for. */
	homeId: string;
	/** The section tab the path names; null on Home and off the product. */
	activeSectionId: string | null;
	/** What the path puts in front of the canvases — its section, or Home —
	 *  until a canvas comes forward. */
	frontId: string | null;
	/** Whether a page id is one of this product's section tabs. */
	isSectionPage: (id: string) => boolean;
	select: (id: string) => void;
	close: (id: string) => void;
	/** A canvas tab was picked: the section steps behind it. */
	stepBack: () => void;
}

interface Deps {
	/** The product is the one open. */
	enabled: boolean;
	boardPage: ReturnType<typeof useBoardPage>;
	setActiveBoardId: (id: string | null) => void;
	/** The data canvas in front, and the work canvas a page drove. */
	activeCanvasId: string | null;
	workPageId: string | null;
}

/** What a section's body is drawn with. */
export interface SectionBodyContext {
	/** The open tab — the path's when the section is in front, else the one it was left on. */
	tab: string;
	/** The section is the one the path names. */
	here: boolean;
}

export function useSectionTabs<K extends string>(
	spec: SectionTabsSpec<K>,
	{ enabled, boardPage, setActiveBoardId, activeCanvasId, workPageId }: Deps,
) {
	const { prefix, homeId, home, sectionOfPanel, panelOf, firstTab, detail } =
		spec;
	const [params, setParams] = usePageParams();
	const current: K | null = enabled
		? sectionOfPanel(params.get("panel"))
		: null;
	const pathTab = current
		? (params.get(SECTION_PARAM) ?? firstTab(current) ?? "")
		: "";
	const detailId =
		detail && current === detail.section ? params.get(detail.param) : null;

	// The open section tabs, in the order they were opened, each with the tab
	// it was left on.
	const [open, setOpen] = useState<{ key: K; tab: string }[]>([]);
	// Whether the path's section is in front of the canvases.
	const [inFront, setInFront] = useState(true);

	useEffect(() => {
		if (!current || current === home) return;
		setOpen((tabs) =>
			tabs.some((t) => t.key === current)
				? tabs.map((t) => (t.key === current ? { ...t, tab: pathTab } : t))
				: [...tabs, { key: current, tab: pathTab }],
		);
	}, [current, pathTab, home]);

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

	const detailParam = detail?.param;
	/** Put a section in the path, on a tab, with a record open in its modal or not. */
	const goTo = useCallback(
		(key: K, tab?: string, record?: string | null) => {
			setInFront(true);
			setActiveBoardId(null);
			setParams((prev) => {
				const next = new URLSearchParams(prev);
				next.set("panel", panelOf(key));
				next.delete(SECTION_PARAM);
				if (tab) next.set(SECTION_PARAM, tab);
				for (const k of ["page", "tab", "step"]) next.delete(k);
				if (detailParam) {
					next.delete(detailParam);
					if (record) next.set(detailParam, record);
				}
				return next;
			});
		},
		[setParams, setActiveBoardId, panelOf, detailParam],
	);

	const keyOfPage = useCallback(
		(id: string): K | null => {
			if (!id.startsWith(prefix)) return null;
			const key = sectionOfPanel(panelOf(id.slice(prefix.length) as K));
			return key && key !== home ? key : null;
		},
		[prefix, sectionOfPanel, panelOf, home],
	);

	const activeSectionId =
		current && current !== home ? `${prefix}${current}` : null;

	/** The open section tabs, each drawn by `body`. Empty off the product. */
	const pagesOf = (
		body: (key: K, context: SectionBodyContext) => ReactNode,
	): WorkbookPage[] =>
		enabled
			? open.map(({ key, tab }) => {
					const { label, icon } = spec.spec(key);
					const here = key === current;
					return {
						id: `${prefix}${key}`,
						title: label,
						icon,
						closable: true,
						content: body(key, { tab: here ? pathTab : tab, here }),
					};
				})
			: [];

	const tabs: Omit<SectionTabs, "pages"> = useMemo(
		() => ({
			homeId,
			activeSectionId,
			frontId: inFront
				? (activeSectionId ?? (current === home ? homeId : null))
				: null,
			isSectionPage: (id) => keyOfPage(id) !== null,
			select: (id) => {
				const key = keyOfPage(id);
				const entry = open.find((t) => t.key === key);
				if (key) goTo(key, entry?.tab);
			},
			close: (id) => {
				const key = keyOfPage(id);
				const rest = open.filter((t) => t.key !== key);
				setOpen(rest);
				if (key !== current) return;
				const next = rest.at(-1);
				if (next) goTo(next.key, next.tab);
				else goTo(home);
			},
			stepBack: () => setInFront(false),
		}),
		[homeId, activeSectionId, inFront, current, home, keyOfPage, open, goTo],
	);

	return {
		...tabs,
		goTo,
		pagesOf,
		/** The record open in the detail section's modal, when the path names one. */
		detailId,
	};
}
