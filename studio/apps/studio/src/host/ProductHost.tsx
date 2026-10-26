import { CanvasContext } from "@invana/canvas-react";
import { ErrorBoundary, Workbook } from "@invana/ui";
import {
	AgentsOpenContext,
	HomeTiles,
	useAgentsQuery,
	useLLMProvidersQuery,
} from "@invana-studio/agents";
import {
	AssistantReopenPill,
	AssistantSlotsContext,
	AssistantStart,
	useConsoleParam,
	useOpenConsoleOnSettle,
	useSessions,
} from "@invana-studio/assistant";
import type { QueryResponse } from "@invana-studio/core";
import {
	hasOutstandingSetup,
	isGateOpen,
	reportBoundaryError,
	useAuth,
	useGraphConnectionQuery,
	useGraphQuery,
} from "@invana-studio/core";
import { EmptyBoard, ExplorerLocked } from "@invana-studio/explorer";
import { IamHomeTiles, IamOpenContext } from "@invana-studio/iam";
import {
	type ModelSelection,
	useLensesViewPanel,
	useModelsQuery,
	useStitchCrumb,
} from "@invana-studio/modeller";
import {
	parseBoardPageId,
	SetupSlotsContext,
	useActiveProduct,
	useAssistantShown,
	useLeftSection,
	useOnboarding,
	useRightSection,
	useRunStep,
} from "@invana-studio/shell";
import { BoardGround } from "@invana-studio/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router-dom";
import { assistantSlots } from "@/host/assistantSlots";
import { OpenBoardContext } from "@/host/boards";
import { consoleSection } from "@/host/consoleSection";
import { HostLayout } from "@/host/HostLayout";
import { hostChrome } from "@/host/hostChrome";
import { layeredCanvasBody } from "@/host/layeredCanvasBody";
import { leftSection } from "@/host/leftSectionContent";
import { rightSection } from "@/host/rightSections";
import { setupSlots } from "@/host/setupSlots";
import { useAgentsSections } from "@/host/useAgentsSections";
import { useBoardPageTrail } from "@/host/useBoardPageTrail";
import { useDataBoards } from "@/host/useDataBoards";
import { useIamSections } from "@/host/useIamSections";
import { useLayeredCanvas } from "@/host/useLayeredCanvas";
import { useModelsPage } from "@/host/useModelsPage";
import { useOpenBoards } from "@/host/useOpenBoards";
import { GRAPH_PAGE_ID, useOpenPages } from "@/host/useOpenPages";
import { useProjectsPage } from "@/host/useProjectsPage";

/** `invana_neo4j.connector.Neo4jConnector` → `Neo4j`. */
function databaseName(connectorClass: string): string {
	return (
		connectorClass
			.split(".")
			.pop()
			?.replace(/Connector$/, "") || ""
	);
}

/**
 * The line under the centred start: what the Graph is, then what the engine
 * reports of it — its models and whether its database is live. Nothing the
 * engine does not report (there are no record totals on a Graph).
 */
function startSubtitle(
	description: string | null | undefined,
	modelCount: number | undefined,
	connection: { status: string; connector_class: string } | null | undefined,
): string | undefined {
	const db = connection ? databaseName(connection.connector_class) : "";
	const parts = [
		description?.trim() || null,
		modelCount != null
			? `${modelCount} ${modelCount === 1 ? "model" : "models"}`
			: null,
		connection
			? connection.status === "ACTIVE"
				? `live on ${db || "its database"}`
				: `${db || "database"} not reachable`
			: null,
	].filter(Boolean);
	return parts.length ? parts.join(" · ") : undefined;
}

/**
 * The product host — the one page every graph product's routes draw. It owns
 * the state the regions share (the open sessions, the canvas, the declared
 * boards, the layered canvases, the selection) and fills each region for the
 * open product: the Workbook in `mainSection` — in Agents and IAM, their
 * sections as tabs and Home when nothing is open — the product's panel in
 * `leftSection`,
 * the assistant on the right and the Console
 * underneath. The open product is the route's (`useActiveProduct`); the open
 * panel is the path's (`useLeftSection`).
 */

/** The run page tabs that are a canvas. */
const RUN_CANVAS_TABS = new Set(["agents", "stages"]);

export function ProductHost() {
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
	// (setup.md), so a graph with no data can still be explored and queried.
	const { data: graphContainer } = useGraphQuery(username, graphSlug);
	const cannotAnswer =
		!!graphContainer && !isGateOpen(graphContainer, "answering");

	// The home page is the setup board until the Graph is ready, so the
	// page strip and the breadcrumb name what is on it rather than the graph it
	// belongs to.
	const setupOutstanding = hasOutstandingSetup(graphContainer);

	// The Govern panel's own URL keys — `Edit` on a lens board puts the section
	// back on that lens in one write.
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
	// The canvas works in the open thread's world: its restore
	// check, its expansions and its legend read what the thread asks in. No
	// thread open is *Everything*.
	const threadWorldId = world.threadLensId;

	// Who holds the right side — `?right=assistant`, absent means closed. A
	// param, so the region survives a reload.
	const right = useRightSection();
	// The user menu's *Assistant*: off, no product draws the assistant.
	const [assistantShown] = useAssistantShown();
	// The left rail's single-open param. Sessions is no longer one of its keys —
	// it is the `assistant` occupant of the right side (the-assistant.md).
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
	// `&step=` — the task open inside the focused run page.
	const runStep = useRunStep().stepId;

	// The attachment is the canvas selection until someone takes it off — asked
	// without it, and the thread records that.
	const [attachmentDetached, setAttachmentDetached] = useState(false);
	// A node carries the id of the dataset that wrote it; its record card shows the
	// name. One list, cached, rather than a lookup per selection.
	// An element's provenance names the model it conforms to, so the name comes
	// from the models list — there is no second record between a model and its
	// records.
	const modelList = useModelsQuery(username, graphSlug);
	const modelName = useCallback(
		(id: string) => modelList.data?.find((m) => m.id === id)?.name,
		[modelList.data],
	);
	const [modelSelection, setModelSelection] = useState<ModelSelection | null>(
		null,
	);

	const openWorkPanel = useCallback(
		(section: "projects") => settingsPanel.setSection(section),
		[settingsPanel],
	);

	// The agent's page is a declared board in `mainSection`, a tab of its own.
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
	// A project's plan canvas, likewise — the Plan tab draws it in front of
	// the project's page it was opened beside.
	const showPlanCanvas = () => {
		setActiveBoardId(null);
		boardPage.setPageId(null);
		setWorkKind("plan");
	};

	// The open `?panel` key, read in several places below (which canvas kind the
	// panel owns, which panel the left column draws).
	const { section: settingsSection } = settingsPanel;

	const { data: llmProvidersResponse } = useLLMProvidersQuery(
		username,
		graphSlug,
		{ limit: 200 },
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
	// A project's page and the Decisions page, opened by the Projects rail.
	const { openProjectPage, pageTrail: projectTrail } = useProjectsPage(
		username,
		graphSlug,
		settingsSection,
		openBoards,
	);
	// A shared snapshot and a compare open on `?page=` alone, so they name
	// their own place in the trail.
	const boardTrail = useBoardPageTrail(username, graphSlug, boardPage.pageId);
	const pageTrail = projectTrail.length ? projectTrail : boardTrail;
	// A dataset a project cites lives in Datasets, outside the graph's products.
	const navigate = useNavigate();
	const openDataset = useCallback(
		(address: string) =>
			navigate(`/datasets/catalogue/${address.split("@")[0]}`),
		[navigate],
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
		openAgentPage,
		showPlanCanvas,
		modelSelection,
		setModelSelection,
		showModelsPage,
		modelOpen: !!modelsView.scope,
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

	// `?console=` — the console under the data canvas. A query that fails while
	// the page watches opens it on that query, where the failing line is.
	const consoleParam = useConsoleParam();
	const { openData, openQueries } = consoleParam;
	const openConsoleTab = useCallback(
		(tab: "data" | "queries", messageId?: string) =>
			tab === "data" ? openData() : openQueries(messageId),
		[openData, openQueries],
	);
	useOpenConsoleOnSettle(activeSession, consoleParam);

	// The assistant starts centred: with nothing docked on the right and no
	// left panel open — or in the Explorer, which draws no left panel — the
	// home page is one question box. Sending from it docks the conversation on the
	// right as the session's canvas opens. A new session is answered by the
	// Graph's default agent, so the start names it.
	const activeProductId = useActiveProduct()?.id;
	const explorerOpen = activeProductId === "explorer";
	const agentsOpen = activeProductId === "agents";
	const iamOpen = activeProductId === "iam";
	const { pathname } = useLocation();
	const stitchCrumb = useStitchCrumb(
		username,
		graphSlug,
		activeProductId === "modeller" && pathname.endsWith("/global-model"),
	);
	// The products on the Agents shell: sections as tabs, Home, no leftSection.
	const sectionsOpen = agentsOpen || iamOpen;
	const { user } = useAuth();
	const agents = useAgentsQuery(username, graphSlug, { limit: 200 });
	const defaultAgent = agents.data?.items.find(
		(a) => a.id === agents.data?.default_agent_id,
	);
	// Agents' sections, each a tab of the Workbook.
	const agentsSections = useAgentsSections({
		username,
		graphSlug,
		enabled: agentsOpen,
		openBoard,
		boardPage,
		setActiveBoardId,
		activeCanvasId: dataBoards.activeCanvasId,
		workPageId: workCanvas ? layered.workPageId : null,
	});
	// IAM's sections, the same way.
	const iamSections = useIamSections({
		username,
		graphSlug,
		enabled: iamOpen,
		openBoard,
		boardPage,
		setActiveBoardId,
		activeCanvasId: dataBoards.activeCanvasId,
		workPageId: workCanvas ? layered.workPageId : null,
	});
	// The open product's sections; off both, Agents' — which then draw none.
	const sections = iamOpen ? iamSections : agentsSections;
	const graphName = graphContainer?.name ?? graphSlug ?? "";

	// With the assistant docked there is one question box already: Home keeps
	// its tiles and drops its own composer.
	const homeTiles =
		!username || !graphSlug ? null : agentsOpen ? (
			<AgentsOpenContext.Provider value={agentsSections.openers}>
				<HomeTiles username={username} graphSlug={graphSlug} />
			</AgentsOpenContext.Provider>
		) : iamOpen ? (
			<IamOpenContext.Provider value={iamSections.openers}>
				<IamHomeTiles username={username} graphSlug={graphSlug} />
			</IamOpenContext.Provider>
		) : null;
	const homeStart =
		homeTiles && right.is("assistant") ? (
			<BoardGround className="gap-4 p-6">{homeTiles}</BoardGround>
		) : username &&
			graphSlug &&
			!connectionMissing &&
			!right.is("assistant") &&
			(explorerOpen || sectionsOpen || !settingsPanel.isOpen) ? (
			<AssistantStart
				asking={assistantShown}
				username={username}
				graphSlug={graphSlug}
				graphName={graphName}
				// Agents' and IAM's Home are about the product, not the Graph's
				// models, and their asks are not Explorer sessions: no subtitle,
				// recent chips or views.
				subtitle={
					sectionsOpen
						? undefined
						: startSubtitle(
								graphContainer?.description,
								modelList.data?.length,
								graph,
							)
				}
				availableLanguages={dataBoards.availableLanguages}
				defaultLanguage={dataBoards.defaultLanguage}
				llmProviders={llmProviders}
				agentName={defaultAgent?.name ?? null}
				agentStatus={defaultAgent?.status ?? null}
				world={world}
				onManageWorlds={() => settingsPanel.setSection("govern")}
				onRun={(payload) => {
					right.open("assistant");
					void dataBoards.handleRun(payload);
				}}
				onStop={sessionState.stop}
				isRunning={sessionState.isRunning}
				views={(sectionsOpen ? [] : (dataBoards.canvasList?.items ?? [])).map(
					(c) => ({
						id: c.id,
						sessionId: c.sessionId,
						title: c.title || sessionTitleById.get(c.sessionId) || "Untitled",
						pinned: c.pinned,
						updatedAt: c.updatedAt,
					}),
				)}
				onOpenSession={(id) => {
					right.open("assistant");
					dataBoards.handleOpenSession(id);
				}}
				{...(agentsOpen && {
					// The ask is about the product on this Graph, not a query of it.
					context: ["Agents", graphName],
					heading: "What should your agents do?",
					placeholder:
						"Ask about your agents, draft a skill, or open a section…",
					recent: false,
				})}
				{...(iamOpen && {
					context: ["IAM", graphName],
					heading: `Who may do what in ${graphName}?`,
					placeholder: "Ask who can reach something, or draft a policy…",
					recent: false,
					suggestions: [
						"Which agents can write to the graph?",
						"Who can push data?",
						`What can ${user?.username ?? "a member"} do?`,
						"What was refused today?",
					],
				})}
			>
				{homeTiles}
			</AssistantStart>
		) : undefined;

	// The pages open in `mainSection`, the active one, and the strip's actions.
	const strip = useOpenPages({
		username,
		agentsOpeners: agentsSections.openers,
		iamOpeners: iamSections.openers,
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
		sections,
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
	});

	// The pill that reopens a closed conversation floats over the data canvas
	// it belongs to — never over a declared board or the home page.
	const dataBoardInFront = parseBoardPageId(strip.activeId)?.kind === "data";
	// On Agents and IAM, a page in front (a section or a record) is what the
	// pill asks about.
	const agentsPageInFront =
		sectionsOpen && strip.activeId !== sections.homeId
			? strip.pages.find((p) => p.id === strip.activeId)
			: undefined;
	const pill =
		assistantShown &&
		!right.is("assistant") &&
		((dataBoardInFront && activeSessionId) || agentsPageInFront) ? (
			<AssistantReopenPill
				title={
					activeSessionId ? (sessionTitleById.get(activeSessionId) ?? "") : ""
				}
				ask={agentsPageInFront ? String(agentsPageInFront.title) : undefined}
				onOpen={() => right.open("assistant")}
			/>
		) : null;
	// Over a canvas the pill floats; a section page's tables and consoles run
	// to the bottom edge, so there it takes a row of its own under the page. A
	// run's Agents and Stages tabs are canvases, so the pill floats over them.
	const [search] = useSearchParams();
	const runCanvasInFront =
		agentsPageInFront?.id.startsWith("run:") &&
		RUN_CANVAS_TABS.has(search.get("tab") ?? "");
	const pillInRow = Boolean(agentsPageInFront) && !runCanvasInFront;
	const reopenPill =
		pill && !pillInRow ? (
			<div className="absolute right-16 bottom-4 z-10">{pill}</div>
		) : null;
	const reopenRow =
		pill && pillInRow ? (
			<div className="flex shrink-0 justify-end py-2 pr-16">{pill}</div>
		) : null;

	// ⌘J opens or closes the assistant from anywhere on the page.
	const toggleAssistant = right.toggle;
	useEffect(() => {
		if (!assistantShown) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "j") return;
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey)
				return;
			event.preventDefault();
			toggleAssistant("assistant");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [assistantShown, toggleAssistant]);

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
		openConsoleTab,
	};
	const chrome = hostChrome({
		username,
		graphSlug,
		right,
		dataBoards,
		activeSessionId,
		workCanvas,
		workTarget,
		explorer: explorerOpen,
		modeller: activeProductId === "modeller",
		assistantShown,
		connection: graphLoading ? undefined : (graph ?? null),
		dataBoardInFront,
		activeSession,
		console: consoleParam,
	});

	// The Explorer with no canvas open is the centred start alone — no strip,
	// no tabs: one question box on the board's dotted ground. On a Graph that
	// cannot answer yet it is the product's lock instead, naming the step.
	const product = useActiveProduct();
	const explorerLock =
		explorerOpen && graphContainer
			? (product?.gate?.({
					isGateOpen: (g) => isGateOpen(graphContainer, g),
				}) ?? null)
			: null;
	// With the chat docked and nothing drawn yet, the board is its empty
	// ground: one question box on screen, never two.
	// Agents or IAM with nothing open: Home under the strip, no tab lit.
	const agentsHome =
		sectionsOpen && strip.activeId === sections.homeId ? (
			<div className="flex h-full flex-col">
				<Workbook
					{...strip}
					keepMounted={false}
					className="h-auto flex-none"
					bodyClassName="hidden"
				/>
				<div className="min-h-0 flex-1">{homeStart ?? <EmptyBoard />}</div>
			</div>
		) : null;
	const explorerHome = explorerOpen ? (
		explorerLock ? (
			<ExplorerLocked
				lock={explorerLock}
				graphBase={`/u/${username}/${graphSlug}`}
			/>
		) : strip.activeId === GRAPH_PAGE_ID ? (
			(homeStart ?? <EmptyBoard />)
		) : null
	) : null;

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in HostLayout's header (a sibling of <Board>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
			{/* *Open this board* — for the surfaces that draw a link to one and sit
			    too deep to be handed a callback: a statement in a trace dialog is
			    five components under an assistant turn. Only the kinds whose
			    whole address is their subject, because the two that read a trace
			    need a `runId` this signature cannot carry. */}
			<OpenBoardContext.Provider value={openRecordBoard}>
				{/* What the assistant borrows from this page — banners, boards,
				    worlds, a step's rules. */}
				<AssistantSlotsContext.Provider value={assistantSlots}>
					{/* What setup borrows from this page — the skip write and the
					    left section. */}
					<SetupSlotsContext.Provider value={setupSlots}>
						<HostLayout
							// The last crumb is what is open — the canvas you are looking at,
							// named by its session: `ravi › finance › Defence theme — Sep 2026`.
							// There is no screen crumb before it. `Explorer` used to sit there,
							// which named the page after one of its eight `leftNav` items
							// (graph-detail-page.md).
							// On LLMs, the open endpoint is named by its name, not its id.
							objectLabel={
								agentsSections.endpointId
									? llmProviders.find((p) => p.id === agentsSections.endpointId)
											?.name
									: stitchCrumb
										? stitchCrumb
										: activeSessionId
											? sessionTitleById.get(activeSessionId)
											: undefined
							}
							// A project's page names its own levels: Projects › the project
							// › its branch › the finding.
							pageTrail={pageTrail}
							{...chrome}
							leftSection={leftRegion}
							mainSection={{
								// One host for every kind of page — the strip and the bodies in one
								// component, so the tabs cannot drift from what they switch
								// (graph-detail-page.md the-shell.md).
								content: (
									<ErrorBoundary key="workbook" onError={reportBoundaryError}>
										{agentsHome ?? explorerHome ?? (
											<div className="flex h-full flex-col">
												<div className="relative min-h-0 flex-1">
													<Workbook
														{...strip}
														// Until each canvas owns its own engine, only the active page is
														// mounted — today's behaviour, now stated rather than emergent.
														keepMounted={false}
														className="h-full"
													/>
													{reopenPill}
												</div>
												{reopenRow}
											</div>
										)}
									</ErrorBoundary>
								),
							}}
							rightSection={
								// Switched off in the user menu, the right side holds nothing,
								// whatever `?right=` says.
								assistantShown ? rightSection(regionDeps) : undefined
							}
							bottomSection={consoleSection({
								username,
								graphSlug,
								console: consoleParam,
								sessionState,
								dataBoards,
								dataBoardInFront,
								onOpenRun: (runId, stepId) =>
									openBoard({ kind: "run", subjectId: runId, runId, stepId }),
							})}
						/>
					</SetupSlotsContext.Provider>
				</AssistantSlotsContext.Provider>
			</OpenBoardContext.Provider>
		</CanvasContext.Provider>
	);
}
