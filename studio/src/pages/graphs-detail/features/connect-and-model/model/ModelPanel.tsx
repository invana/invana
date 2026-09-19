/**
 * The Model panel — authoring, in the one rail (`Model · Observations v2 draft`).
 *
 * The Modeller used to be a page of its own. It is a panel now
 * (docs/for-developers/modules/explore/spec.md), and this is the surface the hi-fi draws:
 *
 * ```
 * Model / Observations / v2 draft        v2 · draft   v1 · active   Publish v2
 * Node types (4)                                                          + add
 *   Pattern     staged   7 props · key · if · then …
 *   Observation          8 props · kind · direction …
 * Edge types (8)                                                          + add
 * ─────────────────────────────────────────────────────────────────────────────
 * 6 staged                                                        ⌘↵ commit
 * ```
 *
 * Two rules from [model-editor.md] are visible in every list here:
 *
 * - **Staged rows sort first** (ME5), each carrying a `staged` chip, so what is
 *   about to land reads before what already has.
 * - **The draft is the staged set** (ME2, ME4). Nothing is posted as you edit;
 *   the bar reads the difference between the draft and the version it replaces,
 *   which is why it survives a reload and reads the same to everyone.
 *
 * The commit is one action for the whole set (ME5) — never a per-row save.
 */

import { useGraphConnectionQuery } from "@/hooks/queries/useGraphs";
import {
	useCommitDraftMutation,
	useCreateDraftMutation,
	useDiscardStagedChangeMutation,
	useDiscardStagedSetMutation,
	useGlobalModelQuery,
	useModelLinksQuery,
	useModelQuery,
	useModelVersionQuery,
	useModelVersionsQuery,
	useModelsQuery,
	useStagedSetQuery,
	useVersionDiffQuery,
} from "@/hooks/queries/useModels";
import { CompatibilityBanner } from "@/pages/graphs-detail/features/connect-and-model/CompatibilityBanner";
import { DeleteModelDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/DeleteModelDialog";
import { EdgeTypeFormDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/EdgeTypeFormDialog";
import { ImportModelDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/ImportModelDialog";
import { ModelFormDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/ModelFormDialog";
import { ModelMetaLine } from "@/pages/graphs-detail/features/connect-and-model/model/components/ModelMetaLine";
import { NodeTypeFormDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/NodeTypeFormDialog";
import type {
	ModelEditCtx,
	ModelSelection,
} from "@/pages/graphs-detail/features/connect-and-model/model/types";
import { useStitchesSection } from "@/pages/graphs-detail/features/connect-and-model/stitch/useStitchesSection";
import { ListPanelChrome } from "@/pages/graphs-detail/shared/ListPanel";
import { SectionTitle } from "@/pages/graphs-detail/shared/SectionTitle";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import { modelsApi } from "@/services/api/models";
import type {
	GraphModelSummary,
	StagedChange,
	StagedSet,
} from "@/types/models";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import {
	Badge,
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	CardFooter,
	PanelStack,
	type PanelStackSection,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	cn,
} from "@invana/ui";
import {
	Boxes,
	Check,
	Download,
	LayoutGrid,
	Link2,
	Lock,
	Pencil,
	Plus,
	RotateCcw,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	/** The model whose draft (or active version) the canvas is drawing. */
	selectedModelId: string | null;
	onSelectModel: (id: string | null) => void;
	/** The type the canvas has selected — its form spans the main column (ME6). */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/** Opens the model canvas in the main area. */
	onOpenCanvas: (modelId: string) => void;
	/** Opens the derived union as its own page — it belongs to no one model. */
	onOpenGlobalModel?: () => void;
	/** Opens every model on one canvas — all models (stitch-models.md ST14). */
	onOpenAllModels?: () => void;
	/** Read what the database actually holds — the mirror, never the model. */
	onIntrospect?: () => void;
	isIntrospecting?: boolean;
}

export function ModelPanel({
	username,
	graphSlug,
	onClose,
	selectedModelId,
	onSelectModel,
	selection,
	onSelect,
	onOpenCanvas,
	onOpenGlobalModel,
	onOpenAllModels,
	onIntrospect,
	isIntrospecting,
}: Props) {
	const [importing, setImporting] = useState(false);
	// Authoring the model itself — its name, description and validation mode.
	// `null` in the dialog means create; a model means edit (DM1: a model is
	// named for its domain, and the name is the first thing anyone changes).
	const [editingModel, setEditingModel] = useState<
		GraphModelSummary | null | "new"
	>(null);
	const [deletingModel, setDeletingModel] = useState<GraphModelSummary | null>(
		null,
	);
	const models = useModelsQuery(username, graphSlug);
	const items = (models.data ?? []).filter((m) => m.origin !== "introspected");
	const selected = items.find((m) => m.id === selectedModelId) ?? null;

	return (
		<>
			<ListPanelChrome
				// The header names what is open, and `Models` is the way back out of
				// it (ME17). It can be a link because `PanelContent`'s title is a
				// `<span>` — a tab label could not have carried one (ME18).
				title={
					selected ? (
						<Breadcrumb>
							<BreadcrumbList className="gap-1 font-semibold sm:gap-1">
								<BreadcrumbItem>
									<BreadcrumbLink asChild>
										<button
											type="button"
											onClick={() => {
												onSelectModel(null);
												onSelect(null);
											}}
										>
											Models
										</button>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem className="min-w-0">
									<BreadcrumbPage className="truncate font-semibold">
										{selected.name}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					) : (
						"Model"
					)
				}
				icon={Boxes}
				onRefresh={() => models.refetch()}
				isRefreshing={models.isFetching}
				searchable={selected === null}
				searchLabel="Search models"
				listControls={selected === null}
				onClose={onClose}
				leadingActions={
					selected === null
						? [
								{
									key: "new",
									name: "New model — named for its domain",
									icon: Plus,
									onClick: () => setEditingModel("new"),
								},
								{
									key: "import",
									name: "Import a model or start from a starter",
									icon: Upload,
									onClick: () => setImporting(true),
								},
								// Every model at once. The list view opens it by itself
								// (ST24), so this is how you get the landscape *back* after
								// closing the page. It lives on the *list* header because it
								// belongs to no single model — the same reason the global
								// model is a page and not a drawer (ST9).
								...(onOpenAllModels
									? [
											{
												key: "all-models",
												name: "All models — the landscape, and what stitches it",
												icon: LayoutGrid,
												onClick: onOpenAllModels,
											},
										]
									: []),
							]
						: [
								{
									key: "edit",
									name: "Edit this model's name and description",
									icon: Pencil,
									onClick: () => setEditingModel(selected),
								},
								{
									key: "delete",
									name: "Delete this model and every version of it",
									icon: Trash2,
									onClick: () => setDeletingModel(selected),
								},
							]
				}
			>
				{({ search }) => {
					if (selected) {
						return (
							<ModelDetail
								key={selected.id}
								username={username}
								graphSlug={graphSlug}
								model={selected}
								selection={selection}
								onSelect={onSelect}
								onOpenGlobalModel={onOpenGlobalModel}
								onEditModel={() => setEditingModel(selected)}
								onDeleteModel={() => setDeletingModel(selected)}
								onIntrospect={onIntrospect}
								isIntrospecting={isIntrospecting}
							/>
						);
					}

					const rows = items.filter((m) =>
						m.name.toLowerCase().includes(search.toLowerCase()),
					);
					return (
						<ModelListView
							username={username}
							graphSlug={graphSlug}
							rows={rows}
							total={items.length}
							isLoading={models.isLoading}
							selectedModelId={selectedModelId}
							onOpenModel={(id) => {
								onSelectModel(id);
								onOpenCanvas(id);
							}}
							onOpenGlobalModel={onOpenGlobalModel}
							onNewModel={() => setEditingModel("new")}
						/>
					);
				}}
			</ListPanelChrome>
			<ModelFormDialog
				open={editingModel !== null}
				username={username}
				graphSlug={graphSlug}
				model={editingModel === "new" ? null : editingModel}
				onClose={() => setEditingModel(null)}
			/>
			<DeleteModelDialog
				model={deletingModel}
				username={username}
				graphSlug={graphSlug}
				onClose={() => setDeletingModel(null)}
				onDeleted={() => {
					// The open model is gone — go back to the list rather than leaving
					// a detail view of something that no longer exists.
					onSelectModel(null);
					onSelect(null);
				}}
			/>
			<ImportModelDialog
				open={importing}
				username={username}
				graphSlug={graphSlug}
				onClose={() => setImporting(false)}
				onImported={(modelId) => {
					setImporting(false);
					onSelectModel(modelId);
					onOpenCanvas(modelId);
				}}
			/>
		</>
	);
}

function ModelListRow({
	model,
	active: selected,
	onClick,
}: {
	model: GraphModelSummary;
	/** The model the panel is open on — it stays marked while the drawer is open. */
	active: boolean;
	onClick: () => void;
}) {
	const active = model.active_version?.version;
	return (
		<WorkRow
			active={selected}
			onClick={onClick}
			tone={active ? "info" : "muted"}
			title={model.name}
			subtitle={
				<span className="truncate">
					{active ? `v${active} active` : "never published"}
					{model.description ? ` · ${model.description}` : ""}
				</span>
			}
		/>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// One model: the version bar, its types, and the staged set
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The list view — three drawers, not a flat list (stitch-models.md ST22).
 *
 * *All models* draws every model on one canvas and reads its panel from here, so
 * the column has to carry what that screen states: the models, every stitch in
 * the Graph (the staged set is the Graph\u2019s, not one model\u2019s), and the
 * derived union. A second panel that listed models would be a second place that
 * can disagree about them (ME19, DS17), so this is the same panel with more in
 * it rather than a new one.
 */
function ModelListView({
	username,
	graphSlug,
	rows,
	total,
	isLoading,
	selectedModelId,
	onOpenModel,
	onOpenGlobalModel,
	onNewModel,
}: {
	username: string;
	graphSlug: string;
	rows: GraphModelSummary[];
	total: number;
	isLoading: boolean;
	selectedModelId: string | null;
	onOpenModel: (id: string) => void;
	onOpenGlobalModel?: () => void;
	onNewModel: () => void;
}) {
	// Graph scope: no model is selected here, and the staged set spans the Graph.
	const {
		section: stitchesSection,
		dialog: stitchesDialog,
		declare: onDeclareStitch,
	} = useStitchesSection({
		username,
		graphSlug,
		versionId: null,
		selection: null,
		scope: "graph",
		onOpenGlobalModel,
	});
	const globalModel = useGlobalModelQuery(username, graphSlug);
	const derived = globalModel.data;
	const links = useModelLinksQuery(username, graphSlug);
	const staged = (links.data ?? []).filter((l) => l.status === "staged").length;
	const active = (links.data ?? []).length - staged;
	const unpublished = rows.filter((m) => !m.active_version).length;

	const sections: PanelStackSection[] = [
		{
			id: "models",
			title: <SectionTitle count={total}>Models</SectionTitle>,
			// No "open all models" row: the list view *is* the landscape — the
			// canvas beside it already draws every model (ST24). The header's icon
			// is how you get it back after closing the page.
			content: (
				<div className="pb-2.5">
					{isLoading ? (
						<div className="p-4">
							<Spinner />
						</div>
					) : rows.length === 0 ? (
						<p className="px-3 text-sm text-muted-foreground">
							No models yet. A model is authored against a domain — not against
							this Graph — so it travels. Start a new one, import an artefact,
							or begin from a starter.
						</p>
					) : (
						rows.map((model) => (
							<ModelListRow
								key={model.id}
								model={model}
								active={model.id === selectedModelId}
								onClick={() => onOpenModel(model.id)}
							/>
						))
					)}
				</div>
			),
		},
		stitchesSection,
		{
			id: "global-model",
			title: <SectionTitle>Global model</SectionTitle>,
			defaultCollapsed: true,
			content: (
				<div className="px-3 pb-2.5">
					{derived ? (
						// Three columns, because each row answers two questions — how
						// many, and derived from what. A count with no provenance is a
						// count nobody can check (the *Global model* artboard, T4).
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Derived</TableHead>
									<TableHead className="text-right">Count</TableHead>
									<TableHead>From</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow>
									<TableCell>Node types</TableCell>
									<TableCell className="text-right tabular-nums">
										{derived.node_types.length}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{derived.model_count}{" "}
										{derived.model_count === 1 ? "model" : "models"}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell>Edge types</TableCell>
									<TableCell className="text-right tabular-nums">
										{derived.edge_types.length}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{derived.model_count}{" "}
										{derived.model_count === 1 ? "model" : "models"}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell>Stitches</TableCell>
									<TableCell className="text-right tabular-nums">
										{derived.link_count}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{derived.anchor_count} anchors ·{" "}
										{derived.relationship_count} relationships
									</TableCell>
								</TableRow>
								{/* Beside the union, never inside it (ST21). */}
								{derived.staged_count > 0 ? (
									<TableRow>
										<TableCell className="text-warning">Staged</TableCell>
										<TableCell className="text-right tabular-nums text-warning">
											{derived.staged_count}
										</TableCell>
										<TableCell className="text-muted-foreground">
											not counted above
										</TableCell>
									</TableRow>
								) : null}
							</TableBody>
						</Table>
					) : (
						<p className="text-sm text-muted-foreground">
							Derived on read from every published model plus its active
							stitches. There is no row behind it.
						</p>
					)}
					{onOpenGlobalModel ? (
						<button
							type="button"
							onClick={onOpenGlobalModel}
							className="mt-1 text-meta text-primary hover:underline"
						>
							Open the global model
						</button>
					) : null}
				</div>
			),
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* The landscape's meta line. Counts, the one rule that is easiest to
			    get wrong about an anchor, and the two things you start here — as
			    the *All models* artboard draws it (T1). This is the only place the
			    counts are stated; the canvas beside it carries none (ST22). */}
			<div className="flex flex-wrap items-center gap-1.5 px-4 pt-2 pb-1">
				<Badge variant="outline" size="xs">
					{total} {total === 1 ? "model" : "models"}
				</Badge>
				<Badge variant="soft" tone="success" size="xs">
					{active} {active === 1 ? "stitch" : "stitches"} · active
				</Badge>
				{staged > 0 ? (
					<Badge variant="soft" tone="warning" size="xs">
						{staged} staged
					</Badge>
				) : null}
				{unpublished > 0 ? (
					<Badge variant="soft" tone="warning" size="xs">
						{unpublished} unpublished
					</Badge>
				) : null}
				<span className="flex-1" />
				<span className="text-meta text-muted-foreground">
					an anchor links, never merges
				</span>
				{/* The two things you start from the landscape, as words. The header
				    icons above do the rest; these two are named because they are what
				    a person is here to do (T1). */}
				<Button size="xs" onClick={onDeclareStitch}>
					<Link2 />
					Declare a stitch
				</Button>
				<Button size="xs" variant="outline" onClick={onNewModel}>
					<Plus />
					New model
				</Button>
			</div>
			<div className="min-h-0 flex-1">
				<PanelStack sections={sections} withHandle />
			</div>
			<PanelStatusBar
				left={<StatusCrumb active>Models</StatusCrumb>}
				middle={[
					<StatusCount key="stitches">
						{active + staged} {active + staged === 1 ? "stitch" : "stitches"}
					</StatusCount>,
					...(staged > 0
						? [
								<StatusCount key="staged" tone="warning">
									{staged} staged
								</StatusCount>,
							]
						: []),
				]}
				right={
					derived
						? `${derived.node_types.length} types derived`
						: "a model belongs to its domain, not to this Graph"
				}
			/>
			{stitchesDialog}
		</div>
	);
}

function ModelDetail({
	username,
	graphSlug,
	model,
	selection,
	onSelect,
	onOpenGlobalModel,
	onEditModel,
	onDeleteModel,
	onIntrospect,
	isIntrospecting,
}: {
	username: string;
	graphSlug: string;
	model: GraphModelSummary;
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	onOpenGlobalModel?: () => void;
	onEditModel: () => void;
	onDeleteModel: () => void;
	onIntrospect?: () => void;
	isIntrospecting?: boolean;
}) {
	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	// The list summary carries neither `validation_mode` nor `created_at`; the
	// detail does, and `ModelMetaLine` renders without waiting for it (ME21).
	const { data: modelDetail } = useModelQuery(username, graphSlug, model.id);
	const versions = useModelVersionsQuery(username, graphSlug, model.id);
	const list = versions.data ?? [];
	const draft = list.find((v) => v.status === "draft") ?? null;
	const active = list.find((v) => v.status === "active") ?? null;

	// The draft is what is edited; with none, the active version is read-only
	// until someone opens the next draft (ME3).
	const openVersionId = draft?.id ?? active?.id ?? null;
	const version = useModelVersionQuery(
		username,
		graphSlug,
		model.id,
		openVersionId ?? undefined,
	);

	const staged = useStagedSetQuery(username, graphSlug, model.id, !!draft);
	const createDraft = useCreateDraftMutation(username, graphSlug);
	const commit = useCommitDraftMutation(username, graphSlug);
	const discardAll = useDiscardStagedSetMutation(username, graphSlug);
	const discardOne = useDiscardStagedChangeMutation(username, graphSlug);

	// Authoring happens on a draft (ME3) — but *needing* one must not mean
	// *finding* one. Every add below is always offered; the first one opens the
	// draft on the way (ME11), so nobody has to know that "New draft" is the
	// secret first step before the editor appears at all.
	const [freshDraftId, setFreshDraftId] = useState<string | null>(null);
	const ctx: ModelEditCtx | undefined = draft
		? { username, graphSlug, modelId: model.id, versionId: draft.id }
		: freshDraftId
			? { username, graphSlug, modelId: model.id, versionId: freshDraftId }
			: undefined;
	const [adding, setAdding] = useState<"node" | "edge" | null>(null);

	/** Open the authoring form, drafting first when this model has no draft. */
	const authoring = async (what: "node" | "edge") => {
		if (!ctx) {
			const version = await createDraft.mutateAsync({
				modelId: model.id,
				basedOn: active?.version ?? null,
			});
			setFreshDraftId(version.id);
		}
		setAdding(what);
	};

	const stagedSet: StagedSet | null = draft ? (staged.data ?? null) : null;
	const stagedNames = new Set(
		(stagedSet?.changes ?? [])
			.filter((c) => c.op !== "removed")
			.map((c) => `${c.kind}:${c.name}`),
	);

	// ⌘↵ commits, exactly as the staged bar says it does.
	useEffect(() => {
		if (!stagedSet?.can_commit) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				commit.mutate({ modelId: model.id });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [stagedSet?.can_commit, commit, model.id]);

	const tree = version.data;
	const nodeTypes = sortStagedFirst(
		tree?.node_types ?? [],
		stagedNames,
		"node_type",
	);
	const edgeTypes = sortStagedFirst(
		tree?.edge_types ?? [],
		stagedNames,
		"edge_type",
	);

	// Stitch hands the model a drawer and a dialog; the model places both
	// (stitch-models.md ST12). One direction — `model → stitch`, never back.
	const { section: stitchesSection, dialog: stitchesDialog } =
		useStitchesSection({
			username,
			graphSlug,
			versionId: active?.id ?? null,
			selection,
			onOpenGlobalModel,
		});

	// Four drawers, always all four (ME14). A section that vanished when its
	// subject emptied would re-lay-out the stack under the reader and throw away
	// the sizes they dragged; an empty body says so instead.
	const sections: PanelStackSection[] = [
		{
			id: "node-types",
			title: <SectionTitle count={nodeTypes.length}>Node types</SectionTitle>,
			headerActions: [
				{
					key: "add",
					name: ctx
						? "Add a node type — or draw one on the canvas"
						: "Add a node type — this opens a draft first",
					icon: Plus,
					onClick: () => void authoring("node"),
				},
			],
			content: (
				<div className="pb-2.5">
					{nodeTypes.length === 0 ? (
						<p className="px-3 text-sm text-muted-foreground">
							Nothing modelled yet.
						</p>
					) : (
						nodeTypes.map((nt) => (
							<TypeRow
								key={nt.id}
								name={nt.name}
								staged={stagedNames.has(`node_type:${nt.name}`)}
								detail={propertySummary(nt.property_mappings?.length ?? 0, nt)}
								active={
									selection?.kind === "node_type" && selection.name === nt.name
								}
								onClick={() => onSelect({ kind: "node_type", name: nt.name })}
							/>
						))
					)}
				</div>
			),
		},
		{
			id: "edge-types",
			title: <SectionTitle count={edgeTypes.length}>Edge types</SectionTitle>,
			headerActions: [
				{
					key: "add",
					name: ctx
						? "Declare an edge type — or drag one type onto another"
						: "Declare an edge type — this opens a draft first",
					icon: Plus,
					onClick: () => void authoring("edge"),
				},
			],
			content: (
				<div className="pb-2.5">
					{edgeTypes.length === 0 ? (
						<p className="px-3 text-sm text-muted-foreground">
							No edge types. Drag one type onto another on the canvas to declare
							one — the endpoints come from the drag.
						</p>
					) : (
						edgeTypes.map((et) => (
							<TypeRow
								key={et.id}
								name={et.name}
								staged={stagedNames.has(`edge_type:${et.name}`)}
								detail={`${(et.source_node_types ?? []).join(" · ") || "—"} → ${
									(et.target_node_types ?? []).join(" · ") || "—"
								}`}
								active={
									selection?.kind === "edge_type" && selection.name === et.name
								}
								onClick={() => onSelect({ kind: "edge_type", name: et.name })}
							/>
						))
					)}
				</div>
			),
		},
		/* Stitching lives here, on the model it is about (stitch-models.md ST12).
		   A link joins two models, so neither owns it — but *declaring* one always
		   starts from a type you already have selected. The union the links imply
		   is a page, not a row in this list: it belongs to no model. */
		stitchesSection,
		{
			id: "staged",
			title: <SectionTitle count={stagedSet?.count ?? 0}>Staged</SectionTitle>,
			defaultCollapsed: true,
			content: (
				<div className="pb-2.5">
					{stagedSet && stagedSet.count > 0 ? (
						stagedSet.changes.map((change) => (
							<StagedRow
								key={change.id}
								change={change}
								onDiscard={() =>
									discardOne.mutate({ modelId: model.id, changeId: change.id })
								}
							/>
						))
					) : (
						<p className="px-3 text-sm text-muted-foreground">
							{draft
								? "Nothing staged. Every add, edit and delete lands here first, and one commit publishes the set (ME2)."
								: "No draft open, so nothing can be staged."}
						</p>
					)}
				</div>
			),
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Where you are is the panel header's crumb (ME17). What this model
			    *is* — description on one line, everything else behind `More`,
			    the version chips among it — is the only row above the stack
			    (ME21). It describes the model, not a drawer. */}
			<ModelMetaLine
				model={model}
				detail={modelDetail}
				version={
					<VersionBar
						draft={draft?.version ?? null}
						active={active?.version ?? null}
						username={username}
						graphSlug={graphSlug}
						modelId={model.id}
						activeVersionId={active?.id ?? null}
					/>
				}
			/>

			{/* Renders nothing when the bound database's version is inside the
			    connector's tested window. When it is not, writes are blocked
			    server-side, and this is where a person finds that out — at the
			    surface that would otherwise refuse their save (ME10). Above the
			    stack, not in it: a blocked write is not a section of the model. */}
			{connection ? (
				<div className="shrink-0 px-3 pt-2.5">
					<CompatibilityBanner
						username={username}
						graphSlug={graphSlug}
						connection={connection}
					/>
				</div>
			) : null}

			{/* The single most confusing state this panel can be in: a published
			    version, where the editor exists but nothing is editable. Saying so
			    — with the one action that changes it — beats leaving a person to
			    infer it from buttons that are not there (ME11). */}
			{!ctx ? (
				<div className="flex shrink-0 items-start gap-2 border-b px-3 py-2.5 text-xs">
					<Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<p className="text-foreground">
							{active
								? `v${active.version} is published — published versions never change.`
								: "Nothing published yet."}
						</p>
						<p className="text-muted-foreground">
							Editing happens on a draft, and committing it publishes the next
							version.
						</p>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="h-6 shrink-0 px-2 text-xs"
						disabled={createDraft.isPending}
						onClick={() =>
							createDraft.mutate(
								{ modelId: model.id, basedOn: active?.version ?? null },
								{ onSuccess: (v) => setFreshDraftId(v.id) },
							)
						}
					>
						{createDraft.isPending ? "Opening…" : "Open a draft"}
					</Button>
				</div>
			) : null}

			{/* The stack fills what is left. Node types and Edge types arrive open
			    and share it; the other two are closed headers beneath them (ME15). */}
			<div className="min-h-0 flex-1">
				<PanelStack sections={sections} withHandle />
			</div>

			<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
				{draft ? (
					<>
						<Button
							size="sm"
							disabled={!stagedSet?.can_commit || commit.isPending}
							// The action says why rather than going quiet (ME5).
							title={stagedSet?.reason ?? "Commit the staged set"}
							onClick={() => commit.mutate({ modelId: model.id })}
						>
							<Check /> Publish {draft.version ? `v${draft.version}` : "draft"}
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={!stagedSet?.count || discardAll.isPending}
							title={
								stagedSet?.count
									? "Put the draft back to the published version"
									: "Nothing staged to discard"
							}
							onClick={() => discardAll.mutate(model.id)}
						>
							<RotateCcw /> Discard
						</Button>
					</>
				) : (
					<Button
						size="sm"
						title="Open the next draft — a published version never changes"
						onClick={() =>
							createDraft.mutate({
								modelId: model.id,
								basedOn: active?.version ?? null,
							})
						}
					>
						<Plus /> New draft
					</Button>
				)}
				<Button
					size="sm"
					variant="outline"
					title="Rename it, or change its description and validation mode"
					onClick={onEditModel}
				>
					<Pencil /> Edit
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={!active}
					title={
						active
							? "One file — package id and content hash travel with it"
							: "Nothing published to export yet"
					}
					onClick={() => downloadArtefact(username, graphSlug, model)}
				>
					<Download /> Export
				</Button>
				<span className="flex-1" />
				<Button
					size="sm"
					variant="ghost"
					title="Delete this model and every version of it"
					onClick={onDeleteModel}
				>
					<Trash2 /> Delete
				</Button>
				{onIntrospect ? (
					<Button
						size="sm"
						variant="ghost"
						disabled={isIntrospecting}
						title="Read what the database actually holds — the mirror, never the model"
						onClick={onIntrospect}
					>
						<Sparkles /> {isIntrospecting ? "Reading…" : "Introspect"}
					</Button>
				) : null}
			</CardFooter>

			{ctx ? (
				<>
					<NodeTypeFormDialog
						open={adding === "node"}
						ctx={ctx}
						nodeType={null}
						existingNodeTypes={tree?.node_types ?? []}
						onClose={() => setAdding(null)}
					/>
					<EdgeTypeFormDialog
						open={adding === "edge"}
						ctx={ctx}
						edgeType={null}
						existingNodeTypes={tree?.node_types ?? []}
						onClose={() => setAdding(null)}
					/>
				</>
			) : null}

			{stitchesDialog}

			<PanelStatusBar
				left={<StatusCrumb active>{model.name}</StatusCrumb>}
				middle={[
					draft ? (
						<StatusCount
							key="staged"
							tone={stagedSet?.count ? "info" : "muted"}
						>
							{stagedSet?.count ?? 0} staged
						</StatusCount>
					) : (
						<StatusCount key="read-only">read-only — no draft open</StatusCount>
					),
				]}
				right={stagedSet?.can_commit ? "⌘↵ commit" : undefined}
			/>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `v2 · draft` beside `v1 · active`, **and what changed between them**.
 *
 * A list of version numbers with no account of what moved is a list nobody can
 * act on (domain-models.md · Surfaces). The draft's account is its staged set,
 * already on the bar below; the published version's is its diff against the one
 * before it, which the title carries so it costs no room.
 */
function VersionBar({
	draft,
	active,
	username,
	graphSlug,
	modelId,
	activeVersionId,
}: {
	draft: string | null;
	active: string | null;
	username: string;
	graphSlug: string;
	modelId: string;
	activeVersionId: string | null;
}) {
	const diff = useVersionDiffQuery(
		username,
		graphSlug,
		modelId,
		activeVersionId ?? undefined,
	);
	const changed = diff.data
		? [
				countLabel(
					"node type",
					diff.data.added_node_types,
					diff.data.removed_node_types,
					diff.data.modified_node_types,
				),
				countLabel(
					"edge type",
					diff.data.added_edge_types,
					diff.data.removed_edge_types,
					diff.data.modified_edge_types,
				),
			]
				.filter(Boolean)
				.join(" · ")
		: "";

	return (
		<span className="flex items-center gap-1.5 text-meta font-semibold leading-none">
			{draft ? (
				<span className="border border-primary/25 bg-primary/15 px-2 py-0.5 text-primary">
					v{draft ?? "—"} · draft
				</span>
			) : null}
			{active ? (
				<span
					className="border border-border px-2 py-0.5 text-muted-foreground"
					title={
						changed
							? `v${active} changed ${changed} against the version before it`
							: `v${active} is the first published version`
					}
				>
					v{active} · active
				</span>
			) : (
				<span className="border border-border px-2 py-0.5 text-muted-foreground">
					never published
				</span>
			)}
		</span>
	);
}

/** `2 node types added, 1 removed` — or nothing, when nothing moved. */
function countLabel(
	noun: string,
	added: string[],
	removed: string[],
	modified: { name: string }[],
): string {
	const parts = [
		added.length ? `+${added.length}` : "",
		removed.length ? `-${removed.length}` : "",
		modified.length ? `~${modified.length}` : "",
	].filter(Boolean);
	return parts.length ? `${parts.join(" ")} ${noun}s` : "";
}

function TypeRow({
	name,
	staged,
	detail,
	active,
	onClick,
}: {
	name: string;
	staged: boolean;
	detail: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<WorkRow
			active={active}
			onClick={onClick}
			tone={staged ? "info" : "muted"}
			title={
				<span className="flex items-center gap-1.5">
					{name}
					{staged ? <StagedChip /> : null}
				</span>
			}
			subtitle={<span className="truncate">{detail}</span>}
		/>
	);
}

/** The chip that marks a row as not-yet-published. */
function StagedChip() {
	return (
		<span className="border border-primary/25 bg-primary/15 px-1.5 py-0.5 text-meta font-semibold uppercase leading-none text-primary">
			staged
		</span>
	);
}

function StagedRow({
	change,
	onDiscard,
}: {
	change: StagedChange;
	onDiscard: () => void;
}) {
	const verb =
		change.op === "added" ? "+" : change.op === "removed" ? "−" : "~";
	return (
		<div className="group flex items-start gap-2 border-b py-1.5 text-sm last:border-b-0">
			<span
				className={cn(
					"w-3 shrink-0 text-center font-mono",
					change.op === "removed" ? "text-destructive" : "text-primary",
				)}
			>
				{verb}
			</span>
			<span className="min-w-0 flex-1">
				<span className="truncate font-medium">{change.name}</span>
				<span className="ml-1.5 text-xs text-muted-foreground">
					{change.kind.replace("_", " ")}
				</span>
				{/* Dependents are named before the commit, never after. */}
				{change.dependents.length ? (
					<span className="block text-xs text-warning">
						still used by {change.dependents.join(", ")}
					</span>
				) : null}
			</span>
			<button
				type="button"
				onClick={onDiscard}
				title="Discard this one change"
				className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface NamedType {
	id: string;
	name: string;
	property_mappings?: unknown[];
	source_node_types?: string[];
	target_node_types?: string[];
}

/** ME5 — staged rows sort first, then the rest alphabetically. */
function sortStagedFirst<T extends NamedType>(
	types: T[],
	stagedNames: Set<string>,
	kind: "node_type" | "edge_type",
): T[] {
	return [...types].sort((a, b) => {
		const aStaged = stagedNames.has(`${kind}:${a.name}`) ? 0 : 1;
		const bStaged = stagedNames.has(`${kind}:${b.name}`) ? 0 : 1;
		return aStaged - bStaged || a.name.localeCompare(b.name);
	});
}

function propertySummary(
	count: number,
	type: { property_mappings?: unknown[] },
): string {
	const names = (type.property_mappings ?? [])
		.map((m) => (m as { property_key?: { name?: string } }).property_key?.name)
		.filter(Boolean)
		.slice(0, 4);
	return `${count} props${names.length ? ` · ${names.join(" · ")}` : ""}${
		count > names.length ? " …" : ""
	}`;
}

/**
 * Export is a file, so it downloads as one. The registry is git
 * (share-a-model.md SM1) — there is nowhere to publish it to.
 */
async function downloadArtefact(
	username: string,
	graphSlug: string,
	model: GraphModelSummary,
) {
	try {
		const artefact = await modelsApi.exportModel(username, graphSlug, model.id);
		const blob = new Blob([JSON.stringify(artefact, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${model.name.toLowerCase().replace(/\s+/g, "-")}-${artefact.version ?? "draft"}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success(
			`${model.name} ${artefact.version ?? ""} exported — commit it to git.`,
		);
	} catch {
		// The client already toasted the engine's own message.
	}
}
