import { LayeredCanvasStatus } from "@/canvases/layered/LayeredCanvasChrome";
import { attachmentFor } from "@/pages/graphs-detail/features/assistant/SessionComposer";
import { useSessions } from "@/pages/graphs-detail/features/assistant/useSessions";
import { boardPageId } from "@/pages/graphs-detail/features/boards";
import { OpenBoardContext } from "@/pages/graphs-detail/features/boards";
import { ExplorerHeaderToolbar } from "@/pages/graphs-detail/features/explorer";
import { InspectorViewPanel } from "@/pages/graphs-detail/features/explorer";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "@/pages/graphs-detail/features/graphs/queries";
import {
	hasOutstandingSetup,
	isGateOpen,
} from "@/pages/graphs-detail/features/graphs/types";
import { useLLMProvidersQuery } from "@/pages/graphs-detail/features/llms/queries";
import {
	type ModelSelection,
	useModelsView,
} from "@/pages/graphs-detail/features/models";
import { useModelsQuery } from "@/pages/graphs-detail/features/models/queries";
import { useTaskPlansQuery } from "@/pages/graphs-detail/features/plans/queries";
import { useRunStep } from "@/pages/graphs-detail/features/runs/boards";
import { useOnboarding } from "@/pages/graphs-detail/features/setup/useOnboarding";
import { AssistantHost } from "@/pages/graphs-detail/shell/AssistantHost";
import { GraphDetail } from "@/pages/graphs-detail/shell/GraphDetail";
import { layeredCanvasBody } from "@/pages/graphs-detail/shell/layeredCanvasBody";
import { leftSectionContent } from "@/pages/graphs-detail/shell/leftSectionContent";
import { useDataBoards } from "@/pages/graphs-detail/shell/useDataBoards";
import { useLayeredCanvas } from "@/pages/graphs-detail/shell/useLayeredCanvas";
import { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import { useLensesViewPanel } from "@/pages/graphs-detail/shell/useLensesViewPanel";
import { useOpenBoards } from "@/pages/graphs-detail/shell/useOpenBoards";
import { useOpenPages } from "@/pages/graphs-detail/shell/useOpenPages";
import {
	type RightSectionKey,
	useRightSection,
} from "@/pages/graphs-detail/shell/useRightSection";
import { reportBoundaryError } from "@/services/telemetry/errors";
import type { QueryResponse } from "@/types/query";
import { CanvasContext } from "@invana/canvas-react";
import {
	BoardPagesViewPanel,
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
} from "@invana/canvas-ui";
import { Button, ErrorBoundary, cn } from "@invana/ui";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

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
	// And the plan page for a library plan (LB24): keyed by `task_plans.id`,
	// titled `key@version`, and opened from the section by key — the newest
	// version, which is the one the section reads.
	const planLibrary = useTaskPlansQuery(username, graphSlug);
	const planRefById = useMemo(
		() =>
			new Map(
				(planLibrary.data?.items ?? []).map((p) => [
					p.id,
					`${p.key}@${p.version}`,
				]),
			),
		[planLibrary.data],
	);
	const newestPlanIdByKey = useMemo(() => {
		const out = new Map<string, { id: string; version: number }>();
		for (const p of planLibrary.data?.items ?? []) {
			const seen = p.key ? out.get(p.key) : undefined;
			if (p.key && (!seen || p.version > seen.version))
				out.set(p.key, { id: p.id, version: p.version });
		}
		return out;
	}, [planLibrary.data]);

	const {
		sessions,
		activeSession,
		activeSessionId,
		isRunning,
		isRefreshing,
		sort,
		setSort,
		showArchived,
		setShowArchived,
		send,
		rerun,
		recordLoad,
		fetchContext,
		setFeedback,
		stop,
		refresh,
		setPinned,
		setArchived,
		renameSession,
		world,
		setSpendPerRun,
		openSession,
		backToList,
	} = useSessions(username, graphSlug, {
		onResult: ({ sessionId, messageId, result }) =>
			handleStreamResult(sessionId, messageId, result),
	});
	// The canvas works in the open thread's world (AS5 · AD15): its restore
	// check, its expansions and its legend read what the thread asks in. No
	// thread open is *Everything*.
	const threadWorldId = world.threadLensId;

	// Page state lives in the URL, one param per region (graph-detail-page.md
	// G16). `setSearchParams` is here for the one-write legacy migration below;
	// each region reads and writes its own param through its own hook.
	const [, setSearchParams] = useSearchParams();
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
	const openBoards = useOpenBoards(username, graphSlug, newestPlanIdByKey);
	const {
		setBoards,
		setActiveBoardId,
		boardPage,
		openBoard,
		openRecordBoard,
		openLensBoard,
	} = openBoards;
	// `&step=` — the task open inside the focused run page (SR72).
	const runStep = useRunStep().stepId;

	// Which model the Model panel has open, and which of its types is selected —
	// the selection drives the form that spans the main column (model-editor.md ME6).
	// Sessions used to be a left-rail panel. Links carrying `?panel=sessions`
	// (and `?panel=messages`, which aliases onto it) still exist, so honour
	// them where the panel actually lives now: open the assistant, drop the rail
	// key. One write, not two — `settingsPanel.close()` followed by
	// `right.open("assistant")` would each rebuild the query string from its own
	// snapshot, the second restoring the key the first removed, and the effect
	// would fire forever on the URL it just wrote.
	const staleSessionsKey =
		settingsPanel.isOpen && settingsPanel.section === "sessions";
	useEffect(() => {
		if (!staleSessionsKey) return;
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.delete("settings");
				if (!next.has("right")) next.set("right", "assistant");
				return next;
			},
			{ replace: true },
		);
	}, [staleSessionsKey, setSearchParams]);
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

	/**
	 * **Models is one page** (the-model-page.md MP1 · MP18): switching the
	 * `leftNav` to Models opens the `models` board, whatever the scope. It fires
	 * on the transition into the panel and nothing else, so closing the page with
	 * its X while the panel is open leaves it closed — a page that reopened
	 * itself would be a page you cannot close.
	 */
	const modelsView = useModelsView().view;
	const openModelsPage = useCallback(() => {
		if (graphSlug) openBoard({ kind: "models", subjectId: graphSlug });
	}, [openBoard, graphSlug]);
	// The panel brings the board forward and names it in the URL in the same
	// write as the scope it picked, so this only touches the strip.
	const showModelsPage = useCallback((): Record<string, string | null> => {
		const id = graphSlug ? boardPageId("models", graphSlug) : null;
		if (!id || !graphSlug) return {};
		setBoards((open) =>
			open.some((b) => b.kind === "models" && b.subjectId === graphSlug)
				? open
				: [...open, { kind: "models", subjectId: graphSlug }],
		);
		setActiveBoardId(id);
		return { page: id, step: null };
	}, [graphSlug, setActiveBoardId, setBoards]);
	const wasModels = useRef(false);
	useEffect(() => {
		const isModels = settingsSection === "model";
		if (isModels && !wasModels.current) openModelsPage();
		wasModels.current = isModels;
	}, [settingsSection, openModelsPage]);

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
	const {
		resultsByMessageId,
		canvas,
		magnet,
		toggleMagnet,
		backend,
		canvasData,
		styling,
		missingIds,
		setBackend,
		bannerCanvasIdBySession,
		sessionTitleById,
		selected,
		availableLanguages,
		defaultLanguage,
		handleOpenSession,
		handleLoadToCanvasClick,
		handleRun,
		handleRerun,
		handleBack,
	} = dataBoards;

	// The assistant, as the right side's `assistant` occupant. Its close closes
	// the region.
	const assistantContent = (
		<AssistantHost
			connectionMissing={connectionMissing}
			cannotAnswer={cannotAnswer}
			graph={graphContainer}
			world={world}
			onManageWorlds={() => settingsPanel.setSection("govern")}
			availableLanguages={availableLanguages}
			defaultLanguage={defaultLanguage}
			llmProviders={llmProviders}
			onRun={handleRun}
			onStop={stop}
			isRunning={isRunning}
			sessions={sessions}
			activeSession={activeSession}
			username={username}
			graphSlug={graphSlug}
			bannerCanvasIdBySession={bannerCanvasIdBySession}
			onOpenSession={handleOpenSession}
			onBack={handleBack}
			onRerun={handleRerun}
			onFetchContext={fetchContext}
			onSetFeedback={setFeedback}
			results={resultsByMessageId}
			onLoadToCanvas={handleLoadToCanvasClick}
			onRefresh={refresh}
			isRefreshing={isRefreshing}
			onClose={right.close}
			// The chip rides above the composer's input, not above the panel
			// (the-assistant.md AD10).
			attachment={attachmentDetached ? null : attachmentFor(selected)}
			onRemoveAttachment={() => setAttachmentDetached(true)}
			sort={sort}
			onSortChange={setSort}
			showArchived={showArchived}
			onShowArchivedChange={setShowArchived}
			onPin={setPinned}
			onArchive={setArchived}
			onSetSpendPerRun={setSpendPerRun}
		/>
	);

	// The occupants of `rightSection`, keyed by `?right=`. Inspecting and asking
	// stopped competing for the side the moment one param named which of them
	// holds it; closing it closes the region rather than restoring the other
	// (the-assistant.md AD11).
	const rightSections: Record<
		RightSectionKey,
		{
			defaultSize: string;
			minSize: string;
			maxSize: string;
			collapsible: boolean;
			content: ReactNode;
		}
	> = {
		assistant: {
			defaultSize: "360px",
			minSize: "300px",
			maxSize: "560px",
			collapsible: false,
			content: assistantContent,
		},
		inspector: {
			defaultSize: "280px",
			minSize: "240px",
			maxSize: "360px",
			collapsible: false,
			content: (
				<InspectorViewPanel
					selected={selected}
					allItems={canvasData}
					missingIds={missingIds}
					onClose={closeInspector}
					modelName={modelName}
					onOpenModel={() => {
						// A node's provenance line opens the journal that holds the run
						// that wrote it — the Runs panel, not an Imports panel of its own
						// (SR7 · G41). There is no model facet to narrow to: the journal
						// is filtered by kind, never by subject.
						settingsPanel.setSection("runs");
					}}
				/>
			),
		},
	};

	// One rail, one page: the `leftSection` occupant for the open `?panel` key.
	const leftContent = leftSectionContent({
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
					// One assistant, reachable from every surface (AD1). The trigger sits
					// in the header's panel controls, after fullscreen — a persistent
					// control, so it keeps one name wherever you are.
					headerPanelControls={
						<Button
							variant="ghost"
							size="icon"
							className={cn("h-7 w-7", right.is("assistant") && "text-primary")}
							onClick={() => right.toggle("assistant")}
							title={
								right.is("assistant") ? "Close the assistant" : "Ask about this"
							}
						>
							<Sparkles className="h-4 w-4" />
						</Button>
					}
					headerCenter={
						canvas && activeSessionId ? (
							// The canvas toolbar reads the live camera; it only initialises
							// correctly mounted in the app header (in the main-section tab bar
							// the camera reads null and `HeaderToolbarItems` throws). It sits
							// directly above the canvas tabs. Dead-centre it against the full
							// header width (the header nav is `relative`; see useAppHeader).
							<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
								<ExplorerHeaderToolbar
									magnet={magnet}
									onToggleMagnet={toggleMagnet}
									backend={backend}
									onBackendChange={setBackend}
								/>
							</div>
						) : undefined
					}
					// One column, one open `?panel` key. With no key open — or one this
					// page draws nothing for — there is no left column at all.
					leftSection={
						leftContent
							? {
									// Generous max so long Cypher/Gremlin queries can spread out.
									// mainSection.minSize below still keeps the canvas usable when
									// the user drags the divider far right.
									defaultSize: "300px",
									minSize: "240px",
									maxSize: "900px",
									collapsible: false,
									// A broken panel shows the kit's notice in its column and
									// is reported; opening another panel starts it afresh.
									content: (
										<ErrorBoundary
											key={settingsPanel.section}
											onError={reportBoundaryError}
										>
											{leftContent}
										</ErrorBoundary>
									),
								}
							: undefined
					}
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
					// One region, one occupant, looked up by `?right=`. A third occupant
					// is one more entry here — not another branch (graph-detail-page.md
					// G16). Each entry carries its own size triple, because the size
					// belongs to what is in the region rather than to the region.
					rightSection={
						right.key
							? {
									...rightSections[right.key],
									content: (
										<ErrorBoundary
											key={right.key}
											onError={reportBoundaryError}
										>
											{rightSections[right.key].content}
										</ErrorBoundary>
									),
								}
							: undefined
					}
					statusMetrics={
						// Live engine telemetry — node/edge totals, zoom, pan, pointer world
						// position, hovered node/edge, selection counts — self-wired off the
						// lifted CanvasContext (same status bar as the canvas-react story).
						// A work canvas has no engine, so it states what it *is* instead:
						// `LIBRARY · 8 steps · 3 agents`.
						workCanvas && workTarget ? (
							<LayeredCanvasStatus
								username={username as string}
								graphSlug={graphSlug as string}
								target={workTarget}
							/>
						) : canvas && activeSessionId ? (
							<CanvasStatusBar />
						) : null
					}
					// The shared message bar — shows whatever was last pushed via
					// Board.showMessage (e.g. a layout's "Running… / ready"); empty when idle.
					footerRightExtras={
						canvas && activeSessionId ? <CanvasMessageBar /> : null
					}
				/>
			</OpenBoardContext.Provider>
		</CanvasContext.Provider>
	);
}
