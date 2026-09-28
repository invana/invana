import { LayeredCanvasHeader } from "@/canvases/layered/LayeredCanvasChrome";
import { useAgentsQuery } from "@/pages/graphs-detail/features/agents";
import {
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
} from "@/pages/graphs-detail/features/assistant/SessionTutorialModal";
import type { useSessions } from "@/pages/graphs-detail/features/assistant/useSessions";
import {
	BOARD_KINDS,
	CANVAS_KINDS,
	type CanvasKind,
	boardPageId,
	declaredPage,
	parseBoardPageId,
} from "@/pages/graphs-detail/features/boards";
import { DeclaredBoard } from "@/pages/graphs-detail/features/boards";
import {
	type BoardPageHandle,
	DataBoardPage,
} from "@/pages/graphs-detail/features/boards";
import { useLensesQuery } from "@/pages/graphs-detail/features/lenses/queries";
import type { ModelSelection } from "@/pages/graphs-detail/features/models";
import { useSkillsQuery } from "@/pages/graphs-detail/features/skills/queries";
import { GraphHomePage } from "@/pages/graphs-detail/shell/GraphHomePage";
import {
	type BoardTitleNames,
	type DeclaredBoardDeps,
	boardTitle,
	declaredBoardContent,
} from "@/pages/graphs-detail/shell/declaredBoardBody";
import { canvasEmptyHint } from "@/pages/graphs-detail/shell/layeredCanvasBody";
import type { useDataBoards } from "@/pages/graphs-detail/shell/useDataBoards";
import type { useLayeredCanvas } from "@/pages/graphs-detail/shell/useLayeredCanvas";
import type { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import type { useLensesViewPanel } from "@/pages/graphs-detail/shell/useLensesViewPanel";
import type { useOpenBoards } from "@/pages/graphs-detail/shell/useOpenBoards";
import type { useRightSection } from "@/pages/graphs-detail/shell/useRightSection";
import type {
	BoardHeaderAction,
	BoardPage as BoardPageDef,
} from "@invana/canvas-ui";
import {
	HelpCircle,
	History,
	Home,
	Layers,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Route,
	SlidersHorizontal,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";

import type { BoardPagesViewPanelProps } from "@invana/canvas-ui";
import type { Dispatch, SetStateAction } from "react";

/** The page that is always open and can never be closed (graph-detail-page.md G6). */
const GRAPH_PAGE_ID = "graph";

/** What the open pages read from the page that hosts them. */
export interface OpenPagesDeps {
	username: string | undefined;
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
	openWorkPanel: DeclaredBoardDeps["openWorkPanel"];
	openAgentPage: DeclaredBoardDeps["openAgentPage"];
	showAgentCanvas: DeclaredBoardDeps["showAgentCanvas"];
	modelSelection: ModelSelection | null;
	setModelSelection: Dispatch<SetStateAction<ModelSelection | null>>;
	modelsView: BoardTitleNames["modelsView"];
	modelName: BoardTitleNames["modelName"];
	planRefById: BoardTitleNames["planRefById"];
	renameSession: ReturnType<typeof useSessions>["renameSession"];
	backToList: ReturnType<typeof useSessions>["backToList"];
	right: ReturnType<typeof useRightSection>;
	toggleInspector: () => void;
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
 * Returns the props for `BoardPagesViewPanel`; the host sets the rest.
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
		openWorkPanel,
		openAgentPage,
		showAgentCanvas,
		modelSelection,
		setModelSelection,
		modelsView,
		modelName,
		planRefById,
		renameSession,
		backToList,
		right,
		toggleInspector,
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
		setSelectedId,
		sessionTitleById,
		handleStylingChange,
		styleTypes,
		handleShowDetail,
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
	// `World` (WO15): a strip of four tabs all reading `World` is a strip you
	// have to click through to read. It comes off the list the Govern section
	// already read, so this costs no request; a name that has not landed yet
	// falls back to the kind's label rather than to an empty tab.
	const lenses = useLensesQuery(username, graphSlug);
	const lensNameById = useMemo(
		() =>
			new Map((lenses.data?.items ?? []).map((l) => [l.id, l.display_name])),
		[lenses.data],
	);
	// An agent's page is named for the agent, for the same reason (AG34).
	const agentsList = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const agentNameById = useMemo(
		() => new Map((agentsList.data?.items ?? []).map((a) => [a.id, a.name])),
		[agentsList.data],
	);
	// And a skill's page for the skill (SK17).
	const skillsList = useSkillsQuery(username, graphSlug);
	const skillNameById = useMemo(
		() => new Map((skillsList.data?.items ?? []).map((s) => [s.id, s.name])),
		[skillsList.data],
	);

	// The active canvas page's handle. The strip's help / styling / history /
	// rename buttons act on *this* canvas, but `BoardHeaderAction` carries no
	// page id (graph-detail-page.md G12), so the shell calls into the page
	// rather than passing one.
	const boardPageRef = useRef<BoardPageHandle>(null);

	// Clicking a node/edge feeds `selectedId` via <InspectorSelectionBridge>; the
	// derived `selected` (above) drives the right-side InspectorViewPanel. The strip
	// above it belongs to `BoardPagesViewPanel` in `mainSection`
	// (graph-detail-page.md G4), not to this page.
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
			styleTypes={styleTypes}
			onStylingChange={handleStylingChange}
			onReady={handleReady}
			onViewTargetChange={setSelectedId}
			onShowDetail={handleShowDetail}
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

	// ── The open pages (graph-detail-page.md G4) ───────────────────────────────
	//
	// One strip over every kind of page: the graph itself, a data canvas per open
	// tab, the declared boards, and whichever work canvas a panel drove. What used to be a
	// four-branch ternary fighting over one slot is a list, and the branch that
	// used to explain why the slot was empty is now the graph page — a page that
	// is always there and cannot be closed (G6).

	// The graduation cap opens the wizard from anywhere in the Graph (setup.md
	// SU19), and the wizard is the graph page's content — so asking for it makes
	// the graph page active, whatever else was open. Nothing is closed: the other
	// pages keep their state and their tabs.
	// A focused board is the active page, the way an open wizard is (G26): it is
	// what the reader last asked for, and every other page keeps its tab and its
	// state behind it.
	const focusedBoard =
		activeBoardId &&
		boards.some(
			(b) => boardPageId(b.kind, b.subjectId, b.versionId) === activeBoardId,
		)
			? activeBoardId
			: null;

	const activePageId = onboardingOpen
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
		openWorkPanel,
		openAgentPage,
		showAgentCanvas,
		backend,
		modelSelection,
		setModelSelection,
	};
	const titleNames: BoardTitleNames = {
		modelsView,
		modelName,
		lensNameById,
		agentNameById,
		skillNameById,
		planRefById,
	};

	const pages: BoardPageDef[] = [
		{
			id: GRAPH_PAGE_ID,
			// The page says what it is *showing*. While setup is unfinished the
			// graph page is the setup board (G26), so the strip tab and the
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
				/>
			),
		},
		...openTabs.map((tab) => ({
			id: boardPageId("data", tab.id),
			title: sessionTitleById.get(tab.sessionId) ?? "Board",
			icon: CANVAS_KINDS.data.icon,
			// `keepMounted` is off until each canvas owns its own engine
			// (the-shell.md), so only the active page's body is mounted — which is
			// exactly what the four-branch ternary did, minus the fighting.
			content: activeCanvasId === tab.id ? canvasContent : null,
		})),
		// The declared boards — a run dashboard and a step's. `renders` is the
		// only thing that picks the body (boards-migration § 5); the strip, the
		// title and the close are the same as every other page's.
		...boards.map((board) => ({
			id: boardPageId(board.kind, board.subjectId, board.versionId),
			title: boardTitle(board, titleNames),
			icon: BOARD_KINDS[board.kind].icon,
			// Which board this is belongs to the host, so every declared page can
			// offer `Save report` and `Reports` without six components threading a
			// `kind` and a `subjectId` they have no other use for (B6 · B21).
			content: (
				<DeclaredBoard
					username={username as string}
					graphSlug={graphSlug as string}
					kind={board.kind}
					subjectId={board.subjectId}
					// Saving a reading and opening a kept one are the same move: the
					// page becomes `kind:id@version` (B12 · B22).
					onOpenVersion={(versionId) => openBoard({ ...board, versionId })}
				>
					{declaredBoardContent(board, declaredDeps)}
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
	// it is the resting state of the region, not a tab (G6).
	const closePage = (id: string) => {
		const board = declaredPage(id);
		if (board) {
			// The pair again — closing the usage board must not close the skill
			// board beside it (SD2).
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

	// Strip-level, and two owners: the active page's own controls first, then the
	// shell's region toggles (G12). A model page therefore never offers
	// "Styling", and the graph page offers none of them.
	const isDataBoardPage = parseBoardPageId(activePageId)?.kind === "data";
	const pageHeaderActions: BoardHeaderAction[] = isDataBoardPage
		? [
				{
					id: "help",
					label: "What can I do here?",
					icon: HelpCircle,
					onClick: () => boardPageRef.current?.openHelp(),
				},
				{
					// Layers describes the canvas in front of you, so it is a strip
					// control and a card over the canvas, not a `leftNav` panel (G18).
					id: "layers",
					label: "Layers",
					icon: Layers,
					onClick: () => boardPageRef.current?.toggleLayers(),
				},
				{
					id: "styling",
					label: "Styling",
					icon: SlidersHorizontal,
					onClick: () => boardPageRef.current?.toggleStyling(),
				},
				{
					id: "history",
					label: "History",
					icon: History,
					onClick: () => boardPageRef.current?.toggleHistory(),
				},
			]
		: [];

	const pageMenuItems: BoardPagesViewPanelProps["pageMenuItems"] = [
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
		onAdd: () => void newCanvasTab(),
		pageMenuItems,
		headerActions: [
			...pageHeaderActions,
			{
				id: "inspector",
				label: right.is("inspector")
					? "Hide inspector panel"
					: "Show inspector panel",
				icon: right.is("inspector") ? PanelRightClose : PanelRightOpen,
				onClick: toggleInspector,
			},
		],
	};
}
