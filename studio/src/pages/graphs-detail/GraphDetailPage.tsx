import { useSessions } from "@/pages/graphs-detail/features/assistant";
import { OpenBoardContext } from "@/pages/graphs-detail/features/boards";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "@/pages/graphs-detail/features/graphs";
import {
	hasOutstandingSetup,
	isGateOpen,
} from "@/pages/graphs-detail/features/graphs";
import { useLLMProvidersQuery } from "@/pages/graphs-detail/features/llms";
import type { ModelSelection } from "@/pages/graphs-detail/features/models";
import { useModelsQuery } from "@/pages/graphs-detail/features/models";
import { useRunStep } from "@/pages/graphs-detail/features/runs/boards";
import { useOnboarding } from "@/pages/graphs-detail/features/setup/useOnboarding";
import { GraphDetail } from "@/pages/graphs-detail/shell/GraphDetail";
import { graphDetailChrome } from "@/pages/graphs-detail/shell/GraphDetailChrome";
import { layeredCanvasBody } from "@/pages/graphs-detail/shell/layeredCanvasBody";
import { leftSection } from "@/pages/graphs-detail/shell/leftSectionContent";
import { rightSection } from "@/pages/graphs-detail/shell/rightSections";
import { useDataBoards } from "@/pages/graphs-detail/shell/useDataBoards";
import { useLayeredCanvas } from "@/pages/graphs-detail/shell/useLayeredCanvas";
import { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import { useLegacySessionsLink } from "@/pages/graphs-detail/shell/useLegacySessionsLink";
import { useLensesViewPanel } from "@/pages/graphs-detail/shell/useLensesViewPanel";
import { useModelsPage } from "@/pages/graphs-detail/shell/useModelsPage";
import { useOpenBoards } from "@/pages/graphs-detail/shell/useOpenBoards";
import { useOpenPages } from "@/pages/graphs-detail/shell/useOpenPages";
import { useRightSection } from "@/pages/graphs-detail/shell/useRightSection";
import { reportBoundaryError } from "@/services/telemetry/errors";
import type { QueryResponse } from "@/types/query";
import { CanvasContext } from "@invana/canvas-react";
import { BoardPagesViewPanel } from "@invana/canvas-ui";
import { ErrorBoundary } from "@invana/ui";
import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router-dom";

export function GraphDetailPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const { data: graph, isLoading: graphLoading } = useGraphConnectionQuery(
		username,
		graphSlug,
	);
	const connectionMissing = !graphLoading && !graph;

	// Asking is gated server-side by the **answering** gate
	// (409 graph_setup_incomplete, naming the gate). Mirror that here so we never
	// let the user fire a question that is guaranteed to bounce — and gate on the
	// one gate the surface needs rather than on the whole sequence
	// (setup.md SU3), so a graph with no data can still be explored and queried.
	const { data: graphContainer } = useGraphQuery(username, graphSlug);
	const cannotAnswer =
		!!graphContainer && !isGateOpen(graphContainer, "answering");

	// The graph page is the setup board until the Graph is ready (G26), so the
	// page strip and the breadcrumb name what is on it rather than the graph it
	// belongs to.
	const setupOutstanding = hasOutstandingSetup(graphContainer);

	// The Govern panel's own URL keys — `Edit` on a lens board puts the section
	// back on that lens in one write (WO16).
	const governPanel = useLensesViewPanel();
	const sessionState = useSessions(username, graphSlug, {
		onResult: ({ sessionId, messageId, result }) =>
			handleStreamResult(sessionId, messageId, result),
	});
	const {
		sessions,
		activeSession,
		activeSessionId,
		send,
		rerun,
		recordLoad,
		refresh,
		renameSession,
		world,
		openSession,
		backToList,
	} = sessionState;
	// The canvas works in the open thread's world (AS5 · AD15): its restore
	// check, its expansions and its legend read what the thread asks in. No
	// thread open is *Everything*.
	const threadWorldId = world.threadLensId;

	// Who holds the right side — `?right=assistant | inspector`, absent means
	// closed. One param, so opening one occupant replaces the other and the
	// region survives a reload. The inspector defaults closed: it is only useful
	// with something selected, so navigating here never opens it.
	const right = useRightSection();
	// The left rail's single-open param. Sessions is no longer one of its keys —
	// it is the `assistant` occupant of the right side (the-assistant.md
	// AD1/AD7).
	const { isOpen: onboardingOpen } = useOnboarding();
	const settingsPanel = useLeftSection();
	const closeLeftPanel = settingsPanel.close;

	// The selection the panels and the layered canvases share, and the canvas
	// kind `mainSection` draws — one piece of state per noun.
	const layered = useLayeredCanvas(username, graphSlug, settingsPanel.section);
	const { setSelectedAgentId, setSelectedStepId, setWorkKind, workTarget } =
		layered;
	// The declared boards open in `mainSection`, and the focused one (`?page=`).
	const openBoards = useOpenBoards(username, graphSlug);
	const {
		setActiveBoardId,
		boardPage,
		openBoard,
		openRecordBoard,
		openLensBoard,
		planRefById,
	} = openBoards;
	// `&step=` — the task open inside the focused run page (SR72).
	const runStep = useRunStep().stepId;

	// Which model the Model panel has open, and which of its types is selected —
	// the selection drives the form that spans the main column (model-editor.md ME6).
	useLegacySessionsLink(settingsPanel);
	// The attachment is the canvas selection until someone takes it off — asked
	// without it, and the thread records that (AD2).
	const [attachmentDetached, setAttachmentDetached] = useState(false);
	// A node carries the id of the dataset that wrote it; the inspector shows the
	// name. One list, cached, rather than a lookup per selection.
	// An element's provenance names the model it conforms to, so the name comes
	// from the models list — there is no second record between a model and its
	// records (BD16).
	const modelList = useModelsQuery(username, graphSlug);
	const modelName = useCallback(
		(id: string) => modelList.data?.find((m) => m.id === id)?.name,
		[modelList.data],
	);
	const [modelSelection, setModelSelection] = useState<ModelSelection | null>(
		null,
	);

	const openWorkPanel = useCallback(
		(section: "projects" | "runs" | "library" | "agents" | "skills") => {
			settingsPanel.setSection(section);
		},
		[settingsPanel],
	);

	// The agent's page is a declared board in `mainSection` (AG34); the Agents
	// list stays in `leftSection` with the agent selected beside it. **Stable**:
	// the Agents panel calls it from an effect when an old `&agent=` link lands.
	const openAgentPage = useCallback(
		(id: string) => {
			setSelectedAgentId(id);
			openBoard({ kind: "agent", subjectId: id });
		},
		[openBoard, setSelectedAgentId],
	);
	// An agent's two canvases — its envelope and its lineage. Asked for from the
	// agent's page or the list, they have to come in front of a focused board,
	// or the click would draw behind the page it was made on.
	const showAgentCanvas = (kind: "envelope" | "lineage", id: string) => {
		setSelectedAgentId(id);
		if (kind === "envelope") setSelectedStepId(null);
		setActiveBoardId(null);
		boardPage.setPageId(null);
		setWorkKind(kind);
	};

	// The open `?panel` key, read in several places below (which canvas kind the
	// panel owns, which panel the left column draws).
	const { section: settingsSection } = settingsPanel;

	// The inspector is an occupant of the right side, not a flag on it: showing
	// it *is* `?right=inspector`, and hiding it closes the region.
	const closeInspector = right.close;
	const openInspector = useCallback(
		() => right.open("inspector"),
		[right.open],
	);
	const toggleInspector = useCallback(
		() => right.toggle("inspector"),
		[right.toggle],
	);
	const { data: llmProvidersResponse } = useLLMProvidersQuery(
		username,
		graphSlug,
	);
	const llmProviders = llmProvidersResponse?.items ?? [];

	// Latest handlers for the stream callback (wired once in useSessions).
	const streamResultRef = useRef<
		(sessionId: string, messageId: string, result: QueryResponse) => void
	>(() => {});
	const handleStreamResult = useCallback(
		(sessionId: string, messageId: string, result: QueryResponse) =>
			streamResultRef.current(sessionId, messageId, result),
		[],
	);

	// The Models page, opened by the `leftNav` and by its panel.
	const { modelsView, showModelsPage } = useModelsPage(
		graphSlug,
		settingsSection,
		openBoards,
	);

	// The data canvases, the ask, and everything that draws on them.
	const dataBoards = useDataBoards({
		username,
		graphSlug,
		graph,
		sessions,
		activeSession,
		activeSessionId,
		send,
		rerun,
		recordLoad,
		openSession,
		backToList,
		refresh,
		threadWorldId,
		right,
		attachmentDetached,
		cannotAnswer,
		openInspector,
		boardPage,
		setActiveBoardId,
		setWorkKind,
		streamResultRef,
	});
	const { canvas, styling, sessionTitleById, selected } = dataBoards;

	// The `leftSection` region for the open `?panel` key.
	const leftRegion = leftSection({
		username,
		graphSlug,
		settingsPanel,
		closeLeftPanel,
		layered,
		openBoard,
		openLensBoard,
		openWorkPanel,
		openAgentPage,
		showAgentCanvas,
		modelSelection,
		setModelSelection,
		showModelsPage,
		modelName,
		canvas,
		selected,
		styling,
		threadWorldId,
		activeSessionId,
		sessionTitleById,
	});

	const workCanvas = layeredCanvasBody(
		layered,
		username,
		graphSlug,
		openWorkPanel,
	);

	// The pages open in `mainSection`, the active one, and the strip's actions.
	const strip = useOpenPages({
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
	});

	// The right side's occupant, and the header controls and `footer`.
	const regionDeps = {
		username,
		graphSlug,
		right,
		sessionState,
		dataBoards,
		connectionMissing,
		cannotAnswer,
		graphContainer,
		settingsPanel,
		llmProviders,
		attachmentDetached,
		setAttachmentDetached,
		closeInspector,
		modelName,
	};
	const chrome = graphDetailChrome({
		username,
		graphSlug,
		right,
		dataBoards,
		activeSessionId,
		workCanvas,
		workTarget,
	});

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in GraphDetail's header (a sibling of <Board>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
			{/* *Open this board* — for the surfaces that draw a link to one and sit
			    too deep to be handed a callback: a statement in a trace dialog is
			    five components under an assistant turn (RU13). Only the kinds whose
			    whole address is their subject, because the two that read a trace
			    need a `runId` this signature cannot carry (SD3 · B17). */}
			<OpenBoardContext.Provider value={openRecordBoard}>
				<GraphDetail
					// The last crumb is what is open — the canvas you are looking at,
					// named by its session: `ravi › finance › Defence theme — Sep 2026`.
					// There is no screen crumb before it. `Explorer` used to sit there,
					// which named the page after one of its eight `leftNav` items
					// (graph-detail-page.md G15).
					objectLabel={
						activeSessionId ? sessionTitleById.get(activeSessionId) : undefined
					}
					{...chrome}
					leftSection={leftRegion}
					mainSection={{
						defaultSize: "600px",
						minSize: "300px",
						// One host for every kind of page — the strip and the bodies in one
						// component, so the tabs cannot drift from what they switch
						// (graph-detail-page.md G4, the-shell.md).
						content: (
							<ErrorBoundary onError={reportBoundaryError}>
								<BoardPagesViewPanel
									{...strip}
									addLabel="New canvas"
									menuLabel="Page options"
									// Until each canvas owns its own engine, only the active page is
									// mounted — today's behaviour, now stated rather than emergent.
									keepMounted={false}
									className="h-full"
								/>
							</ErrorBoundary>
						),
					}}
					rightSection={rightSection(regionDeps)}
				/>
			</OpenBoardContext.Provider>
		</CanvasContext.Provider>
	);
}
