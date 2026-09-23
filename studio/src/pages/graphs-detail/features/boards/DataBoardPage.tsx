/**
 * One canvas, and everything that belongs to it.
 *
 * The Explorer's main region is a **page host**: a session canvas, a model
 * canvas and a work canvas are three kinds of page, not three branches of a
 * ternary (`docs/for-developers/building-studio/the-shell.md`). This is the
 * first kind — a session's canvas with its tab strip, its overlays and the
 * dialogs that act on it.
 *
 * It owns the state that is about **this canvas and nothing else**: which
 * overlays are open, which vertex is being fine-tuned, which canvas is being
 * renamed. State the shell's own regions still read — the contents the
 * inspector shows, the selection, the styling — stays above and arrives as
 * props. Moving that down is what turns this from one instance into one per
 * open canvas, and it is deliberately the next step rather than this one.
 *
 * **The strip is not here.** `mainSection` is `BoardPagesViewPanel`
 * (`docs/for-developers/building-studio/graph-detail-page.md` G4), which owns the
 * tabs for every open page — a canvas, a model, a plan. This page is one body
 * inside it. The five controls that act on *this* canvas — help, layers,
 * styling, history, rename — reach it through {@link BoardPageHandle}, because
 * `BoardHeaderAction` is strip-level and carries no page id (G12).
 *
 * Layers, Styling and History are **one at a time**: all three are cards pinned
 * to the canvas's top-right corner, so opening one closes the other
 * (`docs/for-developers/modules/explore/features/boards.md` CV6).
 */

import { SessionTutorialModal } from "@/pages/graphs-detail/features/ask/assistant/SessionTutorialModal";
import { BoardFormDialog } from "@/pages/graphs-detail/features/boards/BoardFormDialog";
import { BoardHistoryPanel } from "@/pages/graphs-detail/features/boards/BoardHistoryPanel";
import { ExpandFineTunePanel } from "@/pages/graphs-detail/features/explorer";
import type {
	CanvasBackend,
	ExpandMenuHandlers,
	ExpandMenuSchema,
} from "@/pages/graphs-detail/features/explorer";
import { ExplorerCanvas } from "@/pages/graphs-detail/features/explorer";
import { LayersPanel } from "@/pages/graphs-detail/features/explorer";
import {
	type StyleTypeInfo,
	StylingPanel,
} from "@/pages/graphs-detail/features/explorer";
import type { InteractionRef } from "@/services/telemetry/tracer";
import type { CanvasStyling } from "@/types/board";
import type { ExpandRequest, NeighborExpandResponse } from "@/types/traversal";
import { RendererCapabilityBanner } from "@invana/canvas-ui";
import type {
	GraphCanvas as GraphCanvasEngine,
	GraphData,
} from "@invana/graph";
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useMemo,
	useState,
} from "react";

/**
 * What the strip can ask of the canvas page under it. The shell holds one of
 * these for the active page and builds its `headerActions` from it.
 */
export interface BoardPageHandle {
	/** The tutorial — "what can I do here?" */
	openHelp: () => void;
	/** This canvas's layers, elements and their visibility. */
	toggleLayers: () => void;
	/** Per-type styling for this canvas. */
	toggleStyling: () => void;
	/** Saved states, and forking one into a new canvas. */
	toggleHistory: () => void;
	/** Rename this canvas — really its session's title. */
	openRename: (boardId: string) => void;
}

export interface BoardPageProps {
	username: string;
	graphSlug: string;
	/** The canvas this page draws. Null while none is open. */
	boardId: string | null;
	/** The live engine, for the Layers card. Null until `<Board>` publishes it. */
	canvas: GraphCanvasEngine | null;

	/** Resolve a canvas's session, for the rename dialog. */
	sessionIdForTab: (boardId: string) => string | null;
	sessionTitle: (sessionId: string) => string;
	onRenameSession: (id: string, title: string) => Promise<unknown>;

	/** What `<GraphLayer data>` is seeded with. */
	seedData: GraphData;
	magnet: boolean;
	backend: CanvasBackend;
	styling: CanvasStyling;
	styleTypes: { nodeTypes: StyleTypeInfo[]; edgeTypes: StyleTypeInfo[] };
	onStylingChange: (next: CanvasStyling) => void;

	onReady: (canvas: GraphCanvasEngine | null) => void;
	onViewTargetChange: (id: string | null) => void;
	onShowDetail: (id: string) => void;
	interactionRef?: InteractionRef;

	/** Node-expand. `onOpenFineTune` is supplied here, not by the caller — the
	 *  panel it opens is this page's. */
	expand: Omit<ExpandMenuHandlers, "onOpenFineTune">;
	expandSchema: ExpandMenuSchema | null;
	propertyKeys: string[];
	onExpand: (req: ExpandRequest) => Promise<NeighborExpandResponse | null>;

	/** Version history (boards.md). Forking closes the panel, so the page does
	 *  it rather than reaching up for a setter. */
	onFork: (versionId: string) => void;
	isForking: boolean;
	onSave: () => void;
	isSaving: boolean;

	/** Auto-open the tutorial on a user's very first session. */
	tutorialSeen: boolean;
	onTutorialSeen: () => void;
}

export const DataBoardPage = forwardRef<BoardPageHandle, BoardPageProps>(
	function DataBoardPage(
		{
			username,
			graphSlug,
			boardId,
			canvas,
			sessionIdForTab,
			sessionTitle,
			onRenameSession,
			seedData,
			magnet,
			backend,
			styling,
			styleTypes,
			onStylingChange,
			onReady,
			onViewTargetChange,
			onShowDetail,
			interactionRef,
			expand,
			expandSchema,
			propertyKeys,
			onExpand,
			onFork,
			isForking,
			onSave,
			isSaving,
			tutorialSeen,
			onTutorialSeen,
		},
		ref,
	) {
		// Overlays. Each is about this canvas, so each lives with it. The three
		// corner cards share one slot — they share the corner (CV6).
		const [overlay, setOverlay] = useState<
			"layers" | "styling" | "history" | null
		>(null);
		const toggleOverlay = useCallback(
			(next: "layers" | "styling" | "history") =>
				setOverlay((open) => (open === next ? null : next)),
			[],
		);
		const [tutorialOpen, setTutorialOpen] = useState(!tutorialSeen);
		const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
		const [fineTuneVertex, setFineTuneVertex] = useState<string | null>(null);

		const editingSessionId = editingCanvasId
			? sessionIdForTab(editingCanvasId)
			: null;

		// The fine-tune panel is this page's, so the handler that opens it is too —
		// the caller supplies the rest of the expand menu and never this key.
		const expandHandlers = useMemo<ExpandMenuHandlers>(
			() => ({ ...expand, onOpenFineTune: setFineTuneVertex }),
			[expand],
		);

		// A fork opens a *different* canvas, so the panel that offered it is done.
		const handleFork = useCallback(
			(versionId: string) => {
				setOverlay(null);
				onFork(versionId);
			},
			[onFork],
		);

		// The strip's five canvas controls. `BoardHeaderAction.onClick` takes no
		// page id (G12), so the shell cannot address this page by argument — it holds
		// the handle instead and calls straight into it.
		useImperativeHandle(
			ref,
			() => ({
				openHelp: () => setTutorialOpen(true),
				toggleLayers: () => toggleOverlay("layers"),
				toggleStyling: () => toggleOverlay("styling"),
				toggleHistory: () => toggleOverlay("history"),
				openRename: (id: string) => setEditingCanvasId(id),
			}),
			[toggleOverlay],
		);

		const closeTutorial = useCallback(() => {
			onTutorialSeen();
			setTutorialOpen(false);
		}, [onTutorialSeen]);

		return (
			<div className="flex h-full w-full flex-col overflow-hidden">
				<div className="relative min-h-0 w-full flex-1 overflow-hidden">
					<RendererCapabilityBanner />
					<ExplorerCanvas
						data={seedData}
						onReady={onReady}
						onViewTargetChange={onViewTargetChange}
						magnet={magnet}
						interactionRef={interactionRef}
						backend={backend}
						expand={expandHandlers}
						onShowDetail={onShowDetail}
						styling={styling}
					/>
					<LayersPanel
						open={overlay === "layers"}
						canvas={canvas}
						onClose={() => setOverlay(null)}
					/>
					<StylingPanel
						open={overlay === "styling"}
						onClose={() => setOverlay(null)}
						nodeTypes={styleTypes.nodeTypes}
						edgeTypes={styleTypes.edgeTypes}
						styling={styling}
						onChange={onStylingChange}
					/>
					<BoardHistoryPanel
						open={overlay === "history"}
						onClose={() => setOverlay(null)}
						username={username}
						graphSlug={graphSlug}
						boardId={boardId}
						onFork={handleFork}
						isForking={isForking}
						onSave={onSave}
						isSaving={isSaving}
					/>
					{fineTuneVertex && (
						<ExpandFineTunePanel
							open
							vertexId={fineTuneVertex}
							schema={expandSchema}
							propertyKeys={propertyKeys}
							onClose={() => setFineTuneVertex(null)}
							onExpand={onExpand}
						/>
					)}
				</div>
				<BoardFormDialog
					open={editingCanvasId !== null}
					username={username}
					graphSlug={graphSlug}
					boardId={editingCanvasId}
					sessionId={editingSessionId}
					sessionTitle={editingSessionId ? sessionTitle(editingSessionId) : ""}
					onRenameSession={onRenameSession}
					onClose={() => setEditingCanvasId(null)}
				/>
				<SessionTutorialModal open={tutorialOpen} onClose={closeTutorial} />
			</div>
		);
	},
);
