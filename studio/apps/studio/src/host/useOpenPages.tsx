import type { WorkbookPage, WorkbookPageMenuItem } from "@invana/ui";
import {
	type AgentsOpen,
	AgentsOpenContext,
	EVERY_AGENT,
	useAgentsQuery,
	useRunNumbers,
	useSkillsQuery,
} from "@invana-studio/agents";
import type { useSessions } from "@invana-studio/assistant";
import {
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
} from "@invana-studio/assistant";
import { useLensesQuery } from "@invana-studio/core";
import type {
	ModelSelection,
	useLensesViewPanel,
} from "@invana-studio/modeller";
import { useProjectsQuery } from "@invana-studio/projects";
import type { useLeftSection, useRightSection } from "@invana-studio/shell";
import {
	BOARD_KINDS,
	boardPageId,
	CANVAS_KINDS,
	type CanvasKind,
	declaredPage,
	parseBoardPageId,
	useActiveProduct,
	useAssistantShown,
	useOpenPalette,
} from "@invana-studio/shell";
import { Home, Pencil, Route, X } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useRef } from "react";
import { LayeredCanvasHeader } from "@/canvases/layered/LayeredCanvasChrome";
import {
	type BoardPageHandle,
	DataBoardPage,
	DeclaredBoard,
} from "@/host/boards";
import {
	type BoardTitleNames,
	boardTitle,
	type DeclaredBoardDeps,
	declaredBoardContent,
} from "@/host/declaredBoardBody";
import { GraphHomePage } from "@/host/GraphHomePage";
import { canvasEmptyHint } from "@/host/layeredCanvasBody";
import {
	AGENTS_HOME_ID,
	sectionOfPage,
	type useAgentsSections,
} from "@/host/useAgentsSections";
import type { useDataBoards } from "@/host/useDataBoards";
import type { useLayeredCanvas } from "@/host/useLayeredCanvas";
import type { useOpenBoards } from "@/host/useOpenBoards";

/** The page that is always open and can never be closed (graph-detail-page.md). */
export const GRAPH_PAGE_ID = "graph";

/** What the open pages read from the page that hosts them. */
export interface OpenPagesDeps {
	username: string | undefined;
	/** The Agents openers, so a record page opened as a declared page links like a section row. */
	agentsOpeners?: AgentsOpen | null;
	graphSlug: string | undefined;
	/** The setup wizard is open, which puts the graph page in front. */
	onboardingOpen: boolean;
	/** Setup is unfinished, so the graph page is the setup board. */
	setupOutstanding: boolean;
	settingsSection: ReturnType<typeof useLeftSection>["section"];
	settingsPanel: ReturnType<typeof useLeftSection>;
	governPanel: ReturnType<typeof useLensesViewPanel>;
	openBoards: ReturnType<typeof useOpenBoards>;
	layered: ReturnType<typeof useLayeredCanvas>;
	/** The layered canvas `mainSection` draws, when a panel drove one. */
	workCanvas: ReactNode;
	dataBoards: ReturnType<typeof useDataBoards>;
	runStep: string | null;
	/** The Agents sections as tabs; none outside Agents. */
	agentsSections: ReturnType<typeof useAgentsSections>;
	openAgentPage: DeclaredBoardDeps["openAgentPage"];
	showAgentCanvas: DeclaredBoardDeps["showAgentCanvas"];
	modelSelection: ModelSelection | null;
	setModelSelection: Dispatch<SetStateAction<ModelSelection | null>>;
	modelsView: BoardTitleNames["modelsView"];
	modelName: BoardTitleNames["modelName"];
	planRefById: BoardTitleNames["planRefById"];
	openProjectPage: DeclaredBoardDeps["openProjectPage"];
	openDataset: DeclaredBoardDeps["openDataset"];
	renameSession: ReturnType<typeof useSessions>["renameSession"];
	backToList: ReturnType<typeof useSessions>["backToList"];
	right: ReturnType<typeof useRightSection>;
	/** The assistant's centred start, for the graph page; absent while docked. */
	homeStart?: ReactNode;
}

/**
 * The pages open in `mainSection` — one strip over every kind of page.
 *
 * Builds the list the strip shows (the graph page, a data canvas per open tab,
 * the declared boards, and the layered canvas a panel drove), says which of
 * them is active, and answers the strip: selecting a page puts back the state
 * that produced it, closing one closes whatever opened it, and the strip's
 * header actions and page menu act on the active page. The data page's body
 * is built here too, with the handle the strip's buttons call into.
 *
 * Returns the props for `Workbook`; the host sets the rest.
 */
export function useOpenPages(deps: OpenPagesDeps) {
	const {
		username,
		graphSlug,
		onboardingOpen,
		setupOutstanding,
		settingsSection,
		settingsPanel,
		governPanel,
		openBoards,
		layered,
		workCanvas,
		dataBoards,
		runStep,
		agentsSections,
		openAgentPage,
		showAgentCanvas,
		modelSelection,
		setModelSelection,
		modelsView,
		modelName,
		planRefById,
		openProjectPage,
		openDataset,
		renameSession,
		backToList,
		right,
		homeStart,
	} = deps;
	const {
		boards,
		setBoards,
		activeBoardId,
		setActiveBoardId,
		boardPage,
		setPageId,
		openBoard,
	} = openBoards;
	const { setWorkKind, workTarget, workPageId } = layered;
	const {
		runRef,
		canvas,
		handleReady,
		magnet,
		backend,
		openTabs,
		createCanvasState,
		isRestoring,
		activeCanvasId,
		seedData,
		styling,
		selected,
		missingIds,
		setSelectedId,
		sessionTitleById,
		handleStylingChange,
		handleSaveState,
		openCanvasTab,
		newCanvasTab,
		closeCanvasTab,
		runExpand,
		expandSchema,
		propertyKeys,
		expandHandlers,
		handleForkState,
	} = dataBoards;

	// **A lens board's tab is named for the lens** — `EU · H1 2026`, never
	// `World`: a strip of four tabs all reading `World` is a strip you
	// have to click through to read. It comes off the list the Govern section
	// already read, so this costs no request; a name that has not landed yet
	// falls back to the kind's label rather than to an empty tab.
	const lenses = useLensesQuery(username, graphSlug);
	const lensNameById = useMemo(
		() =>
			new Map((lenses.data?.items ?? []).map((l) => [l.id, l.display_name])),
		[lenses.data],
	);
	// An agent's page is named for the agent, for the same reason.
	const agentsList = useAgentsQuery(username, graphSlug, EVERY_AGENT);
	const agentNameById = useMemo(
		() => new Map((agentsList.data?.items ?? []).map((a) => [a.id, a.name])),
		[agentsList.data],
	);
	// And a skill's page for the skill.
	const skillsList = useSkillsQuery(username, graphSlug, { limit: 200 });
	const skillNameById = useMemo(
		() => new Map((skillsList.data?.items ?? []).map((s) => [s.id, s.name])),
		[skillsList.data],
	);

	// And a run's page for its number.
	const runNumberById = useRunNumbers(
		username,
		graphSlug,
		boards.filter((b) => b.kind === "run").map((b) => b.subjectId),
	);

	// And a project's page for the project.
	const projectsList = useProjectsQuery(username, graphSlug);
	const projectNameByKey = useMemo(
		() => new Map((projectsList.data?.items ?? []).map((p) => [p.key, p.name])),
		[projectsList.data],
	);

	// The active canvas page's handle. The tab menu's *Rename* acts on *this*
	// canvas, but a page menu item carries only the page id
	// (graph-detail-page.md), so the shell calls into the page.
	const boardPageRef = useRef<BoardPageHandle>(null);
	const productId = useActiveProduct()?.id;
	const explorerOpen = productId === "explorer";
	const agentsOpen = productId === "agents";
	const openPalette = useOpenPalette();
	const [assistantShown] = useAssistantShown();

	// Clicking a node/edge feeds `selectedId` via <SelectionBridge>; the
	// derived `selected` (above) is the record card the page floats over the
	// board. The strip above it belongs to `Workbook` in `mainSection`
	// (graph-detail-page.md), not to this page.
	const canvasContent = (
		<DataBoardPage
			ref={boardPageRef}
			username={username as string}
			graphSlug={graphSlug as string}
			boardId={activeCanvasId}
			canvas={canvas}
			sessionIdForTab={(id) =>
				openTabs.find((t) => t.id === id)?.sessionId ?? null
			}
			sessionTitle={(id) => sessionTitleById.get(id) ?? ""}
			onRenameSession={renameSession}
			seedData={seedData}
			magnet={magnet}
			backend={backend}
			styling={styling}
			onStylingChange={handleStylingChange}
			onReady={handleReady}
			onViewTargetChange={setSelectedId}
			selected={selected}
			missingIds={missingIds}
			modelName={modelName}
			onCloseRecord={() => setSelectedId(null)}
			onAskAboutRecord={
				assistantShown ? () => right.open("assistant") : undefined
			}
			onOpenModel={() => settingsPanel.setSection("runs")}
			interactionRef={runRef}
			expand={expandHandlers}
			expandSchema={expandSchema}
			propertyKeys={propertyKeys}
			onExpand={runExpand}
			onFork={(versionId) => void handleForkState(versionId)}
			isForking={isRestoring}
			onSave={() => void handleSaveState()}
			isSaving={createCanvasState.isPending}
			tutorialSeen={hasSeenSessionTutorial()}
			onTutorialSeen={markSessionTutorialSeen}
		/>
	);

	// ── The open pages (graph-detail-page.md) ───────────────────────────────
	//
	// One strip over every kind of page: the graph itself, a data canvas per open
	// tab, the declared boards, and whichever work canvas a panel drove. What used to be a
	// four-branch ternary fighting over one slot is a list, and the branch that
	// used to explain why the slot was empty is now the graph page — a page that
	// is always there and cannot be closed.

	// The graduation cap opens the wizard from anywhere in the Graph (setup.md
	// ), and the wizard is the graph page's content — so asking for it makes
	// the graph page active, whatever else was open. Nothing is closed: the other
	// pages keep their state and their tabs.
	// A focused board is the active page, the way an open wizard is: it is
	// what the reader last asked for, and every other page keeps its tab and its
	// state behind it.
	const focusedBoard =
		activeBoardId &&
		boards.some(
			(b) => boardPageId(b.kind, b.subjectId, b.versionId) === activeBoardId,
		)
			? activeBoardId
			: null;

	const dataPageId = activeCanvasId
		? boardPageId("data", activeCanvasId)
		: null;
	const workPage = workCanvas && workPageId ? workPageId : null;
	const { activeSectionId } = agentsSections;
	// In Agents a record tab is in front first, then the section the path
	// names — or Home — unless a canvas came forward since.
	const activePageId = agentsOpen
		? (focusedBoard ??
			agentsSections.frontId ??
			workPage ??
			dataPageId ??
			activeSectionId ??
			AGENTS_HOME_ID)
		: onboardingOpen
			? GRAPH_PAGE_ID
			: focusedBoard
				? focusedBoard
				: workCanvas && workPageId
					? workPageId
					: activeCanvasId
						? boardPageId("data", activeCanvasId)
						: GRAPH_PAGE_ID;

	const declaredDeps: DeclaredBoardDeps = {
		username,
		graphSlug,
		openBoard,
		setPageId,
		runStep,
		settingsPanel,
		governPanel,
		openAgentPage,
		showAgentCanvas,
		backend,
		modelSelection,
		setModelSelection,
		openProjectPage,
		openDataset,
	};
	const titleNames: BoardTitleNames = {
		modelsView,
		modelName,
		lensNameById,
		agentNameById,
		skillNameById,
		runNumberById,
		planRefById,
		projectNameByKey,
	};

	// The Explorer has no graph page: with no canvas open it draws the centred
	// start in place of the strip, so the strip only ever holds canvases. Agents
	// has none either: with nothing open its workbook shows Home.
	const graphPage: WorkbookPage[] =
		explorerOpen || agentsOpen
			? []
			: [
					{
						id: GRAPH_PAGE_ID,
						// The page says what it is *showing*. While setup is unfinished the
						// graph page is the setup board, so the strip tab and the
						// breadcrumb's last crumb both read `Setup` — a tab named for the slug
						// over a board of gates names the container and not the content. The id
						// does not change with it: it is the same page, and `?page=graph` has
						// to keep resolving.
						title: setupOutstanding ? "Setup" : (graphSlug ?? "Graph"),
						icon: setupOutstanding ? Route : Home,
						content: (
							<GraphHomePage
								username={username as string}
								graphSlug={graphSlug as string}
								hint={canvasEmptyHint(settingsSection)}
								start={homeStart}
							/>
						),
					},
				];
	const pages: WorkbookPage[] = [
		...agentsSections.pages,
		...graphPage,
		...openTabs.map((tab) => ({
			id: boardPageId("data", tab.id),
			title: sessionTitleById.get(tab.sessionId) ?? "Board",
			icon: CANVAS_KINDS.data.icon,
			// `keepMounted` is off until each canvas owns its own engine
			// (the-shell.md), so only the active page's body is mounted — which is
			// exactly what the four-branch ternary did, minus the fighting.
			content: activeCanvasId === tab.id ? canvasContent : null,
		})),
		// The declared boards — a run board and a step's. `renders` is the
		// only thing that picks the body (boards-migration § 5); the strip, the
		// title and the close are the same as every other page's.
		...boards.map((board) => ({
			id: boardPageId(board.kind, board.subjectId, board.versionId),
			title: boardTitle(board, titleNames),
			icon: BOARD_KINDS[board.kind].icon,
			// A board has nothing to rename, so its tab carries a close `×`
			// instead of the Rename / Close menu.
			closable: true,
			// Which board this is belongs to the host, so every declared page can
			// offer `Save report` and `Reports` without six components threading a
			// `kind` and a `subjectId` they have no other use for.
			content: (
				<DeclaredBoard
					username={username as string}
					graphSlug={graphSlug as string}
					kind={board.kind}
					subjectId={board.subjectId}
					// Saving a reading and opening a kept one are the same move: the
					// page becomes `kind:id@version`.
					onOpenVersion={(versionId) => openBoard({ ...board, versionId })}
				>
					<AgentsOpenContext.Provider value={deps.agentsOpeners ?? null}>
						{declaredBoardContent(board, declaredDeps)}
					</AgentsOpenContext.Provider>
				</DeclaredBoard>
			),
		})),
		...(workPageId && workCanvas && workTarget
			? [
					{
						id: workPageId,
						title: CANVAS_KINDS[workTarget.kind].label,
						icon: CANVAS_KINDS[workTarget.kind].icon,
						content: (
							<div className="flex h-full w-full flex-col overflow-hidden">
								<LayeredCanvasHeader
									username={username as string}
									graphSlug={graphSlug as string}
									target={workTarget}
									onClose={() => setWorkKind(null)}
								/>
								<div className="min-h-0 flex-1">{workCanvas}</div>
							</div>
						),
					},
				]
			: []),
	];

	// Selecting a tab is not "show that node" — each kind of page is reached by
	// putting the page state that produced it back, which is why this dispatches
	// rather than setting one id.
	const selectPage = (id: string) => {
		if (sectionOfPage(id)) {
			agentsSections.select(id);
			return;
		}
		agentsSections.stepBack();
		// A declared board is reached by its id alone — there is no panel state
		// behind it to put back, which is what `subject_id` buys.
		if (declaredPage(id)) {
			setActiveBoardId(id);
			boardPage.setPageId(id, { step: null });
			return;
		}
		setActiveBoardId(null);
		boardPage.setPageId(null, { step: null });
		if (id === GRAPH_PAGE_ID) {
			setWorkKind(null);
			backToList();
			return;
		}
		const page = parseBoardPageId(id);
		if (page?.kind === "data") {
			setWorkKind(null);
			void openCanvasTab(page.id);
			return;
		}
		if (page && page.kind in CANVAS_KINDS) setWorkKind(page.kind as CanvasKind);
	};

	// Closing a page is closing whatever opened it. The graph page has no close —
	// it is the resting state of the region, not a tab.
	const closePage = (id: string) => {
		if (sectionOfPage(id)) {
			agentsSections.close(id);
			return;
		}
		const board = declaredPage(id);
		if (board) {
			// The pair again — closing the usage board must not close the skill
			// board beside it.
			setBoards((open) =>
				open.filter(
					(b) => b.kind !== board.kind || b.subjectId !== board.subjectId,
				),
			);
			// Closing the focused board hands the strip back to whatever was
			// behind it, rather than to the board's own neighbour.
			setActiveBoardId((current) => (current === id ? null : current));
			if (boardPage.pageId === id) boardPage.setPageId(null, { step: null });
			return;
		}
		const page = parseBoardPageId(id);
		if (page?.kind === "data") {
			void closeCanvasTab(page.id);
			return;
		}
		setWorkKind(null);
	};

	const pageMenuItems: WorkbookPageMenuItem[] = [
		{
			id: "rename",
			label: "Rename",
			icon: Pencil,
			disabled: (id) => parseBoardPageId(id)?.kind !== "data",
			onSelect: (id) => {
				const page = parseBoardPageId(id);
				if (page) boardPageRef.current?.openRename(page.id);
			},
		},
		{
			id: "close",
			label: "Close",
			icon: X,
			destructive: true,
			separatorBefore: true,
			disabled: (id) => id === GRAPH_PAGE_ID,
			onSelect: closePage,
		},
	];

	return {
		pages,
		activeId: activePageId,
		onSelect: selectPage,
		// In Agents `+` opens a section or a record, through ⌘K; elsewhere it
		// opens a canvas.
		onAdd: agentsOpen && openPalette ? openPalette : () => void newCanvasTab(),
		addLabel: agentsOpen ? "Open a section or a record" : "New canvas",
		onClose: closePage,
		pageMenuItems,
	};
}
