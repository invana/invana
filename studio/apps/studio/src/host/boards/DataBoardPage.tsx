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
 * record card shows, the selection, the styling — stays above and arrives as
 * props. Moving that down is what turns this from one instance into one per
 * open canvas, and it is deliberately the next step rather than this one.
 *
 * **The strip is not here.** `mainSection` is `Workbook`
 * (`docs/for-developers/building-studio/graph-detail-page.md`), which owns the
 * tabs for every open page. The strip holds tabs and nothing else; the tab
 * menu's *Rename* reaches this page through {@link BoardPageHandle}.
 *
 * What floats over the board (`docs/products/explorer.md`):
 *
 * | Where | What |
 * |---|---|
 * | top-left | the toolbar — select · lasso · box, the full set with *Tools* on |
 * | top-right | one card at a time: a record, Layers, Styling or History |
 * | bottom-left | the legend, with *Tools* on |
 * | bottom-right | zoom in · zoom out · fit |
 *
 * Opening a corner card closes the one before it — they share the corner.
 */

import {
	LayersViewPanel,
	Panel,
	PanelContent,
	RendererCapabilityBanner,
	StylingViewPanel,
} from "@invana/canvas-ui";
import type {
	GraphCanvas as GraphCanvasEngine,
	GraphData,
	GraphLayer,
} from "@invana/graph";
import { SessionTutorialModal } from "@invana-studio/assistant";
import type { CanvasBackend } from "@invana-studio/canvases";
import type { InteractionRef, QueryResultItem } from "@invana-studio/core";
import type {
	ExpandMenuHandlers,
	ExpandMenuSchema,
	ExpandRequest,
	NeighborExpandResponse,
} from "@invana-studio/explorer";
import {
	BoardLegend,
	type BoardOverlay,
	BoardToolbar,
	ExpandNeighboursDialog,
	ExplorerCanvas,
	RecordCard,
	useExplorerTools,
	ZoomControls,
} from "@invana-studio/explorer";
import type { CanvasStyling } from "@invana-studio/shell";
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useMemo,
	useState,
} from "react";
import { BoardFormDialog } from "@/host/boards/BoardFormDialog";
import { BoardHistoryWidget } from "@/host/boards/BoardHistoryWidget";

/**
 * What the strip can ask of the canvas page under it. The shell holds one of
 * these for the active page and builds its `headerActions` from it.
 */
export interface BoardPageHandle {
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
	onStylingChange: (next: CanvasStyling) => void;

	onReady: (canvas: GraphCanvasEngine | null) => void;
	onViewTargetChange: (id: string | null) => void;
	onShowDetail: (id: string) => void;
	interactionRef?: InteractionRef;

	/** The record clicked on the board, drawn as the top-right card. */
	selected: QueryResultItem | null;
	/** Records the Graph no longer holds, marked on their card. */
	missingIds: ReadonlySet<string>;
	modelName: (modelId: string) => string | undefined;
	onOpenModel: (modelId: string) => void;
	onCloseRecord: () => void;
	/** The card's *Ask about* — the selection rides along as the attachment.
	 *  Absent while the assistant is off. */
	onAskAboutRecord?: () => void;

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
			onStylingChange,
			onReady,
			onViewTargetChange,
			onShowDetail,
			interactionRef,
			selected,
			missingIds,
			modelName,
			onOpenModel,
			onCloseRecord,
			onAskAboutRecord,
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
		// Overlays. Each is about this canvas, so each lives with it. The
		// corner cards share one slot — they share the corner — and a record
		// card shows only while none of them is open.
		const [overlay, setOverlay] = useState<BoardOverlay | null>(null);
		const toggleOverlay = useCallback(
			(next: BoardOverlay) =>
				setOverlay((open) => (open === next ? null : next)),
			[],
		);
		const [toolsOn] = useExplorerTools();
		const [legendShown, setLegendShown] = useState(true);
		// The board's graph store — read off the engine, since this page sits
		// above the canvas root that the store hooks resolve from.
		const store =
			(canvas?.layers.get("graph") as GraphLayer | undefined)?.store ?? null;
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

		// The tab menu's *Rename*. A page menu item carries only the page id,
		// so the shell holds the handle and calls straight into it.
		useImperativeHandle(
			ref,
			() => ({ openRename: (id: string) => setEditingCanvasId(id) }),
			[],
		);

		// A clicked record opens its card in the corner, in place of whatever
		// tool card was there.
		const selectedId = selected ? String(selected.id) : null;
		const selectedType = selected
			? String(
					(selected.type === "vertex"
						? store?.getNode(selectedId as string)?.type
						: store?.getEdge(selectedId as string)?.type) ?? selected.label,
				)
			: "";

		const closeTutorial = useCallback(() => {
			onTutorialSeen();
			setTutorialOpen(false);
		}, [onTutorialSeen]);

		return (
			<div className="flex h-full w-full flex-col overflow-hidden">
				<div className="relative min-h-0 w-full flex-1 overflow-hidden">
					<RendererCapabilityBanner />
					{canvas && (
						<Panel position="top-left" offset={12} zIndex={20}>
							<BoardToolbar
								overlay={overlay}
								onToggleOverlay={toggleOverlay}
								canExpand={selected?.type === "vertex"}
								onExpandSelection={() =>
									selectedId && setFineTuneVertex(selectedId)
								}
								legendShown={legendShown}
								onToggleLegend={() => setLegendShown((v) => !v)}
							/>
						</Panel>
					)}
					{canvas && (
						<Panel position="bottom-right" offset={12} zIndex={20}>
							<ZoomControls />
						</Panel>
					)}
					{canvas && toolsOn && legendShown && (
						<Panel position="bottom-left" offset={12} zIndex={20}>
							<BoardLegend styling={styling} />
						</Panel>
					)}
					{selected && !overlay && (
						<Panel position="top-right" offset={12} zIndex={20}>
							<RecordCard
								item={selected}
								recordType={selectedType}
								missing={missingIds.has(String(selected.id))}
								modelName={modelName}
								onOpenModel={onOpenModel}
								onAsk={onAskAboutRecord}
								onExpand={
									selected.type === "vertex"
										? () => setFineTuneVertex(String(selected.id))
										: undefined
								}
								onHide={() => {
									if (selected.type === "vertex")
										store?.hideNode(String(selected.id));
									else store?.hideEdge(String(selected.id));
									onCloseRecord();
								}}
								onClose={onCloseRecord}
							/>
						</Panel>
					)}
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
					{overlay === "layers" && (
						<Panel position="top-right" offset={12} zIndex={20}>
							<PanelContent
								width={320}
								className="max-h-[70vh]"
								header="Layers"
								onClose={() => setOverlay(null)}
							>
								<LayersViewPanel canvas={canvas} />
							</PanelContent>
						</Panel>
					)}
					{overlay === "styling" && (
						// The card only edits: `ExplorerCanvas` paints the styling,
						// so a board keeps it while the card is closed.
						<Panel position="top-right" offset={12} zIndex={20}>
							<PanelContent
								width={288}
								className="max-h-[70vh]"
								header="Styling"
								onClose={() => setOverlay(null)}
							>
								<StylingViewPanel
									canvas={canvas}
									apply={false}
									value={styling}
									onChange={onStylingChange}
								/>
							</PanelContent>
						</Panel>
					)}
					<BoardHistoryWidget
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
						<ExpandNeighboursDialog
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
