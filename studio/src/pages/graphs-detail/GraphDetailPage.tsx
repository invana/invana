import { useCreateCanvasStateMutation } from "@/hooks/queries/useBoardVersions";
import {
	useBoardsQuery,
	useCreateCanvasMutation,
	useUpdateCanvasMutation,
} from "@/hooks/queries/useBoards";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "@/hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "@/hooks/queries/useLLMProviders";
import { useModelsQuery } from "@/hooks/queries/useModels";
import { useActiveVersionQuery } from "@/hooks/queries/useSchema";
import { useTaskMutations } from "@/hooks/queries/useWork";
import { AgentsPanel } from "@/pages/graphs-detail/features/agents/AgentsPanel";
import { AssistantPanel } from "@/pages/graphs-detail/features/ask/assistant/AssistantPanel";
import { attachmentFor } from "@/pages/graphs-detail/features/ask/assistant/SessionComposer";
import {
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
} from "@/pages/graphs-detail/features/ask/assistant/SessionTutorialModal";
import { useSessions } from "@/pages/graphs-detail/features/ask/assistant/useSessions";
import {
	BOARD_KINDS,
	CANVAS_KINDS,
	type CanvasKind,
	type DeclaredKind,
	boardPageId,
	declaredPage,
	parseBoardPageId,
} from "@/pages/graphs-detail/features/boards";
import {
	STATE_THUMB_MAX_EDGE,
	captureBanner,
} from "@/pages/graphs-detail/features/boards";
import { useBoardVersions } from "@/pages/graphs-detail/features/boards";
import {
	type BoardPageHandle,
	DataBoardPage,
} from "@/pages/graphs-detail/features/boards";
import {
	AllModelsCanvas,
	GlobalModelPage,
	ModelCanvas,
	ModelPanel,
	type ModelSelection,
} from "@/pages/graphs-detail/features/connect-and-model";
import { ExplorerTypesPanel } from "@/pages/graphs-detail/features/explorer";
import {
	ACTIVE_LAYOUT_ID,
	type CanvasBackend,
	type ExpandMenuSchema,
	ExplorerHeaderToolbar,
} from "@/pages/graphs-detail/features/explorer";
import { InspectorPanel } from "@/pages/graphs-detail/features/explorer";
import type { StyleTypeInfo } from "@/pages/graphs-detail/features/explorer";
import { useExpandNode } from "@/pages/graphs-detail/features/explorer";
import { RunsPanel } from "@/pages/graphs-detail/features/operate/RunsPanel";
import {
	RunDashboardPage,
	StepDashboardPage,
} from "@/pages/graphs-detail/features/operate/dashboards";
import { SetupLock } from "@/pages/graphs-detail/features/setup/SetupLock";
import { useOnboarding } from "@/pages/graphs-detail/features/setup/useOnboarding";
import { SkillsPanel } from "@/pages/graphs-detail/features/skills/SkillsPanel";
import { ProjectsStackPanel } from "@/pages/graphs-detail/features/work/ProjectsStackPanel";
import {
	EnvelopeCanvas,
	LineageCanvas,
	PlanCanvas,
	WorkflowCanvas,
} from "@/pages/graphs-detail/features/work/WorkCanvas";
import {
	WorkCanvasHeader,
	WorkCanvasStatus,
	type WorkCanvasTarget,
} from "@/pages/graphs-detail/features/work/WorkCanvasChrome";
import { LibraryStackPanel } from "@/pages/graphs-detail/features/workflows/LibraryStackPanel";
import { GraphDetail } from "@/pages/graphs-detail/shell/GraphDetail";
import { GraphHomePage } from "@/pages/graphs-detail/shell/GraphHomePage";
import { useOpenSessionRequest } from "@/pages/graphs-detail/shell/useOpenSessionRequest";
import {
	type RightSectionKey,
	useRightSection,
} from "@/pages/graphs-detail/shell/useRightSection";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import { boardVersionsApi } from "@/services/api/boardVersions";
import { boardsApi } from "@/services/api/boards";
import { ApiError } from "@/services/api/client";
import { explorerApi } from "@/services/api/explorer";
import { sessionsApi } from "@/services/api/sessions";
import { workflowsApi } from "@/services/api/work";
import {
	type Interaction,
	type SpanAttributes,
	endInteraction,
	measureSync,
	startInteraction,
	withInteraction,
} from "@/services/telemetry/tracer";
import type { Board, BoardVersionCause, CanvasStyling } from "@/types/board";
import {
	type QueryLanguage,
	hasOutstandingSetup,
	isGateOpen,
} from "@/types/graphs";
import type {
	QueryResponse,
	QueryResultItem,
	QueryRunPayload,
} from "@/types/query";
import type { SessionMessage } from "@/types/session";
import type { ExpandRequest, NeighborExpandResponse } from "@/types/traversal";
import type { AgentEdge } from "@/types/work";
import type { CanvasStateSnapshot } from "@invana/canvas";
import { CanvasContext, canUseWebGPU } from "@invana/canvas-react";
import {
	type BoardHeaderAction,
	type BoardPage as BoardPageDef,
	BoardPagesViewPanel,
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
} from "@invana/canvas-ui";
import type {
	GraphData as EngineGraphData,
	GraphCanvas,
	GraphLayer,
} from "@invana/graph";
import { Button, cn } from "@invana/ui";
import {
	Boxes,
	HelpCircle,
	History,
	Home,
	Layers,
	LayoutGrid,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Route,
	SlidersHorizontal,
	Sparkles,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

/** The page that is always open and can never be closed (graph-detail-page.md G6). */
const GRAPH_PAGE_ID = "graph";

/**
 * A declared board the tab strip is holding open.
 *
 * `subjectId` is the record every panel on it binds to — a run's id, or one
 * attempt of a task — and `runId` is the trace both kinds read, which is why a
 * step board carries it rather than fetching its own
 * (see-what-ran.md SR30 · SR36).
 */
interface OpenBoard {
	kind: DeclaredKind;
	subjectId: string;
	runId: string;
}

/** The derived union (stitch-models.md ST3) — a page, owned by no model. */
const GLOBAL_MODEL_PAGE_ID = "global-model";

/** Every model on one canvas (stitch-models.md ST14) — also owned by no model. */
const ALL_MODELS_PAGE_ID = "all-models";

// Fallback when the engine hasn't reported any query languages yet (e.g. the
// connector class couldn't be loaded server-side). Studio shows both rather
// than blocking the user.
const FALLBACK_QUERY_LANGUAGES: readonly QueryLanguage[] = [
	"cypher",
	"gremlin",
];

/**
 * A saved canvas state, as the engine will accept it. `canvas_states.snapshot`
 * is `Record<string, unknown>` on the wire, so this is the one place the shape
 * is established — the envelope only, since the engine validates the rest.
 */
function isCanvasStateSnapshot(
	value: Record<string, unknown>,
): value is Record<string, unknown> & CanvasStateSnapshot {
	return (
		typeof value.version === "number" &&
		typeof value.view === "object" &&
		value.view !== null &&
		typeof value.data === "object" &&
		value.data !== null
	);
}

// localStorage key persisting the user's render-backend choice across reloads.
const BACKEND_STORAGE_KEY = "explorer.canvas.backend";

// Banner capture (a GPU image export) isn't free, so it's throttled: at most one
// fresh capture per this window. Also the cadence of the periodic autosave that
// keeps the sessions-list preview current (docs/for-developers/modules/explore/features/boards.md Part A).
const BANNER_MIN_INTERVAL_MS = 10_000;

// Map query-result items (vertices / edges) to the canvas engine's GraphData
// shape: the label rides as `type` (colour-by-label + the Inspector's Type row)
// and the properties as `data`. Shared by the full-paint seed and the
// incremental node-expand append (docs/for-developers/modules/explore/features/graph-canvas.md).
function adaptItems(items: QueryResultItem[]): EngineGraphData {
	const nodes: EngineGraphData["nodes"] = [];
	const edges: EngineGraphData["edges"] = [];
	for (const item of items) {
		if (item.type === "vertex") {
			nodes.push({
				id: String(item.id),
				type: item.label,
				data: item.properties,
			});
		} else if (item.type === "edge") {
			edges.push({
				id: String(item.id),
				source: String(item.source),
				target: String(item.target),
				type: item.label,
				data: item.properties,
			});
		}
	}
	return { nodes, edges };
}

// Dedupe a graph query result into canvas items (vertices + edges), keeping the
// first occurrence of each id — the same normalization `paintCanvas` does, reused
// to seed a new canvas's snapshot. Empty for a non-graph / null result.
function resultToItems(result: QueryResponse | null): QueryResultItem[] {
	if (result?.result_type !== "graph" || !result.data) return [];
	const nodeMap = new Map<string, QueryResultItem>();
	for (const n of result.data.nodes) {
		const id = String(n.id);
		if (!nodeMap.has(id)) nodeMap.set(id, { ...n, type: "vertex" });
	}
	const edgeMap = new Map<string, QueryResultItem>();
	for (const e of result.data.edges) {
		const id = String(e.id);
		if (!edgeMap.has(id)) edgeMap.set(id, { ...e, type: "edge" });
	}
	return [...nodeMap.values(), ...edgeMap.values()];
}

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
		openSession,
		backToList,
	} = useSessions(username, graphSlug, {
		onResult: ({ sessionId, messageId, result }) =>
			handleStreamResult(sessionId, messageId, result),
	});

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
	const settingsPanel = useSettingsPanel();
	const closeLeftPanel = settingsPanel.close;

	// ── S12 surfaces (docs/for-developers/modules/work/spec.md) ────────────────────────────────────────────────
	//
	// One piece of state per noun, held here rather than in each panel, because
	// the panel and the canvas are two views of the same selection: clicking a
	// task on the Plan canvas has to light the Plan tab's row, and clicking an
	// agent node on a lineage has to light the roster.
	const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(
		null,
	);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
	const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<string | null>(
		null,
	);
	const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
	const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
	const [selectedLineageEdge, setSelectedLineageEdge] =
		useState<AgentEdge | null>(null);
	// Which of the six kinds the main area is drawing. `data` is the canvas the
	// Explorer has always shown; the rest are opened from their panel.
	const [workKind, setWorkKind] = useState<CanvasKind | null>(null);
	// The **declared** boards that are open — a run dashboard, and a step's
	// (see-what-ran.md SR36). They are pages like any other, keyed
	// `<kind>:<subject_id>`, so the tab strip carries them beside the canvases
	// and `More` opens one rather than growing the drawer (SR13 · CV14).
	const [boards, setBoards] = useState<OpenBoard[]>([]);
	const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

	// Opening a board focuses it, the way opening a canvas focuses that tab.
	const openBoard = useCallback((board: OpenBoard) => {
		const id = boardPageId(board.kind, board.subjectId);
		setBoards((open) =>
			open.some((b) => b.subjectId === board.subjectId)
				? open
				: [...open, board],
		);
		setActiveBoardId(id);
	}, []);
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
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
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
	// A dependency that would close a loop comes back as a 422 naming it; the
	// canvas shows that rather than drawing anything (docs/for-developers/modules/work/spec.mda).
	const [planError, setPlanError] = useState<string | null>(null);
	const taskMutations = useTaskMutations(username ?? "", graphSlug ?? "");

	const openWorkPanel = useCallback(
		(section: "projects" | "runs" | "library" | "agents" | "skills") => {
			settingsPanel.setSection(section);
		},
		[settingsPanel],
	);

	// The open `?panel` key, read in several places below (which canvas kind the
	// panel owns, which panel the left column draws).
	const { section: settingsSection } = settingsPanel;

	/**
	 * **The main area is always a canvas, and it belongs to the open panel.**
	 *
	 * Every work panel owns a kind, and selecting a row is the gesture that opens
	 * it — there is no separate "draw it" step to discover. Before this, picking a
	 * project left the main area on the Explorer's placeholder, so four of the six
	 * kinds were reachable only through a button most people never pressed.
	 *
	 * Two rules keep it predictable:
	 *
	 * - **A canvas is replaced only by its own panel's kind.** Switching from
	 *   Projects to Agents swaps the plan for the lineage, because a plan drawn
	 *   under the agent roster answers a question nobody asked. But switching
	 *   between an agent's *envelope* and its *lineage* — both `agents` — is the
	 *   panel's own choice and is left alone, which is what lets the Agent
	 *   surface's tabs drive the canvas.
	 * - **It never closes one.** Closing is the tab's X; a click that silently
	 *   threw away what you were looking at would make the canvas feel unstable.
	 *
	 * `skills` is deliberately absent: a skill hangs over the work rather than
	 * having a shape, so its panel opens beside whatever canvas is already there.
	 */
	useEffect(() => {
		// The kind this panel would draw, given what is selected in it.
		const own: CanvasKind | null =
			// Projects owns both drawers, so it owns the `plan` canvas whether the
			// project or one of its Todos is what was picked (PT7).
			settingsSection === "projects" && selectedProjectKey
				? "plan"
				: // Library owns the Plans drawer, so the plan flow is its canvas (G41).
					settingsSection === "library" && selectedWorkflowKey
					? "workflow"
					: settingsSection === "agents" && selectedAgentId
						? "lineage"
						: null;
		if (!own) return;
		setWorkKind((current) => {
			if (!current) return own;
			// Already showing something this panel owns — leave the panel's own
			// choice (envelope vs lineage) alone.
			const owner = CANVAS_KINDS[current].panel;
			return owner === settingsSection ? current : own;
		});
	}, [
		settingsSection,
		selectedProjectKey,
		selectedWorkflowKey,
		selectedAgentId,
	]);
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

	// Full current canvas contents — drives the Inspector (`allItems` / `selected`)
	// and the seed re-fed to a freshly-mounted canvas (e.g. on a backend remount).
	// A fresh query *replaces* it; a node-expand *appends* to it (docs/for-developers/modules/explore/features/graph-canvas.md).
	// Held per canvas by `useBoardVersions` (below), not per page — a second
	// canvas can hold its own contents at the same time. Resolved against the
	// active one, so every caller below reads and writes exactly as before.
	// Elements the graph no longer holds, found when the canvas reopened (GC5).
	// Kept as ids rather than removed from `canvasData`, because the point is that
	// they are still drawn.

	const canvasDataRef = useRef<QueryResultItem[]>([]);

	// What `<GraphLayer data>` is seeded/replaced with. Its *reference* only changes
	// on a full repaint (fresh query / load-to-canvas / restore) or a backend
	// remount — never on a node-expand, which appends straight to the live store
	// (the non-destructive path) so existing node positions survive. Re-feeding the
	// whole dataset here would call the destructive `setData`, wiping every position
	// and re-laying the graph out from the origin on each expand.

	// Per-message query results (docs/for-developers/modules/ask/features/the-answer-surface.md): transient, keyed by assistant message
	// id, populated on send/rerun and rendered inline in the thread.
	const [resultsByMessageId, setResultsByMessageId] = useState<
		Record<string, QueryResponse | null>
	>({});
	const setResultFor = useCallback(
		(messageId: string, result: QueryResponse | null) =>
			setResultsByMessageId((prev) => ({ ...prev, [messageId]: result })),
		[],
	);
	// Sessions whose first result should open + paint their new canvas, and
	// replies whose re-run result should repaint (the restore path). Registered
	// when the run starts; consumed when the result lands on the stream.
	const pendingNewSessionsRef = useRef<Set<string>>(new Set());
	const pendingRestorePaintRef = useRef<Set<string>>(new Set());
	// Latest handlers for the stream callback (wired once in useSessions).
	const streamResultRef = useRef<
		(sessionId: string, messageId: string, result: QueryResponse) => void
	>(() => {});
	const handleStreamResult = useCallback(
		(sessionId: string, messageId: string, result: QueryResponse) =>
			streamResultRef.current(sessionId, messageId, result),
		[],
	);

	// Root span for the in-flight query run (docs/for-developers/modules/platform/features/telemetry.md). Held in a ref so the
	// transform / adapt / layout / render stages — which span several async
	// renders — all attach to the same trace. Set in `handleRun`, closed by the
	// canvas's layout bridge after the first painted frame.
	const runRef = useRef<Interaction | null>(null);

	// The live canvas engine, lifted out of <Board> by <CanvasBridge>. Null until
	// the graph is fully wired; gates the header toolbar that depends on it.
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const handleReady = useCallback((c: GraphCanvas | null) => setCanvas(c), []);

	// Magnet toggle → hover neighbour radius. On (default): hovering a node lights
	// up its 1st-degree neighbours; off: only the hovered node lights up.
	const [magnet, setMagnet] = useState(true);
	const toggleMagnet = useCallback(() => setMagnet((m) => !m), []);

	// Render backend (PixiJS). Defaults to WebGPU when the device can select it
	// (`canUseWebGPU` — API present and not WebKit), else WebGL. The header switcher
	// lets a user pin WebGL explicitly; the choice persists across reloads. The
	// engine itself downgrades/retries to WebGL at init if WebGPU can't actually
	// initialise (e.g. a blocklisted adapter), so no runtime fallback is needed here.
	const [backend, setBackendState] = useState<CanvasBackend>(() => {
		const saved = localStorage.getItem(BACKEND_STORAGE_KEY);
		if (saved === "webgl") return "webgl";
		return canUseWebGPU() ? "webgpu" : "webgl";
	});

	// Toggling the left column no longer remounts the canvas: GraphDetail keeps the
	// main (canvas) panel mounted at a stable position and renders the sidebar as a
	// conditional sibling, so the live store — positions and all — survives a panel
	// open/close. No reseed is needed here (an unconditional reseed would itself
	// re-feed `<GraphLayer data>` and force a destructive relayout on every toggle,
	// which is exactly the jump this avoids). Only genuine remounts — the
	// backend switch above, which keys `ExplorerCanvas` on `backend` — reseed.

	// Open canvas tabs (docs/for-developers/modules/explore/features/boards.md) — the main-section tab strip. Each tab is a
	// canvas backed 1:1 by a session; a tab is "active" when its backing session
	// is the active query session, so switching tabs switches the session too and
	// new queries belong to that canvas. `activeCanvasId` is therefore derived.
	// A tab is a canvas bound 1:1 to a session; its label is the session's title
	// (docs/for-developers/modules/explore/features/graph-canvas.md), read live from `sessionTitleById` — so the tab holds no title of
	// its own.
	const [openTabs, setOpenTabs] = useState<{ id: string; sessionId: string }[]>(
		[],
	);
	// The active canvas page's handle. The strip's help / styling / history /
	// rename buttons act on *this* canvas, but `BoardHeaderAction` carries no
	// page id (graph-detail-page.md G12), so the shell calls into the page
	// rather than passing one.
	const boardPageRef = useRef<BoardPageHandle>(null);

	// The derived union, as a page. It belongs to no single model, so it is not a
	// section in any model's panel (stitch-models.md · Surfaces).
	const [globalModelOpen, setGlobalModelOpen] = useState(false);
	// Every model on one canvas. It is not opened by a button any more: the
	// Models panel's *list* view is the landscape, so switching the `leftNav` to
	// Models draws it (stitch-models.md ST24).
	const [allModelsOpen, setAllModelsOpen] = useState(false);
	/**
	 * **Models, with nothing selected, is the landscape** (stitch-models.md ST24).
	 *
	 * The same rule the work panels follow — the main area belongs to the open
	 * panel — applied to models: the list view's canvas is *All models*, and a
	 * model's detail view's canvas is that model. So switching the `leftNav` to
	 * Models opens the landscape, and coming back to the list from a model
	 * returns to it.
	 *
	 * It fires on the two transitions that change the answer and nothing else, so
	 * closing the page with its X while the list is open leaves it closed — a page
	 * that reopened itself would be a page you cannot close.
	 */
	useEffect(() => {
		if (settingsSection !== "model" || selectedModelId) return;
		setAllModelsOpen(true);
	}, [settingsSection, selectedModelId]);
	const createCanvas = useCreateCanvasMutation(username ?? "", graphSlug ?? "");
	// Version history (docs/for-developers/modules/explore/features/boards.md): capture a state after each canvas-mutating turn,
	// and fork a chosen state into a new canvas to "go back in time".
	const createCanvasState = useCreateCanvasStateMutation(
		username ?? "",
		graphSlug ?? "",
	);
	// Used to refresh a canvas' sessions-list banner (and invalidate its cached
	// preview) whenever we capture a new history state — so the banner always
	// shows the latest image (docs/for-developers/modules/explore/features/boards.md).
	const updateCanvas = useUpdateCanvasMutation(username ?? "", graphSlug ?? "");
	const [isRestoring, setIsRestoring] = useState(false);
	// Session tutorial (docs/for-developers/modules/explore/features/graph-canvas.md) — auto-open once on a user's first session,
	// reopenable from the "?" in the canvas header.
	// Per-type styling (docs/for-developers/modules/explore/features/graph-canvas.md) for the active canvas — hydrated from it on open,
	// edited in the StylingPanel, applied live by the renderer + persisted.
	// Board list — used to resolve an existing session's canvas when opening it
	// from the sessions list (`handleOpenSession`). Titles/purposes for the tabs
	// and edit dialog come from the session + a direct canvas fetch, not this.
	const { data: canvasList } = useBoardsQuery(username, graphSlug, {
		limit: 100,
		includeArchived: true,
	});
	const activeCanvasId =
		openTabs.find((t) => t.sessionId === activeSessionId)?.id ?? null;

	// Board contents, per canvas. The five values and five setters below are the
	// ones the page has always used — `useBoardVersions` just resolves them
	// against the active canvas instead of holding one canvas's worth for the
	// whole page (the-shell.md).
	const {
		items: canvasData,
		seed: seedData,
		styling,
		selectedId,
		missingIds,
		setItems: setCanvasData,
		setSeed: setSeedData,
		setStyling,
		setSelectedId,
		setMissingIds,
		forget: forgetCanvasState,
	} = useBoardVersions(activeCanvasId);

	// Switching the backend remounts the canvas (ExplorerCanvas keys on `backend`),
	// which rebuilds the store from the GraphLayer seed. Reseed with the full
	// current contents first — including node-expand additions, which were appended
	// straight to the store and so aren't in the paint-only `seedData` — so nothing
	// is lost across the switch.
	const setBackend = useCallback(
		(b: CanvasBackend) => {
			localStorage.setItem(BACKEND_STORAGE_KEY, b);
			setSeedData(adaptItems(canvasDataRef.current));
			setBackendState(b);
		},
		[setSeedData],
	);

	// Mirror the active canvas's contents in a ref so the imperative expand path
	// and the backend-remount reseed read the latest without re-deriving the seed.
	useEffect(() => {
		canvasDataRef.current = canvasData;
	}, [canvasData]);
	// Mirror in a ref so the delayed state-capture (which runs after the canvas
	// settles) reads the canvas that's active *now*, not the one closed over when
	// the turn fired.
	const activeCanvasIdRef = useRef<string | null>(null);
	useEffect(() => {
		activeCanvasIdRef.current = activeCanvasId;
	}, [activeCanvasId]);
	// Throttle banner capture (docs/for-developers/modules/explore/features/boards.md Part A): the last capture's timestamp + URL,
	// so the periodic autosave and per-turn state-capture can reuse a fresh shot
	// instead of re-extracting from PixiJS on every save.
	const lastBannerAtRef = useRef(0);
	const lastBannerUrlRef = useRef<string | null>(null);
	// sessionId → boardId for canvases that have a banner screenshot (docs/for-developers/modules/explore/features/graph-canvas.md),
	// so the Sessions list can show each session's canvas preview above its title.
	// Only bannered canvases are mapped; their rows lazy-fetch the (heavy) image.
	const bannerCanvasIdBySession = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of canvasList?.items ?? []) {
			if (c.hasBanner) m.set(c.sessionId, c.id);
		}
		return m;
	}, [canvasList]);
	// A session's title is the single name for it and its 1:1 canvas (docs/for-developers/modules/explore/features/graph-canvas.md):
	// the breadcrumb and the canvas tab show the same session title, so there's no
	// separate canvas name to keep in sync. `activeSession` is the freshest source
	// for the open thread (e.g. right after a rename); the list covers the rest.
	const sessionTitleById = useMemo(() => {
		const m = new Map<string, string>();
		for (const s of sessions) m.set(s.id, s.title);
		if (activeSession) m.set(activeSession.id, activeSession.title);
		return m;
	}, [sessions, activeSession]);
	// The session behind the tab being edited (its title is what the edit dialog
	// renames). Read from `openTabs` — always present for an open tab, unlike the
	// canvas list cache which can lag a freshly created canvas.

	// Persist a styling edit onto the active canvas (docs/for-developers/modules/explore/features/graph-canvas.md); applied live via
	// the `styling` state passed to <ExplorerCanvas>.
	const handleStylingChange = useCallback(
		(next: CanvasStyling) => {
			setStyling(next);
			if (activeCanvasId && username && graphSlug) {
				void boardsApi.update(username, graphSlug, activeCanvasId, {
					styling: next,
				});
			}
		},
		[activeCanvasId, username, graphSlug, setStyling],
	);

	// Node/edge types currently on the canvas (+ their property keys) — the rows
	// the StylingPanel offers. Derived from the painted data (docs/for-developers/modules/explore/features/graph-canvas.md).
	const styleTypes = useMemo(() => {
		const nodes = new Map<string, Set<string>>();
		const edges = new Map<string, Set<string>>();
		for (const item of canvasData) {
			const map =
				item.type === "vertex" ? nodes : item.type === "edge" ? edges : null;
			if (!map) continue;
			const label = String(item.label ?? "");
			if (!label) continue;
			const set = map.get(label) ?? new Set<string>();
			for (const k of Object.keys(item.properties ?? {})) set.add(k);
			map.set(label, set);
		}
		const toArr = (m: Map<string, Set<string>>): StyleTypeInfo[] =>
			[...m.entries()]
				.map(([name, props]) => ({ name, properties: [...props].sort() }))
				.sort((a, b) => a.name.localeCompare(b.name));
		return { nodeTypes: toArr(nodes), edgeTypes: toArr(edges) };
	}, [canvasData]);

	// Clicked node/edge id, lifted from the canvas by <InspectorSelectionBridge>.
	const selected: QueryResultItem | null = selectedId
		? (canvasData.find((i) => String(i.id) === selectedId) ?? null)
		: null;

	// "Node details" / "Edge details" context-menu items — select the element and
	// open the (default-closed) inspector so its properties show on the right.
	const handleShowDetail = useCallback(
		(id: string) => {
			setSelectedId(id);
			openInspector();
		},
		[openInspector, setSelectedId],
	);

	// The engine resolves capabilities from the live connector and returns
	// them on the connection payload. Default to the first language it
	// reports, fall back to allowing both while the engine is still warming
	// up / can't resolve the connector class.
	const availableLanguages: readonly QueryLanguage[] = graph?.query_languages
		?.length
		? graph.query_languages
		: FALLBACK_QUERY_LANGUAGES;
	const defaultLanguage: QueryLanguage = availableLanguages[0] ?? "cypher";

	const paintCanvas = useCallback(
		(result: QueryResponse | null) => {
			if (result?.result_type !== "graph" || !result.data) return;
			const data = result.data;
			// `explorer.transform` span (docs/for-developers/modules/platform/features/telemetry.md) — time the dedupe of query results
			// before they're handed to the canvas. No-ops when there's no active run.
			measureSync(runRef.current, "explorer.transform", (span) => {
				// Path queries (e.g. `MATCH path = (n)-[r]->() RETURN path`) repeat shared
				// endpoints once per row, so the engine returns the same node/edge id many
				// times. The canvas store rejects duplicate ids (GraphStore.addNode), so
				// dedupe by id here — keeping the first occurrence — before painting.
				const nodeMap = new Map<string, QueryResultItem>();
				for (const n of data.nodes) {
					const id = String(n.id);
					if (!nodeMap.has(id)) nodeMap.set(id, { ...n, type: "vertex" });
				}
				const edgeMap = new Map<string, QueryResultItem>();
				for (const e of data.edges) {
					const id = String(e.id);
					if (!edgeMap.has(id)) edgeMap.set(id, { ...e, type: "edge" });
				}
				const nodes = [...nodeMap.values()];
				const edges = [...edgeMap.values()];
				const items = [...nodes, ...edges];
				setCanvasData(items);
				setSelectedId(null);
				// Replace the canvas seed (full repaint → destructive setData + relayout).
				// `explorer.adapt` span (docs/for-developers/modules/platform/features/telemetry.md) — time mapping results to GraphData.
				setSeedData(
					measureSync(runRef.current, "explorer.adapt", (adaptSpan) => {
						const seed = adaptItems(items);
						adaptSpan?.setAttribute("explorer.node_count", seed.nodes.length);
						adaptSpan?.setAttribute("explorer.edge_count", seed.edges.length);
						return seed;
					}),
				);
				span?.setAttribute("explorer.raw_nodes", data.nodes.length);
				span?.setAttribute("explorer.raw_edges", data.edges.length);
				span?.setAttribute("explorer.node_count", nodes.length);
				span?.setAttribute("explorer.edge_count", edges.length);
			});
		},
		[setCanvasData, setSeedData, setSelectedId],
	);

	// ── Saved canvases + tabs (docs/for-developers/modules/explore/features/boards.md) ─────────────────────────────────────────
	// Node positions from the live canvas store, keyed by id — captured on save so
	// a canvas reopens to the exact layout it was left in.
	const capturePositions = useCallback(() => {
		const store = canvas?.layers.get<GraphLayer>("graph")?.store;
		const positions: Record<string, { x: number; y: number }> = {};
		if (!store) return positions;
		// Iterate the live store (source of truth for what's painted) rather than
		// canvasData, which can lag/diverge across restore + backend remount.
		for (const n of store.nodes()) {
			const p = store.getPosition(String(n.id));
			if (p) positions[String(n.id)] = { x: p.x, y: p.y };
		}
		return positions;
	}, [canvas]);

	// The items actually painted on the live canvas, reconstructed from the
	// GraphLayer store. `adaptItems` maps a QueryResultItem's label→node.type and
	// properties→node.data, so this is the exact inverse. Used as the source of
	// truth for saves, because canvasData can go stale (e.g. a canvas restored by
	// re-running its base query paints the store but leaves canvasData empty).
	const itemsFromStore = useCallback((): QueryResultItem[] => {
		const store = canvas?.layers.get<GraphLayer>("graph")?.store;
		if (!store || store.nodeCount() === 0) return [];
		const items: QueryResultItem[] = [];
		for (const n of store.nodes()) {
			items.push({
				id: String(n.id),
				type: "vertex",
				label: typeof n.type === "string" ? n.type : "",
				properties: (n.data as Record<string, unknown>) ?? {},
			});
		}
		for (const e of store.edges()) {
			items.push({
				id: String(e.id),
				type: "edge",
				label: typeof e.type === "string" ? e.type : "",
				source: String(e.source),
				target: String(e.target),
				properties: (e.data as Record<string, unknown>) ?? {},
			});
		}
		return items;
	}, [canvas]);

	// Paint the Explorer canvas from a saved canvas: repaint its snapshot and seed
	// each node at its saved position (the force layout then only relaxes),
	// mirroring the node-expand seeding path. Also restores the magnet toggle.
	const paintFromCanvas = useCallback(
		(c: Board) => {
			const items = c.snapshot?.items ?? [];
			setCanvasData(items);
			setSelectedId(null);
			const seed = adaptItems(items);
			for (const n of seed.nodes) {
				const p = c.positions?.[n.id];
				if (p) n.position = { x: p.x, y: p.y };
			}
			setSeedData(seed);
			if (typeof c.settings?.magnet === "boolean") setMagnet(c.settings.magnet);
			setStyling(c.styling ?? {});

			// A canvas reopens from its own snapshot, and the graph may have moved
			// on. What is gone is **kept and marked missing**, never dropped (GC5):
			// a drawing that quietly loses a node is a drawing that lies about what
			// was explored. One request for the whole canvas, on hydrate.
			const vertexIds = items
				.filter((i) => i.type === "vertex")
				.map((i) => String(i.id));
			if (!username || !graphSlug || vertexIds.length === 0) return;
			void explorerApi
				.resolveElements(username, graphSlug, vertexIds)
				.then(({ missing }) => {
					if (missing.length === 0) return;
					setMissingIds(new Set(missing));
					toast.warning(
						`${missing.length} element${missing.length === 1 ? "" : "s"} on this canvas ${
							missing.length === 1 ? "is" : "are"
						} no longer in the graph — kept and marked.`,
					);
				})
				.catch(() => {
					// A connection that is down is the connection's problem to report;
					// it does not make the drawing wrong.
				});
		},
		[
			username,
			graphSlug,
			setCanvasData,
			setSeedData,
			setStyling,
			setSelectedId,
			setMissingIds,
		],
	);

	// Capture a downscaled banner screenshot (docs/for-developers/modules/explore/features/graph-canvas.md), honouring the throttle
	// (docs/for-developers/modules/explore/features/boards.md Part A): "force" always captures; "throttle" reuses a shot younger
	// than BANNER_MIN_INTERVAL_MS (else captures a fresh one); "off" never does.
	// Successful captures update the shared last-banner refs so the per-turn state
	// capture can reuse them instead of re-extracting from PixiJS.
	const captureBannerThrottled = useCallback(
		async (mode: "force" | "throttle" | "off"): Promise<string | null> => {
			if (mode === "off") return null;
			const now = Date.now();
			if (
				mode === "throttle" &&
				lastBannerUrlRef.current &&
				now - lastBannerAtRef.current < BANNER_MIN_INTERVAL_MS
			) {
				return lastBannerUrlRef.current;
			}
			const b = captureBanner(canvas);
			if (b) {
				lastBannerAtRef.current = now;
				lastBannerUrlRef.current = b;
			}
			return b;
		},
		[canvas],
	);

	// Persist the current view (snapshot + positions + latest query) into the
	// active canvas. Called on blur (tab switch/close — `banner:"force"`), on the
	// frequent change autosave (`banner:"off"`, cheap), and on the periodic
	// autosave (`banner:"throttle"`, docs/for-developers/modules/explore/features/boards.md). Non-fatal on failure so tab
	// switching never blocks.
	const persistActiveCanvas = useCallback(
		async (opts?: { banner?: "force" | "throttle" | "off" }) => {
			if (!activeCanvasId || !username || !graphSlug) return;
			// Source of truth for what's painted: canvasData, falling back to the live
			// store when they've diverged (a canvas restored by re-running its base
			// query paints the store but leaves canvasData empty). Never overwrite a
			// saved snapshot with an empty one — with nothing painted there's nothing
			// worth persisting, so skip.
			const items =
				canvasDataRef.current.length > 0
					? canvasDataRef.current
					: itemsFromStore();
			if (items.length === 0) return;
			// The base query to restore the canvas from — the latest real query, never
			// an expand/load operation turn (those don't repaint the whole canvas).
			const src = [...(activeSession?.messages ?? [])]
				.reverse()
				.find(
					(m) => m.role === "assistant" && m.sourceQuery && !m.operation,
				)?.sourceQuery;
			const banner = await captureBannerThrottled(opts?.banner ?? "force");
			try {
				await boardsApi.update(username, graphSlug, activeCanvasId, {
					snapshot: { items },
					positions: capturePositions(),
					...(src ? { source_query: src } : {}),
					...(banner ? { banner } : {}),
					settings: { backend, magnet },
				});
			} catch {
				// Best-effort autosave — don't block the tab switch.
			}
		},
		[
			activeCanvasId,
			username,
			graphSlug,
			activeSession,
			capturePositions,
			captureBannerThrottled,
			itemsFromStore,
			backend,
			magnet,
		],
	);

	// Capture a version of the canvas after a canvas-mutating turn (docs/for-developers/modules/explore/features/boards.md). Runs
	// on a short delay so the force layout / render settles before we snapshot the
	// positions + banner. Best-effort: a failure never disturbs the turn. Reads
	// the *ref* for the active canvas so a delayed capture targets the right one.
	const captureCanvasState = useCallback(
		(
			kind: BoardVersionCause,
			opts?: { messageId?: string; immediate?: boolean },
		): Promise<{ ok: true } | { ok: false; reason: string }> => {
			// Auto-captures wait for the force layout / render to settle; a manual
			// save (immediate) fires now — the canvas is already settled.
			const delay = opts?.immediate ? 0 : 1200;
			return new Promise((resolve) => {
				setTimeout(async () => {
					const boardId = activeCanvasIdRef.current;
					if (!boardId || !username || !graphSlug) {
						return resolve({ ok: false, reason: "No active canvas." });
					}
					if (!canvas) {
						return resolve({
							ok: false,
							reason: "Board isn't ready yet — try again in a moment.",
						});
					}
					// Count straight from the live store — the source of truth for what's
					// painted (canvasData can lag/diverge across restore + remount).
					const store = canvas.layers.get<GraphLayer>("graph")?.store;
					const nodeCount = store?.nodeCount() ?? 0;
					const edgeCount = store?.edgeCount() ?? 0;
					if (nodeCount === 0) {
						return resolve({
							ok: false,
							reason: "Nothing painted on the canvas to save.",
						});
					}
					// The faithful, engine-native snapshot (camera / styling / positions /
					// layer data) — restored later via `canvas.importState`.
					if (typeof canvas.exportState !== "function") {
						return resolve({
							ok: false,
							reason:
								"This canvas build can't export state (update @invana/canvas).",
						});
					}
					let snapshot: Record<string, unknown>;
					try {
						snapshot = canvas.exportState() as unknown as Record<
							string,
							unknown
						>;
					} catch (e) {
						console.error("[canvas-state] exportState() threw", e);
						return resolve({
							ok: false,
							reason: "Couldn't snapshot the canvas — see console.",
						});
					}
					const verb =
						kind === "query"
							? "Ran query"
							: kind === "expand"
								? "Expanded neighbours"
								: kind === "load"
									? "Loaded result"
									: "Saved snapshot";
					const label = `${verb} — ${nodeCount} nodes, ${edgeCount} edges`;
					const src = [...(activeSession?.messages ?? [])]
						.reverse()
						.find(
							(m) => m.role === "assistant" && m.sourceQuery && !m.operation,
						)?.sourceQuery;
					// A small, self-contained thumbnail for the history timeline (docs/for-developers/modules/explore/features/boards.md
					// storage optimisation) — the engine's export sizes it directly via
					// maxSize, so no separate downscale step.
					const banner = captureBanner(canvas, STATE_THUMB_MAX_EDGE);
					try {
						await createCanvasState.mutateAsync({
							boardId,
							body: {
								kind,
								label,
								// Engine-native state (positions live inside it, so no separate
								// `positions`); restored via importState.
								snapshot,
								...(src ? { source_query: src } : {}),
								styling,
								settings: { backend, magnet },
								...(banner ? { banner } : {}),
								node_count: nodeCount,
								edge_count: edgeCount,
								...(opts?.messageId ? { message_id: opts.messageId } : {}),
							},
						});
						resolve({ ok: true });
					} catch (e) {
						console.error("[canvas-state] save failed", e);
						resolve({ ok: false, reason: "Failed to save — see console." });
						return;
					}
					// History just changed → refresh the canvas' sessions-list banner to
					// this same (latest) capture, and invalidate its cached preview so the
					// list shows it immediately. Best-effort, non-blocking.
					const listBanner = captureBanner(canvas);
					if (listBanner) {
						updateCanvas
							.mutateAsync({ id: boardId, data: { banner: listBanner } })
							.catch(() => {});
					}
				}, delay);
			});
		},
		[
			username,
			graphSlug,
			activeSession,
			canvas,
			createCanvasState,
			updateCanvas,
			styling,
			backend,
			magnet,
		],
	);

	// Explicit "Save current state" (docs/for-developers/modules/explore/features/boards.md): capture the live canvas now as a
	// `manual` state, toasting the outcome. Lets the user snapshot a good layout
	// on demand, independent of the per-turn auto-captures.
	const handleSaveState = useCallback(async () => {
		if (!activeCanvasId) return;
		const res = await captureCanvasState("manual", { immediate: true });
		if (res.ok) toast.success("Board state saved to history.");
		else toast.error(res.reason);
	}, [activeCanvasId, captureCanvasState]);

	// Open a canvas as a tab: save the outgoing one, hydrate this one, add the tab,
	// and switch the active session to its backing session (queries then belong to
	// this canvas). Paint from the snapshot — mark the session already-restored so
	// the restore effect doesn't re-run its query over our snapshot.
	const openCanvasTab = useCallback(
		async (id: string) => {
			if (id === activeCanvasId) return;
			await persistActiveCanvas();
			try {
				const c = await boardsApi.get(
					username as string,
					graphSlug as string,
					id,
				);
				const hasSnapshot = (c.snapshot?.items?.length ?? 0) > 0;
				if (hasSnapshot) {
					// Painted from a real snapshot → mark restored so the restore effect
					// doesn't re-run the query over it.
					paintFromCanvas(c);
					restoredRef.current = c.sessionId;
				} else {
					// Empty snapshot: seeding the canvas empty and then repainting from
					// the restore re-run is a double re-seed (setData([]) → setData(full))
					// that crashes the PixiJS WebGPU renderer. Restore selection/styling
					// only — leave the GraphLayer seed untouched — and let the restore
					// effect paint the base query in a single pass (heals canvases saved
					// blank before autosave existed).
					setSelectedId(null);
					setCanvasData([]);
					if (typeof c.settings?.magnet === "boolean")
						setMagnet(c.settings.magnet);
					setStyling(c.styling ?? {});
					restoredRef.current = null;
				}
				setOpenTabs((tabs) =>
					tabs.some((t) => t.id === id)
						? tabs
						: [...tabs, { id, sessionId: c.sessionId }],
				);
				openSession(c.sessionId);
			} catch {
				toast.error("Failed to open canvas.");
			}
		},
		[
			activeCanvasId,
			persistActiveCanvas,
			username,
			graphSlug,
			paintFromCanvas,
			openSession,
			setCanvasData,
			setStyling,
			setSelectedId,
		],
	);

	// Opening a session from the list opens (and paints) its 1:1 canvas if it
	// isn't already a tab, so the canvas area follows the session you pick. If the
	// canvas is already the active tab, just focus the thread; a session with no
	// canvas yet falls back to the plain thread (the restore effect repaints).
	const handleOpenSession = useCallback(
		(sessionId: string) => {
			const existing = openTabs.find((t) => t.sessionId === sessionId);
			if (existing) {
				if (existing.id === activeCanvasId) openSession(sessionId);
				else void openCanvasTab(existing.id);
				return;
			}
			const canvas = canvasList?.items.find((c) => c.sessionId === sessionId);
			if (canvas) void openCanvasTab(canvas.id);
			else openSession(sessionId);
		},
		[openTabs, activeCanvasId, canvasList, openCanvasTab, openSession],
	);

	// A session row in the graph info panel asks for a session by id
	// (graph-detail-page.md G22). The panel is rendered by the shell and cannot
	// reach `handleOpenSession`, so the request travels instead of the callback;
	// the page answers it exactly as it answers a row in the assistant's own
	// list, then clears it so one ask opens one session.
	const { request: openSessionRequest, clear: clearOpenSessionRequest } =
		useOpenSessionRequest();
	useEffect(() => {
		if (!openSessionRequest) return;
		handleOpenSession(openSessionRequest.sessionId);
		clearOpenSessionRequest();
	}, [openSessionRequest, handleOpenSession, clearOpenSessionRequest]);

	// "+" — a blank canvas: create a fresh session + a canvas backed by it, clear
	// the painted graph, open it as the active tab, and make its session active so
	// the composer's next query belongs to this canvas.
	const newCanvasTab = useCallback(async () => {
		if (!username || !graphSlug) return;
		await persistActiveCanvas();
		try {
			const session = await sessionsApi.create(username, graphSlug, {});
			const created = await createCanvas.mutateAsync({
				session_id: session.id,
				snapshot: { items: [] },
				settings: { backend, magnet },
			});
			setCanvasData([]);
			setSelectedId(null);
			setSeedData({ nodes: [], edges: [] });
			setStyling({});
			setOpenTabs((tabs) => [
				...tabs,
				{ id: created.id, sessionId: session.id },
			]);
			restoredRef.current = session.id;
			refresh();
			openSession(session.id);
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to create canvas.",
			);
		}
	}, [
		username,
		graphSlug,
		persistActiveCanvas,
		createCanvas,
		backend,
		magnet,
		refresh,
		openSession,
		setCanvasData,
		setSeedData,
		setStyling,
		setSelectedId,
	]);

	// Close a tab (does NOT delete the canvas). If it was active, save it and fall
	// back to the last remaining tab, or clear the canvas when none are left.
	const closeCanvasTab = useCallback(
		async (id: string) => {
			const tab = openTabs.find((t) => t.id === id);
			if (!tab) return;
			const wasActive = tab.sessionId === activeSessionId;
			if (wasActive) await persistActiveCanvas();
			const remaining = openTabs.filter((t) => t.id !== id);
			setOpenTabs(remaining);
			// The canvas is gone, so its contents are too — otherwise the record
			// keeps every canvas the session ever opened.
			forgetCanvasState(id);
			if (!wasActive) return;
			const next = remaining[remaining.length - 1];
			if (next) {
				void openCanvasTab(next.id);
			} else {
				setCanvasData([]);
				setSelectedId(null);
				setSeedData({ nodes: [], edges: [] });
				backToList();
			}
		},
		[
			openTabs,
			activeSessionId,
			persistActiveCanvas,
			openCanvasTab,
			backToList,
			forgetCanvasState,
			setCanvasData,
			setSeedData,
			setSelectedId,
		],
	);

	// ── Node expand / graph traversal (docs/for-developers/modules/explore/features/graph-canvas.md) ────────────────────────────────
	// Append expanded neighbours straight to the live store (the non-destructive
	// path) rather than re-feeding the whole dataset through `<GraphLayer data>`,
	// which calls the destructive `setData` — wiping every node's position and
	// re-laying the graph out from the origin on each expand. `store.addData`
	// flushes once and emits `data:changed (addedNodes>0)`, which re-runs the
	// active layout (d3-force, seeded from each node's *current* position).
	//
	// The catch: a brand-new node has no stored position, so it's born at the
	// world origin (0,0). The existing graph, however, has already been laid out
	// and framed *away* from the origin — so every new neighbour spawns in the
	// same empty spot, and a single seeded force pass can't drag them across the
	// canvas to their parent before it settles: they stay piled on that one point.
	// (The canvas-react streaming-demo dodges this only because its graph lives
	// permanently at the origin under a continuously-running live sim.)
	//
	// Fix: birth each new node *next to the existing node it attaches to* (an even
	// ring around that anchor), so it spawns where it belongs. d3-force then just
	// relaxes the ring locally — placed nodes stay put, neighbours fan out from
	// their parent. `canvasData` (the Inspector list) is merged in parallel so the
	// right panel sees the additions.
	const handleExpandResult = useCallback(
		(res: NeighborExpandResponse) => {
			const store = canvas?.layers.get<GraphLayer>("graph")?.store;
			// Genuinely-new items only — `store.addData` uses `addNode`, which throws
			// on a duplicate id, so drop anything already in the store (a re-returned
			// origin node / shared neighbour) and any id repeated within this response
			// (path-style results echo shared endpoints).
			const seenNodes = new Set<string>();
			const seenEdges = new Set<string>();
			const newNodeIds = new Set<string>();
			const newItems: QueryResultItem[] = [];
			for (const n of res.data.nodes) {
				const id = String(n.id);
				if (seenNodes.has(id) || store?.hasNode(id)) continue;
				seenNodes.add(id);
				newNodeIds.add(id);
				newItems.push({ ...n, type: "vertex" });
			}
			for (const e of res.data.edges) {
				const id = String(e.id);
				if (seenEdges.has(id) || store?.hasEdge(id)) continue;
				seenEdges.add(id);
				newItems.push({ ...e, type: "edge" });
			}
			if (newItems.length === 0) return;
			// Inspector list — additive.
			setCanvasData((prev) => [...prev, ...newItems]);
			// When the canvas isn't live yet there's no store; the canvasData merge
			// above still lands and the next paint/remount seeds it.
			if (!store) return;

			// Anchor each new node to the *existing* endpoint of a connecting edge —
			// the node it was expanded from. (Edges among the new nodes themselves
			// are ignored here; those settle under the force pass.)
			const anchorOf = new Map<string, string>();
			for (const e of res.data.edges) {
				const s = String(e.source);
				const t = String(e.target);
				if (newNodeIds.has(t) && !anchorOf.has(t) && store.hasNode(s))
					anchorOf.set(t, s);
				if (newNodeIds.has(s) && !anchorOf.has(s) && store.hasNode(t))
					anchorOf.set(s, t);
			}

			// Birth new nodes on an even ring around their anchor's current position,
			// distributing siblings of the same anchor around the circle so they don't
			// stack. The ring is sized to *hold* them: a hub with many neighbours gets
			// a wider ring (circumference ≥ one node-spacing per leaf), so a dense fan
			// starts pre-separated and the force pass just relaxes it instead of having
			// to shove 40 overlapping nodes apart from a tight cluster. Nodes with no
			// resolved anchor (rare — a disconnected return) keep the default origin.
			const MIN_RING_RADIUS = 60;
			const NODE_SPACING = 40; // ≈ 2 × collide radius; arc length wanted per leaf
			const ringSeen = new Map<string, number>();
			const ringTotal = new Map<string, number>();
			for (const id of newNodeIds) {
				const a = anchorOf.get(id);
				if (a) ringTotal.set(a, (ringTotal.get(a) ?? 0) + 1);
			}
			const seed = adaptItems(newItems);
			for (const node of seed.nodes) {
				const anchorId = anchorOf.get(node.id);
				if (!anchorId) continue;
				const base = store.getPosition(anchorId);
				if (!base) continue;
				const total = ringTotal.get(anchorId) ?? 1;
				const i = ringSeen.get(anchorId) ?? 0;
				ringSeen.set(anchorId, i + 1);
				const radius = Math.max(
					MIN_RING_RADIUS,
					(NODE_SPACING * total) / (2 * Math.PI),
				);
				const angle = (2 * Math.PI * i) / total;
				node.position = {
					x: base.x + radius * Math.cos(angle),
					y: base.y + radius * Math.sin(angle),
				};
			}

			// Append, then relax: d3-force seeds from the ring positions we just set,
			// so existing nodes stay put and the new neighbours spread around their
			// anchor. (`runLayout` is explicit rather than leaning on the engine's
			// data:changed → active-layout wiring, so the re-layout is guaranteed.)
			store.addData(seed);
			void canvas?.runLayout(ACTIVE_LAYOUT_ID);
		},
		[canvas, setCanvasData],
	);

	const expand = useExpandNode(username, graphSlug);
	const runExpand = useCallback(
		async (req: ExpandRequest): Promise<NeighborExpandResponse | null> => {
			// Tag the expand with the active session so the engine logs it as a turn
			// in that session's thread (docs/for-developers/modules/explore/features/boards.md). No session → just paints, no log.
			const tagged = activeSessionId
				? ({
						...req,
						body: { ...req.body, session_id: activeSessionId },
					} as ExpandRequest)
				: req;
			try {
				const res = await expand.mutateAsync(tagged);
				handleExpandResult(res);
				if (res.returned === 0) {
					toast.info("No more neighbours to load.");
				} else {
					// The canvas grew — capture a version (docs/for-developers/modules/explore/features/boards.md).
					void captureCanvasState("expand");
					if (activeSessionId) {
						// The engine recorded an expand turn — refetch the thread so it shows.
						refresh();
					}
				}
				return res;
			} catch {
				toast.error("Failed to load neighbours.");
				return null;
			}
		},
		[expand, handleExpandResult, activeSessionId, refresh, captureCanvasState],
	);

	// Active model schema drives the expand submenus and the fine-tune pickers.
	// The Model panel loads its own version, because it may be looking at a draft.
	const { data: activeVersion } = useActiveVersionQuery(username, graphSlug);
	const expandSchema = useMemo<ExpandMenuSchema | null>(() => {
		if (!activeVersion) return null;
		return {
			nodeTypes: activeVersion.node_types.map((n) => n.name),
			edgeTypes: activeVersion.edge_types.map((e) => ({
				name: e.name,
				source_node_types: e.source_node_types,
				target_node_types: e.target_node_types,
			})),
		};
	}, [activeVersion]);
	const propertyKeys = useMemo(
		() => (activeVersion?.property_keys ?? []).map((p) => p.name),
		[activeVersion],
	);

	const expandHandlers = useMemo(
		() => ({
			schema: expandSchema,
			onExpand: (req: ExpandRequest) => void runExpand(req),
		}),
		[expandSchema, runExpand],
	);

	// Session whose canvas is already painted — skip the auto-restore effect for
	// it (a fresh send already painted; reopening another session restores it).
	const restoredRef = useRef<string | null>(null);
	// Sessions whose board we have already tried to paint from. The restore
	// effect below opens the board first and re-runs only when that left the
	// canvas empty; without this the same tab would be opened forever and the
	// heal path (CV16) would never be reached.
	const snapshotTriedRef = useRef<Set<string>>(new Set());

	// Open one `explorer.query.run` root per user trigger (run / rerun / restore),
	// run `work` inside its context, and paint. Graph results flow on to
	// layout+render, where the canvas bridge closes the root after the first
	// painted frame; everything else (errors / NL / tabular) has nothing more to
	// paint, so we close here in `finally`. `explorer.trigger` distinguishes the
	// three entry points in HyperDX (docs/for-developers/modules/platform/features/telemetry.md). Running `work` inside the
	// interaction's context makes its API call — and, via traceparent, the whole
	// engine subtree — children of this span.
	const runTraced = useCallback(
		async (
			trigger: "run" | "rerun" | "restore",
			attributes: SpanAttributes,
			work: () => Promise<QueryResponse | null>,
		): Promise<QueryResponse | null> => {
			const interaction = startInteraction("explorer.query.run", {
				"explorer.trigger": trigger,
				...attributes,
			});
			runRef.current = interaction;
			try {
				// A query run no longer paints — its result renders inline in the
				// thread (docs/for-developers/modules/ask/features/the-answer-surface.md). The canvas pipeline is traced separately, on Load
				// to canvas, so the run span just covers translate + execute.
				return await withInteraction(interaction, work);
			} catch (err) {
				interaction.span.recordException(err as Error);
				throw err;
			} finally {
				endInteraction(runRef, interaction);
			}
		},
		[],
	);

	// Explicit projection of a graph result onto the canvas (docs/for-developers/modules/ask/features/the-answer-surface.md). Opens its
	// own canvas-render trace; the canvas bridge closes it after the painted frame
	// (the same mechanism the old auto-paint used).
	const handleLoadToCanvas = useCallback(
		(result: QueryResponse) => {
			const interaction = startInteraction("explorer.query.run", {
				"explorer.trigger": "load",
			});
			runRef.current = interaction;
			paintCanvas(result);
		},
		[paintCanvas],
	);

	// Explicit "Load to canvas" click (docs/for-developers/modules/explore/features/boards.md): paint, then log a `load` turn in
	// the thread referencing the query that produced the result. Only the click
	// logs — the automatic paints (session create / restore) call
	// `handleLoadToCanvas` directly and stay silent.
	const handleLoadToCanvasClick = useCallback(
		(result: QueryResponse, message: SessionMessage) => {
			handleLoadToCanvas(result);
			if (result.result_type !== "graph") return;
			void recordLoad({
				kind: "load",
				source_query: message.sourceQuery,
				query_language: message.language,
				row_count: result.row_count,
				node_count: result.data?.nodes.length ?? 0,
				edge_count: result.data?.edges.length ?? 0,
				execution_time_ms: result.execution_time_ms,
			});
			// Capture the loaded canvas as a version (docs/for-developers/modules/explore/features/boards.md).
			void captureCanvasState("load", { messageId: message.id });
		},
		[handleLoadToCanvas, recordLoad, captureCanvasState],
	);

	// Sessions we've already spun a canvas for, so the two triggers below (session
	// created, then result returned) create exactly one canvas. A ref, not state,
	// so the guard is synchronous across a single run's two calls.
	const canvasedSessionsRef = useRef<Set<string>>(new Set());

	// A newly-started session gets its own canvas (docs/for-developers/modules/explore/features/boards.md): create a canvas backed
	// by that session (the engine copies its title + latest query) and open it as
	// the active tab, then paint the result once it lands. Called first the moment
	// the session is created — so the canvas shows up named after the session right
	// away, before the query returns — and again when the result arrives (to paint
	// it). Idempotent per session via `canvasedSessionsRef`. Mirrors "+" (blank
	// canvas) for the composer-driven path — starting a session starts a canvas.
	const openCanvasForNewSession = useCallback(
		async (sessionId: string, result: QueryResponse | null) => {
			if (!username || !graphSlug) return;
			if (result) {
				handleLoadToCanvas(result);
				// First paint of the new session's canvas — capture it as the opening
				// version (docs/for-developers/modules/explore/features/boards.md). The canvas tab registers below; the delayed
				// capture reads the (by-then active) canvas from the ref.
				void captureCanvasState("query");
			}
			if (canvasedSessionsRef.current.has(sessionId)) return;
			if (openTabs.some((t) => t.sessionId === sessionId)) return;
			canvasedSessionsRef.current.add(sessionId);
			try {
				const created = await createCanvas.mutateAsync({
					session_id: sessionId,
					snapshot: { items: resultToItems(result) },
					settings: { backend, magnet },
				});
				setOpenTabs((tabs) =>
					tabs.some((t) => t.sessionId === sessionId)
						? tabs
						: [...tabs, { id: created.id, sessionId }],
				);
			} catch {
				// Non-fatal — e.g. the session already has a canvas (409). Drop the
				// guard so a later trigger can retry. The thread still renders; the
				// user can Save view manually.
				canvasedSessionsRef.current.delete(sessionId);
			}
		},
		[
			username,
			graphSlug,
			handleLoadToCanvas,
			openTabs,
			createCanvas,
			backend,
			magnet,
			captureCanvasState,
		],
	);

	const handleRun = async (incoming: QueryRunPayload) => {
		// The attachment goes into the ask itself, in words, rather than as a
		// hidden context field: what the thread records has to be what was asked
		// (docs/for-developers/modules/ask/features/the-assistant.md AD2).
		// Removing the chip removes the line — asked without it, and the thread
		// shows that too.
		const attached =
			right.is("assistant") && !attachmentDetached
				? attachmentFor(selected)
				: null;
		const payload: QueryRunPayload =
			attached && incoming.mode === "nl"
				? {
						...incoming,
						query: `${incoming.query}\n\n(About ${attached.kind} ${attached.label}.)`,
					}
				: incoming;
		if (cannotAnswer && incoming.mode === "nl") {
			toast.error(
				"This graph has no LLM provider yet — add one and ping it before asking.",
			);
			return;
		}
		// A run with no active session creates one; detect that so the first
		// result paints onto the new session's canvas when it lands.
		const priorSessionId = activeSessionId;
		await runTraced(
			"run",
			{
				"explorer.mode": payload.mode,
				"explorer.language": payload.mode === "ql" ? payload.language : "",
			},
			// `send` records the ask into a session (creating + opening one when
			// none is active) and opens a run (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). It returns as soon as
			// the engine has accepted the ask; the result arrives on the run's
			// stream and is handled by `handleStreamResult`.
			async () => {
				const { sessionId } = await send(payload, {
					// The session exists now — open its canvas immediately (named after
					// the session) so it's there while the query runs, not only after.
					onSessionCreated: (s) => void openCanvasForNewSession(s.id, null),
				});
				restoredRef.current = sessionId;
				if (sessionId && sessionId !== priorSessionId) {
					pendingNewSessionsRef.current.add(sessionId);
				}
				return null;
			},
		);
	};

	// A query result landed on a run's stream (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): render it inline
	// against its reply, and paint it when the run asked for that — the first
	// result of a new session (onto the canvas created above) or a restore.
	streamResultRef.current = (sessionId, messageId, result) => {
		setResultFor(messageId, result);
		if (pendingNewSessionsRef.current.delete(sessionId)) {
			// The canvas was created on session-create; this paints the result onto
			// it (the idempotent guard skips re-creating).
			void openCanvasForNewSession(sessionId, result);
			return;
		}
		if (pendingRestorePaintRef.current.delete(messageId)) paintCanvas(result);
	};

	// `rerun` re-issues a stored message's query — triggered by clicking a message
	// (`rerun`) or by the session-restore effect (`restore`). Both are traced and
	// store the result inline against that message.
	const handleRerun = useCallback(
		async (messageId: string, trigger: "rerun" | "restore" = "rerun") => {
			// Opening a session should show its graph: when the restore path runs
			// because the saved snapshot was empty, paint the re-run result onto the
			// canvas once it lands. A manual re-run just renders inline (Load to canvas).
			if (trigger === "restore") pendingRestorePaintRef.current.add(messageId);
			await runTraced(trigger, {}, async () => {
				await rerun(messageId);
				return null;
			});
		},
		[runTraced, rerun],
	);

	// Restore a session's canvas when it is opened — **from the record first**
	// (docs/for-developers/modules/ask/features/the-answer-surface.md AS13): the
	// board's snapshot is what was drawn, and the reply's emissions are what was
	// answered, so a reload renders both without asking the graph anything. A
	// re-run is the fallback for a board with no snapshot to paint
	// (docs/for-developers/modules/explore/features/boards.md CV16) — a board
	// saved before autosave existed — and never what a refresh does.
	useEffect(() => {
		if (!activeSession) {
			restoredRef.current = null;
			return;
		}
		if (restoredRef.current === activeSession.id) return;
		// Restore from the latest real query, skipping expand/load operation turns
		// (they don't repaint the whole canvas — re-running one would drop the base
		// graph, docs/for-developers/modules/explore/features/boards.md).
		const latest = [...activeSession.messages]
			.reverse()
			.find((m) => m.role === "assistant" && m.sourceQuery && !m.operation);
		if (!latest) return;
		// Wait for the board list rather than deciding without it — a re-run
		// started here would race the snapshot it is meant to replace.
		if (!canvasList) return;
		const board = canvasList.items.find(
			(c) => c.sessionId === activeSession.id,
		);
		if (
			board &&
			!openTabs.some((t) => t.id === board.id) &&
			!snapshotTriedRef.current.has(activeSession.id)
		) {
			// `openCanvasTab` paints the snapshot and marks the session restored; an
			// empty one leaves it unmarked, and this effect then falls through to the
			// re-run on its next pass.
			snapshotTriedRef.current.add(activeSession.id);
			void openCanvasTab(board.id);
			return;
		}
		restoredRef.current = activeSession.id;
		void handleRerun(latest.id, "restore");
	}, [activeSession, canvasList, openTabs, openCanvasTab, handleRerun]);

	// Autosave the live canvas (snapshot + positions) shortly after it changes, so
	// a query result and every node-expand survive a reopen — the record used to
	// be written only on tab blur, so anything built up in a single sitting was
	// lost. Debounced to coalesce rapid expands, and banner-less to stay cheap
	// (the periodic + blur saves refresh the banner).
	useEffect(() => {
		if (!activeCanvasId || canvasData.length === 0) return;
		const t = setTimeout(
			() => void persistActiveCanvas({ banner: "off" }),
			800,
		);
		return () => clearTimeout(t);
	}, [canvasData, activeCanvasId, persistActiveCanvas]);

	// Periodic autosave (docs/for-developers/modules/explore/features/boards.md Part A): every ~10s while a canvas is open, save
	// with a throttled banner so the sessions-list preview stays current — not
	// only on blur. Also catches layout-only changes (node drags) the change
	// effect above misses (it keys on `canvasData`, not live positions).
	useEffect(() => {
		if (!activeCanvasId) return;
		const t = setInterval(() => {
			if (canvasDataRef.current.length === 0) return;
			void persistActiveCanvas({ banner: "throttle" });
		}, BANNER_MIN_INTERVAL_MS);
		return () => clearInterval(t);
	}, [activeCanvasId, persistActiveCanvas]);

	// A canvas is a session's 1:1 layer — with no session open (the list view),
	// tear the canvas down so no graph shows there. Also drops the live engine so
	// the header toolbar / status bar hide. Reopening a session remounts a fresh
	// canvas, which also sidesteps the WebGPU re-seed crash.
	useEffect(() => {
		if (activeSessionId) return;
		setCanvas(null);
		setSeedData({ nodes: [], edges: [] });
		setCanvasData([]);
		setSelectedId(null);
	}, [activeSessionId, setCanvasData, setSeedData, setSelectedId]);

	// Returning to the list (breadcrumb) closes the thread. Flush the canvas first
	// so the last edits before the debounced autosave aren't lost, then hand off to
	// the list — the effect above clears the canvas once the session deselects.
	const handleBack = useCallback(() => {
		void persistActiveCanvas({ banner: "off" });
		backToList();
	}, [persistActiveCanvas, backToList]);

	// "Go back in time" (docs/for-developers/modules/explore/features/boards.md): fork the chosen state into a fresh session +
	// canvas (the current one is untouched). We hydrate the *live* canvas from the
	// saved engine snapshot via `canvas.importState` (faithful — camera / styling /
	// positions), then let the normal autosave persist it onto the new canvas row
	// in the standard {items} shape (so it reopens through the usual path — no
	// format drift). We deliberately don't touch `seedData` here: importState
	// mutates the store directly, and a competing setData would double-seed the
	// WebGPU renderer (a known crash).
	const handleForkState = useCallback(
		async (versionId: string) => {
			if (!activeCanvasId || !canvas || !username || !graphSlug) return;
			setIsRestoring(true);
			try {
				const state = await boardVersionsApi.get(
					username,
					graphSlug,
					activeCanvasId,
					versionId,
				);
				const session = await sessionsApi.create(username, graphSlug, {});
				const created = await createCanvas.mutateAsync({
					session_id: session.id,
					snapshot: { items: [] },
					settings: { backend, magnet },
				});
				// Hydrate the live canvas from the saved engine state. The row is
				// typed `Record<string, unknown>` because it round-trips through
				// JSON, so it is checked rather than asserted — a state written by
				// an older engine reaches us as an ordinary object, and refusing it
				// here beats throwing inside the renderer.
				if (!isCanvasStateSnapshot(state.snapshot)) {
					toast.error("That saved state is not readable by this version.");
					return;
				}
				canvas.importState(state.snapshot);
				// Sync the React mirrors to what importState painted, and adopt the new
				// tab. Mark restored so the restore effect doesn't re-run a base query
				// over the imported view. The change autosave then persists {items}.
				setSelectedId(null);
				setCanvasData(itemsFromStore());
				setStyling(state.styling ?? {});
				if (typeof state.settings?.magnet === "boolean") {
					setMagnet(state.settings.magnet);
				}
				setOpenTabs((tabs) => [
					...tabs,
					{ id: created.id, sessionId: session.id },
				]);
				restoredRef.current = session.id;
				openSession(session.id);
				refresh();
			} catch {
				toast.error("Failed to restore this state.");
			} finally {
				setIsRestoring(false);
			}
		},
		[
			activeCanvasId,
			canvas,
			username,
			graphSlug,
			createCanvas,
			backend,
			magnet,
			itemsFromStore,
			openSession,
			refresh,
			setCanvasData,
			setStyling,
			setSelectedId,
		],
	);

	// Clicking a node/edge feeds `selectedId` via <InspectorSelectionBridge>; the
	// derived `selected` (above) drives the right-side InspectorPanel. The strip
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

	// The assistant, as the right side's `assistant` occupant. Its sessions live
	// on the RIGHT and nowhere else (the-assistant.md AD1/AD6, and the
	// `Explorer · …` hi-fi artboards all draw it there): the left rail is for the
	// page's own panels, and asking never costs you the one you had open. Its
	// close closes the region.
	const assistantContent = connectionMissing ? (
		<SetupLock
			graph={graphContainer}
			gate="connected"
			surface="The Assistant"
		/>
	) : cannotAnswer ? (
		<SetupLock graph={graphContainer} gate="answering" surface="Ask" />
	) : (
		<AssistantPanel
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
				<InspectorPanel
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

	// One rail, one page (docs/for-developers/modules/explore/spec.md). Every panel below is a `?settings` key,
	// and each one owns the canvas kind it opens — which is why the selection
	// state lives on this page rather than inside them.
	const leftContent =
		settingsPanel.section === "model" ? (
			// Authoring lives here now: the Modeller's page is retired, and the
			// model is a canvas kind opened from this panel (docs/for-developers/modules/explore/spec.md).
			<ModelPanel
				username={username as string}
				graphSlug={graphSlug as string}
				onClose={closeLeftPanel}
				selectedModelId={selectedModelId}
				onSelectModel={(id) => {
					setSelectedModelId(id);
					if (!id) setWorkKind(null);
				}}
				selection={modelSelection}
				onSelect={setModelSelection}
				onOpenCanvas={(id) => {
					setSelectedModelId(id);
					setWorkKind("model");
					// One model replaces the landscape it was picked from — the list
					// view's canvas is *All models*, the detail view's is this model
					// (ST24).
					setAllModelsOpen(false);
				}}
				onOpenGlobalModel={() => {
					setGlobalModelOpen(true);
					// The union replaces the landscape, as one model does (ST24) —
					// `allModelsOpen` outranks it in `activePageId`, so leaving it set
					// added the tab and then never showed it.
					setAllModelsOpen(false);
				}}
				onOpenAllModels={() => setAllModelsOpen(true)}
			/>
		) : settingsPanel.section === "projects" ? (
			// **Projects owns Todos** (PT7) — two drawers, `Projects` over `Todos`,
			// the same stack shape Library takes. With no project drilled into, the
			// Todos drawer is every Todo in the Graph: the *No project* bucket.
			<ProjectsStackPanel
				username={username as string}
				graphSlug={graphSlug as string}
				onProjectChange={(key) => {
					setSelectedProjectKey(key);
					if (!key) setWorkKind(null);
				}}
				onOpenPlanCanvas={() => setWorkKind("plan")}
				onOpenAgent={(id) => {
					setSelectedAgentId(id);
					setWorkKind("lineage");
					openWorkPanel("agents");
				}}
			/>
		) : settingsPanel.section === "runs" ? (
			// **Runs is execution** — the journal, and nothing else, as one list
			// (G41 · SR1). Todos are not here: they live under Projects, because a
			// Todo without its project is a to-do list (PT7).
			<RunsPanel
				username={username as string}
				graphSlug={graphSlug as string}
				onClose={closeLeftPanel}
				onOpenRunDashboard={(runId) =>
					openBoard({ kind: "run", subjectId: runId, runId })
				}
			/>
		) : settingsPanel.section === "library" ? (
			// **Library is definition** — Plans · Catalogue · Templates, stacked,
			// with no panel header above them (G33 · G41): what can be run, the
			// closed vocabulary it is written in, and how its output renders.
			<LibraryStackPanel
				username={username as string}
				graphSlug={graphSlug as string}
				selectedStepId={selectedStepId}
				onOpenPlanCanvas={(key) => {
					setSelectedWorkflowKey(key);
					setWorkKind("workflow");
				}}
				onOpenAgent={(id) => {
					setSelectedAgentId(id);
					setWorkKind("envelope");
					openWorkPanel("agents");
				}}
				planExportUrl={(key) =>
					workflowsApi.exportUrl(username as string, graphSlug as string, key)
				}
			/>
		) : settingsPanel.section === "skills" ? (
			// A skill is a setting that hangs over the work, so its panel opens
			// beside whatever canvas is already there — it takes no kind of its own.
			<SkillsPanel
				username={username as string}
				graphSlug={graphSlug as string}
				onClose={closeLeftPanel}
				selectedSkillId={selectedSkillId}
				onSelectSkill={setSelectedSkillId}
				onOpenAgent={(id) => {
					setSelectedAgentId(id);
					setWorkKind("envelope");
					openWorkPanel("agents");
				}}
			/>
		) : settingsPanel.section === "agents" ? (
			<AgentsPanel
				username={username as string}
				graphSlug={graphSlug as string}
				onClose={closeLeftPanel}
				selectedAgentId={selectedAgentId}
				onSelectAgent={(id) => {
					setSelectedAgentId(id);
					setSelectedLineageEdge(null);
				}}
				selectedEdge={selectedLineageEdge}
				onOpenLineage={(id) => {
					setSelectedAgentId(id);
					setWorkKind("lineage");
				}}
				onOpenEnvelope={(id) => {
					setSelectedAgentId(id);
					setSelectedStepId(null);
					setWorkKind("envelope");
				}}
				onOpenTask={(id) => {
					// A Todo lives under Projects (PT7); the rail's Tasks icon is
					// execution only.
					setSelectedTaskId(id);
					openWorkPanel("projects");
				}}
			/>
		) : settingsPanel.section === "explorer" ? (
			// Sessions is not a left panel (AD1); the Explorer's own is the graph's
			// type list and the selection (selection-and-the-panel.md) — the legend
			// for the drawing beside it. It is a `?panel` key like every other, so
			// closing it leaves the column empty rather than falling back here.
			<ExplorerTypesPanel
				username={username}
				graphSlug={graphSlug}
				canvas={canvas}
				selected={selected}
				styling={styling}
				canvasName={
					activeSessionId ? sessionTitleById.get(activeSessionId) : undefined
				}
				modelName={modelName}
				onClose={closeLeftPanel}
			/>
		) : null;

	// The main area, when a work canvas is open. The Explorer's data canvas is
	// still the default — these replace it only while their panel drove them
	// there, and switching back to Sessions leaves them behind.
	// What the open work canvas is drawing — the one value the tab strip and the
	// status line both need (`studio.md` § 6.26).
	const workTarget: WorkCanvasTarget | null =
		workKind === "plan" && selectedProjectKey
			? { kind: "plan", projectKey: selectedProjectKey }
			: workKind === "workflow" && selectedWorkflowKey
				? { kind: "workflow", workflowKey: selectedWorkflowKey }
				: (workKind === "envelope" || workKind === "lineage") && selectedAgentId
					? { kind: workKind, agentId: selectedAgentId }
					: null;

	/**
	 * What the main area says when it has nothing to draw.
	 *
	 * Every work panel owns a canvas kind, and selecting a row opens it — so the
	 * only honest empty state is *which row to pick*, phrased in the vocabulary
	 * of the panel you are actually looking at.
	 */
	const canvasEmptyHint =
		settingsSection === "model"
			? "Pick a model to draw it — its types as nodes, its edge types as the edges between them."
			: settingsSection === "projects"
				? "Pick a project to draw its plan — todos as cards, dependencies left to right."
				: settingsSection === "runs"
					? "Pick a run to read it — stats, where the time went, and the log. `More` opens its dashboard as a page."
					: settingsSection === "library"
						? "Pick a plan to draw the flow it will run. A template decides what its answer looks like; the catalogue is what it may name at all."
						: settingsSection === "agents"
							? "Pick an agent to draw who created it and what it has worked on."
							: settingsSection === "skills"
								? "A skill has no canvas of its own — open a session, project or agent and the skill panel stays beside it."
								: "Open a session or start a new one to see its canvas.";

	const workCanvas =
		workKind === "plan" && selectedProjectKey ? (
			<PlanCanvas
				username={username as string}
				graphSlug={graphSlug as string}
				projectKey={selectedProjectKey}
				selectedTaskId={selectedTaskId}
				onSelectTask={setSelectedTaskId}
				onAddDependency={(taskId, dependsOnId) => {
					setPlanError(null);
					taskMutations.addDependency.mutate(
						{ id: taskId, dependsOnId },
						{
							onError: (err) =>
								setPlanError(
									err instanceof ApiError
										? err.message
										: "That dependency could not be added.",
								),
						},
					);
				}}
				error={planError}
			/>
		) : workKind === "workflow" && selectedWorkflowKey ? (
			<WorkflowCanvas
				username={username as string}
				graphSlug={graphSlug as string}
				workflowKey={selectedWorkflowKey}
				selectedStepId={selectedStepId}
				onSelectStep={setSelectedStepId}
			/>
		) : workKind === "envelope" && selectedAgentId ? (
			<EnvelopeCanvas
				username={username as string}
				graphSlug={graphSlug as string}
				agentId={selectedAgentId}
				selectedStepId={selectedStepId}
				onSelectStep={setSelectedStepId}
			/>
		) : workKind === "lineage" && selectedAgentId ? (
			<LineageCanvas
				username={username as string}
				graphSlug={graphSlug as string}
				agentId={selectedAgentId}
				selectedNodeId={selectedAgentId}
				selectedEdgeId={selectedLineageEdge?.id ?? null}
				onSelectAgent={setSelectedAgentId}
				onSelectEdge={setSelectedLineageEdge}
				onOpenTask={(id) => {
					// A Todo lives under Projects (PT7); the rail's Tasks icon is
					// execution only.
					setSelectedTaskId(id);
					openWorkPanel("projects");
				}}
			/>
		) : null;

	// ── The open pages (graph-detail-page.md G4) ───────────────────────────────
	//
	// One strip over every kind of page: the graph itself, a data canvas per open
	// tab, the model, and whichever work canvas a panel drove. What used to be a
	// four-branch ternary fighting over one slot is a list, and the branch that
	// used to explain why the slot was empty is now the graph page — a page that
	// is always there and cannot be closed (G6).
	const modelPageId = selectedModelId ? `model:${selectedModelId}` : null;
	const workPageId = workTarget
		? `${workTarget.kind}:${
				"projectKey" in workTarget
					? workTarget.projectKey
					: "workflowKey" in workTarget
						? workTarget.workflowKey
						: workTarget.agentId
			}`
		: null;

	// The graduation cap opens the wizard from anywhere in the Graph (setup.md
	// SU19), and the wizard is the graph page's content — so asking for it makes
	// the graph page active, whatever else was open. Nothing is closed: the other
	// pages keep their state and their tabs.
	// A focused board is the active page, the way an open wizard is (G26): it is
	// what the reader last asked for, and every other page keeps its tab and its
	// state behind it.
	const focusedBoard =
		activeBoardId &&
		boards.some((b) => boardPageId(b.kind, b.subjectId) === activeBoardId)
			? activeBoardId
			: null;

	const activePageId = onboardingOpen
		? GRAPH_PAGE_ID
		: focusedBoard
			? focusedBoard
			: allModelsOpen
				? ALL_MODELS_PAGE_ID
				: globalModelOpen
					? GLOBAL_MODEL_PAGE_ID
					: workKind === "model" && modelPageId
						? modelPageId
						: workCanvas && workPageId
							? workPageId
							: activeCanvasId
								? boardPageId("data", activeCanvasId)
								: GRAPH_PAGE_ID;

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
					hint={canvasEmptyHint}
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
		...(allModelsOpen
			? [
					{
						id: ALL_MODELS_PAGE_ID,
						title: "All models",
						icon: LayoutGrid,
						content: (
							<AllModelsCanvas
								username={username as string}
								graphSlug={graphSlug as string}
								onOpenModel={(id) => {
									setAllModelsOpen(false);
									setSelectedModelId(id);
									setWorkKind("model");
								}}
							/>
						),
					},
				]
			: []),
		...(globalModelOpen
			? [
					{
						id: GLOBAL_MODEL_PAGE_ID,
						title: "Global model",
						icon: Boxes,
						content: (
							<GlobalModelPage
								username={username as string}
								graphSlug={graphSlug as string}
							/>
						),
					},
				]
			: []),
		...(modelPageId && selectedModelId
			? [
					{
						id: modelPageId,
						title: CANVAS_KINDS.model.label,
						icon: CANVAS_KINDS.model.icon,
						content: (
							<ModelCanvas
								username={username as string}
								graphSlug={graphSlug as string}
								modelId={selectedModelId}
								backend={backend}
								selection={modelSelection}
								onSelect={setModelSelection}
								onClose={() => setWorkKind(null)}
							/>
						),
					},
				]
			: []),
		// The declared boards — a run dashboard and a step's. `renders` is the
		// only thing that picks the body (boards-migration § 5); the strip, the
		// title and the close are the same as every other page's.
		...boards.map((board) => ({
			id: boardPageId(board.kind, board.subjectId),
			title: BOARD_KINDS[board.kind].label,
			icon: BOARD_KINDS[board.kind].icon,
			content:
				board.kind === "run" ? (
					<RunDashboardPage
						username={username as string}
						graphSlug={graphSlug as string}
						runId={board.runId}
						onOpenStep={(stepId) =>
							openBoard({
								kind: "task_run",
								subjectId: stepId,
								runId: board.runId,
							})
						}
					/>
				) : (
					<StepDashboardPage
						username={username as string}
						graphSlug={graphSlug as string}
						runId={board.runId}
						stepId={board.subjectId}
						onOpenStep={(stepId) =>
							openBoard({
								kind: "task_run",
								subjectId: stepId,
								runId: board.runId,
							})
						}
					/>
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
								<WorkCanvasHeader
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
			return;
		}
		setActiveBoardId(null);
		if (id === GRAPH_PAGE_ID) {
			setWorkKind(null);
			setGlobalModelOpen(false);
			setAllModelsOpen(false);
			backToList();
			return;
		}
		if (id === ALL_MODELS_PAGE_ID) {
			setGlobalModelOpen(false);
			setAllModelsOpen(true);
			return;
		}
		if (id === GLOBAL_MODEL_PAGE_ID) {
			setAllModelsOpen(false);
			setGlobalModelOpen(true);
			return;
		}
		setGlobalModelOpen(false);
		setAllModelsOpen(false);
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
			setBoards((open) => open.filter((b) => b.subjectId !== board.subjectId));
			// Closing the focused board hands the strip back to whatever was
			// behind it, rather than to the board's own neighbour.
			setActiveBoardId((current) => (current === id ? null : current));
			return;
		}
		const page = parseBoardPageId(id);
		if (page?.kind === "data") {
			void closeCanvasTab(page.id);
			return;
		}
		if (id === GLOBAL_MODEL_PAGE_ID) {
			setGlobalModelOpen(false);
			return;
		}
		if (id === ALL_MODELS_PAGE_ID) {
			setAllModelsOpen(false);
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

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in GraphDetail's header (a sibling of <Board>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
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
								content: leftContent,
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
						<BoardPagesViewPanel
							pages={pages}
							activeId={activePageId}
							onSelect={selectPage}
							onAdd={() => void newCanvasTab()}
							addLabel="New canvas"
							menuLabel="Page options"
							// Until each canvas owns its own engine, only the active page is
							// mounted — today's behaviour, now stated rather than emergent.
							keepMounted={false}
							pageMenuItems={[
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
							]}
							headerActions={[
								...pageHeaderActions,
								{
									id: "inspector",
									label: right.is("inspector")
										? "Hide inspector panel"
										: "Show inspector panel",
									icon: right.is("inspector")
										? PanelRightClose
										: PanelRightOpen,
									onClick: toggleInspector,
								},
							]}
							className="h-full"
						/>
					),
				}}
				// One region, one occupant, looked up by `?right=`. A third occupant
				// is one more entry here — not another branch (graph-detail-page.md
				// G16). Each entry carries its own size triple, because the size
				// belongs to what is in the region rather than to the region.
				rightSection={right.key ? rightSections[right.key] : undefined}
				statusMetrics={
					// Live engine telemetry — node/edge totals, zoom, pan, pointer world
					// position, hovered node/edge, selection counts — self-wired off the
					// lifted CanvasContext (same status bar as the canvas-react story).
					// A work canvas has no engine, so it states what it *is* instead:
					// `LIBRARY · 8 steps · 3 agents`.
					workCanvas && workTarget ? (
						<WorkCanvasStatus
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
		</CanvasContext.Provider>
	);
}
