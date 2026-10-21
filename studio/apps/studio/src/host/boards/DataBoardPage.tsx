/**
 * One canvas, and everything that belongs to it.
 *
 * The Explorer's main region is a **page host**: a session canvas, a model
 * canvas and a work canvas are three kinds of page, not three branches of a
 * ternary (`docs/for-developers/building-studio/the-shell.md`). This is the
 * first kind — a session's canvas, its panel rail and the dialogs that act on it.
 *
 * It owns the state that is about **this canvas and nothing else**: which
 * vertex is being fine-tuned and which canvas is being renamed. State the
 * shell's own regions still read — the selection, the styling — stays above
 * and arrives as props.
 *
 * **The strip is not here.** `mainSection` is `Workbook`
 * (`docs/for-developers/building-studio/graph-detail-page.md`), which owns the
 * tabs for every open page. The strip holds tabs and nothing else; the tab
 * menu's *Rename* reaches this page through {@link BoardPageHandle}.
 *
 * The board — its modes, rows, dock, menus and rail — is canvas's `GraphBoard`,
 * through `ExplorerCanvas`. This page adds what only Studio knows
 * (`docs/products/explorer.md`): the model the Element panel edits against,
 * the save, provenance, *Ask about*, the engine's expansion and its fine-tune
 * dialog, and the *Versions* panel.
 *
 * | Panel | Shows | Offered in |
 * |---|---|---|
 * | Legend | the drawn types; a click hides one | every work mode |
 * | Styling | per-type colour, size, label; *Size by connections* | every work mode |
 * | History | this board's undo history | every work mode |
 * | Versions | the board's saved versions; a restore forks | every work mode |
 * | Element | the clicked element, its provenance, *Ask about* · *Expand* · *Hide*; editable in Edit | Explore · Edit |
 * | Annotations | what is said about the loaded records, and the graph's other annotations | every work mode |
 * | Changes | what is unsaved, saved to the graph | Edit, and any mode while something is unsaved |
 * | Export | the board as an image or its data | every work mode |
 *
 * **Edit mode** (docs/for-developers/modules/explore/features/edit-the-graphs-data.md):
 * the Element panel edits what is clicked or drawn, its types and keys from the
 * graph's model at its active version; Changes saves to the graph. Save is
 * disabled, with the reason, for a member below contributor, on a read-only
 * connection, and on a graph with no published model.
 *
 * **Annotate mode** (docs/for-developers/modules/explore/features/annotations.md):
 * the graph's annotations are drawn on the records the board loaded and written
 * back through the engine; a member below contributor reads them, with Annotate
 * off in the picker. How they show is saved in the board's styling.
 */

import type { BoardPanelSpec, ElementFooter } from "@invana/canvas-ui";
import { RendererCapabilityBanner } from "@invana/canvas-ui";
import type {
	GraphCanvas as GraphCanvasEngine,
	GraphData,
	GraphLayer,
} from "@invana/graph";
import { Button } from "@invana/ui";
import { SessionTutorialModal } from "@invana-studio/assistant";
import type { CanvasBackend } from "@invana-studio/canvases";
import {
	type InteractionRef,
	type QueryResultItem,
	useAuth,
	useGraphConnectionQuery,
} from "@invana-studio/core";
import type {
	ExpandMenuHandlers,
	ExpandMenuSchema,
	ExpandRequest,
	NeighborExpandResponse,
} from "@invana-studio/explorer";
import {
	ExpandNeighboursDialog,
	ExplorerCanvas,
	elementSchemaOf,
	isProvenanceKey,
	ProvenanceBlock,
	readProvenance,
	saveBoardChanges,
	useBoardAnnotations,
} from "@invana-studio/explorer";
import { useActiveVersionQuery } from "@invana-studio/modeller";
import { type CanvasStyling, useAccess } from "@invana-studio/shell";
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
	/** The live engine. Null until the board publishes it. */
	canvas: GraphCanvasEngine | null;

	/** Resolve a canvas's session, for the rename dialog. */
	sessionIdForTab: (boardId: string) => string | null;
	sessionTitle: (sessionId: string) => string;
	onRenameSession: (id: string, title: string) => Promise<unknown>;

	/** What the board's graph layer is seeded with. */
	seedData: GraphData;
	magnet: boolean;
	backend: CanvasBackend;
	styling: CanvasStyling;
	onStylingChange: (next: CanvasStyling) => void;

	onReady: (canvas: GraphCanvasEngine | null) => void;
	onViewTargetChange: (id: string | null) => void;
	interactionRef?: InteractionRef;

	/** The query record of the clicked element, for the Element panel's actions. */
	selected: QueryResultItem | null;
	/** Records the Graph no longer holds, marked in the Element panel. */
	missingIds: ReadonlySet<string>;
	modelName: (modelId: string) => string | undefined;
	onOpenModel: (modelId: string) => void;
	onCloseRecord: () => void;
	/** The Element panel's *Ask about* — the selection rides along as the
	 *  attachment. Absent while the assistant is off. */
	onAskAboutRecord?: () => void;

	/** Node-expand. The fine-tune dialog is this page's. */
	expand: Omit<ExpandMenuHandlers, "onOpenFineTune">;
	expandSchema: ExpandMenuSchema | null;
	propertyKeys: string[];
	onExpand: (req: ExpandRequest) => Promise<NeighborExpandResponse | null>;

	/** Saved versions (boards.md). A restore forks into a new canvas. */
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
		const [tutorialOpen, setTutorialOpen] = useState(!tutorialSeen);
		const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
		const [fineTuneVertex, setFineTuneVertex] = useState<string | null>(null);

		// Editing the graph's data (4.7): the model the editor follows, and whether
		// this member may save to this graph now — and if not, why.
		const activeVersion = useActiveVersionQuery(username, graphSlug);
		const connection = useGraphConnectionQuery(username, graphSlug);
		const { gate } = useAccess();
		const schema = useMemo(
			() => elementSchemaOf(activeVersion.data),
			[activeVersion.data],
		);
		const work = gate("work");
		const refusal: string | null = !work.allowed
			? work.reason
			: connection.data?.read_only
				? "This graph's connection is read-only."
				: activeVersion.isLoading
					? "Reading the model…"
					: !schema
						? "Publish a model to edit this graph's data."
						: null;
		const modelVersionId = activeVersion.data?.id;

		// The graph's annotations (4.8): read by every member, written by a contributor.
		const { user } = useAuth();
		const boardSessionId = boardId ? sessionIdForTab(boardId) : null;
		const boardAnnotations = useBoardAnnotations(username, graphSlug, {
			me: user?.id ?? null,
			sessionId: boardSessionId,
		});
		const annotations = useMemo(
			() => ({
				annotations: boardAnnotations.annotations,
				onAnnotationCreate: boardAnnotations.onCreate,
				onAnnotationUpdate: boardAnnotations.onUpdate,
				onAnnotationDelete: boardAnnotations.onDelete,
				annotationActor: {
					id: user?.id ?? null,
					canWrite: work.allowed,
					...(work.reason ? { whyNot: work.reason } : {}),
					canSaveView: true,
				},
			}),
			[boardAnnotations, user?.id, work.allowed, work.reason],
		);

		const editingSessionId = editingCanvasId
			? sessionIdForTab(editingCanvasId)
			: null;

		// The tab menu's *Rename*. A page menu item carries only the page id,
		// so the shell holds the handle and calls straight into it.
		useImperativeHandle(
			ref,
			() => ({ openRename: (id: string) => setEditingCanvasId(id) }),
			[],
		);

		// The board's *Expand neighbours* is the engine's expansion, per node.
		const expandNeighbours = expand.onExpand;
		const onExpandNodes = useCallback(
			(nodeIds: string[]) => {
				for (const id of nodeIds)
					expandNeighbours?.({ kind: "neighbors", body: { vertex_id: id } });
			},
			[expandNeighbours],
		);
		// *Expand…* opens this page's fine-tune dialog.
		const menus = useMemo(
			() => ({
				node: ({ id }: { id: string }) => [
					{
						id: "expand-by",
						label: "Expand…",
						onClick: () => setFineTuneVertex(id),
					},
				],
			}),
			[],
		);

		// The Element panel's acts follow the shown element, and act on the
		// query record it came from — an element drawn and not saved has none.
		const hideRecord = useCallback(
			(item: QueryResultItem) => {
				const store = canvas?.layers.get<GraphLayer>("graph")?.store;
				if (item.type === "vertex") store?.setNodeHidden(String(item.id), true);
				else store?.setEdgeHidden(String(item.id), true);
				onCloseRecord();
			},
			[canvas, onCloseRecord],
		);
		const footer = useCallback<
			Extract<ElementFooter, (...a: never[]) => unknown>
		>(
			(element) => {
				const record =
					selected && String(selected.id) === element.id ? selected : null;
				if (!record) return null;
				return (
					<>
						{onAskAboutRecord && (
							<Button size="sm" variant="outline" onClick={onAskAboutRecord}>
								Ask about
							</Button>
						)}
						{record.type === "vertex" && (
							<Button
								size="sm"
								variant="outline"
								onClick={() => setFineTuneVertex(String(record.id))}
							>
								Expand…
							</Button>
						)}
						<Button
							size="sm"
							variant="ghost"
							onClick={() => hideRecord(record)}
						>
							Hide
						</Button>
					</>
				);
			},
			[selected, onAskAboutRecord, hideRecord],
		);
		const renderExtra = useCallback(
			(element: { id: string; data?: unknown }) => {
				const provenance = readProvenance(
					element.data as Record<string, unknown> | undefined,
				);
				return (
					<>
						{missingIds.has(element.id) && (
							<p className="text-muted-foreground">
								The graph no longer holds this record.
							</p>
						)}
						<ProvenanceBlock
							provenance={provenance}
							{...(provenance
								? { modelName: modelName(provenance.modelId) }
								: {})}
							onOpenModel={onOpenModel}
						/>
					</>
				);
			},
			[missingIds, modelName, onOpenModel],
		);

		const panelOptions = useMemo(
			() => ({
				element: {
					...(schema ? { schema, strictSchema: true } : {}),
					hiddenKeys: isProvenanceKey,
					labelField: false,
					renderExtra,
					footer,
				},
				changes: {
					saveTarget: `Saves to the graph${schema ? " · checked against its model" : ""}`,
					...(refusal ? { saveDisabledReason: refusal } : {}),
					onSave: () =>
						canvas
							? saveBoardChanges(canvas, {
									username,
									graphSlug,
									...(modelVersionId ? { modelVersionId } : {}),
								})
							: Promise.resolve(),
				},
				export: { filename: graphSlug },
			}),
			[
				schema,
				renderExtra,
				footer,
				refusal,
				canvas,
				username,
				graphSlug,
				modelVersionId,
			],
		);

		// *Versions* — the board's saved states — sits after its undo history.
		const panels = useCallback(
			(rail: BoardPanelSpec[]): BoardPanelSpec[] => {
				const versions: BoardPanelSpec = {
					id: "versions",
					title: "Versions",
					icon: "versions",
					render: () => (
						<BoardHistoryWidget
							open
							embedded
							onClose={() => {}}
							username={username}
							graphSlug={graphSlug}
							boardId={boardId}
							onFork={onFork}
							isForking={isForking}
							onSave={onSave}
							isSaving={isSaving}
						/>
					),
				};
				const at = rail.findIndex((p) => p.id === "history") + 1;
				return [...rail.slice(0, at), versions, ...rail.slice(at)];
			},
			[username, graphSlug, boardId, onFork, isForking, onSave, isSaving],
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
						styling={styling}
						onStylingChange={onStylingChange}
						onExpand={onExpandNodes}
						menus={menus}
						panelOptions={panelOptions}
						panels={panels}
						annotations={annotations}
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
