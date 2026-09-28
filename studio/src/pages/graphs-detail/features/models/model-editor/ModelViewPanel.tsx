/**
 * The Models panel — the list, and a model's three sections (the-model-page.md).
 *
 * **The panel lists; the page acts.** The list view is only the models: a click
 * **selects** — it sets the page's scope and keeps its tab, so stepping down the
 * list compares models on one reading — and `Open` drills in. Drilled in, the
 * panel is a `PanelStack` of **Node types · Edge types · Stitches** under
 * the `MODELS / <name>` crumb, and nothing acts on the model itself: `Edit`,
 * `Publish`, `Rename`, `Export`, `Archive` and `Introspect` are on the page
 * header, because they act on what the page shows. The staged set is the bar
 * under that header, not a section.
 *
 * ```
 * ‹  MODELS / AirRoutes
 * NODE TYPES  4                                                    + add
 *   airport   staged   14 props · code · icao …
 * EDGE TYPES  2                                                    + add
 * STITCHES  3
 * ```
 *
 * Scope and panel are one state, and it is the URL's (`useModelsView`): the row
 * selected here is the scope the page reads, so a reload lands on both.
 */

import { Switch } from "@invana/forms";
import {
	Button,
	PanelStack,
	type PanelStackSection,
	SearchInput,
	Spinner,
} from "@invana/ui";
import { useQueries } from "@tanstack/react-query";
import {
	BookOpen,
	Boxes,
	ChevronLeft,
	ChevronRight,
	Plus,
	Search,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { modelsApi } from "@/pages/graphs-detail/features/models/api";
import { EdgeTypeFormDialog } from "@/pages/graphs-detail/features/models/model-editor/components/EdgeTypeFormDialog";
import { ImportModelDialog } from "@/pages/graphs-detail/features/models/model-editor/components/ImportModelDialog";
import { ModelFormDialog } from "@/pages/graphs-detail/features/models/model-editor/components/ModelFormDialog";
import { NodeTypeFormDialog } from "@/pages/graphs-detail/features/models/model-editor/components/NodeTypeFormDialog";
import type {
	ModelEditCtx,
	ModelSelection,
} from "@/pages/graphs-detail/features/models/model-editor/types";
import { useModelsView } from "@/pages/graphs-detail/features/models/model-page/useModelsView";
import {
	useModelsQuery,
	useModelVersionQuery,
	useModelVersionsQuery,
	useStagedSetQuery,
	useUpdateModelMutation,
} from "@/pages/graphs-detail/features/models/queries";
import { useStitchesSection } from "@/pages/graphs-detail/features/models/stitch/useStitchesSection";
import type { GraphModelSummary } from "@/pages/graphs-detail/features/models/types";
import { RecordRow } from "@/pages/graphs-detail/shared/RecordRow";
import { SectionTitle } from "@/pages/graphs-detail/shared/SectionTitle";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";

interface Props {
	username: string;
	graphSlug: string;
	/** The type the Model tab has selected — the sections light it. */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/**
	 * Bring the model page forward — a row picked here reads there. It returns
	 * the URL keys that name the page, written with the scope in one update.
	 */
	onShowPage: () => Record<string, string | null>;
	/** Membership is binary today, so every member writes. */
	canWrite?: boolean;
}

export function ModelViewPanel({
	username,
	graphSlug,
	selection,
	onSelect,
	onShowPage,
	canWrite = true,
}: Props) {
	const { view, set } = useModelsView();
	const [showArchived, setShowArchived] = useState(false);
	const models = useModelsQuery(username, graphSlug, {
		includeArchived: showArchived,
	});
	const all = (models.data ?? []).filter((m) => m.origin !== "introspected");
	const live = all.filter((m) => m.status !== "archived");
	const archived = all.filter((m) => m.status === "archived");
	const scoped = live.find((m) => m.id === view.scope) ?? null;

	if (scoped && view.open)
		return (
			<ModelDetail
				key={scoped.id}
				username={username}
				graphSlug={graphSlug}
				model={scoped}
				selection={selection}
				onSelect={(next) => {
					onSelect(next);
					if (next) set({ tab: "model" }, onShowPage());
				}}
				onBack={() => set({ open: false })}
				canWrite={canWrite}
			/>
		);

	return (
		<ModelListView
			username={username}
			graphSlug={graphSlug}
			items={live}
			archived={showArchived ? archived : []}
			showArchived={showArchived}
			onShowArchived={setShowArchived}
			isLoading={models.isLoading}
			selectedModelId={scoped?.id ?? null}
			onSelectModel={(id) => {
				// A click selects and keeps the tab.
				onSelect(null);
				set({ scope: id }, onShowPage());
			}}
			onOpenModel={(id) => {
				// Drilling in is for authoring, so the page turns to the Model tab.
				set({ scope: id, open: true, tab: "model" }, onShowPage());
			}}
			canWrite={canWrite}
		/>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// The list
// ─────────────────────────────────────────────────────────────────────────────

function ModelListView({
	username,
	graphSlug,
	items,
	archived,
	showArchived,
	onShowArchived,
	isLoading,
	selectedModelId,
	onSelectModel,
	onOpenModel,
	canWrite,
}: {
	username: string;
	graphSlug: string;
	items: GraphModelSummary[];
	archived: GraphModelSummary[];
	showArchived: boolean;
	onShowArchived: (on: boolean) => void;
	isLoading: boolean;
	selectedModelId: string | null;
	onSelectModel: (id: string) => void;
	onOpenModel: (id: string) => void;
	canWrite: boolean;
}) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [creating, setCreating] = useState(false);
	const [importing, setImporting] = useState(false);
	const restore = useUpdateModelMutation(username, graphSlug);

	const match = (m: GraphModelSummary) =>
		!search || m.name.toLowerCase().includes(search.toLowerCase());
	const rows = items.filter(match);
	const published = items.filter((m) => m.active_version).length;

	// The version readout needs each model's draft, which the summary does not
	// carry — one small read per model, shared with the page's own.
	const versions = useQueries({
		queries: items.map((m) => ({
			queryKey: ["models", username, graphSlug, m.id, "versions"],
			queryFn: () => modelsApi.listVersions(username, graphSlug, m.id),
		})),
	});
	const readout = (m: GraphModelSummary, i: number) => {
		const draft = versions[i]?.data?.find((v) => v.status === "draft");
		if (draft) return draft.version ? `v${draft.version} · draft` : "draft";
		return m.active_version
			? `v${m.active_version.version} · active`
			: "never published";
	};

	const sections: PanelStackSection[] = [
		{
			id: "models",
			icon: Boxes,
			title: <SectionTitle count={items.length}>Models</SectionTitle>,
			headerActions: [
				...(canWrite
					? [
							{
								key: "new",
								name: "New model — named for its domain",
								icon: Plus,
								onClick: () => setCreating(true),
							},
							{
								key: "import",
								name: "Import a model",
								icon: Upload,
								onClick: () => setImporting(true),
							},
							{
								key: "starters",
								name: "Starter models",
								icon: BookOpen,
								onClick: () => setImporting(true),
							},
						]
					: []),
				{
					key: "search",
					name: "Search models",
					icon: Search,
					className: searchOpen ? "bg-muted text-foreground" : undefined,
					onClick: () => {
						setSearchOpen((v) => !v);
						setSearch("");
					},
				},
			],
			actionsOnHover: false,
			content: (
				<div className="flex h-full min-h-0 flex-col">
					{searchOpen ? (
						<div className="border-b px-3 py-2">
							<SearchInput
								inputSize="sm"
								autoFocus
								value={search}
								placeholder="Search models"
								onChange={setSearch}
							/>
						</div>
					) : null}
					<div className="min-h-0 flex-1 overflow-y-auto pb-2.5">
						{isLoading ? (
							<div className="px-3 py-4">
								<Spinner />
							</div>
						) : rows.length === 0 ? (
							<p className="px-3 text-base text-muted-foreground">
								{search
									? `No model here is called “${search}”.`
									: "No models yet. A model is authored against a domain — not against this Graph — so it travels. Start a new one, import an artefact, or begin from a starter."}
							</p>
						) : (
							rows.map((m) => {
								const selected = m.id === selectedModelId;
								return (
									<RecordRow
										key={m.id}
										active={selected}
										onClick={() => onSelectModel(m.id)}
										tone={m.active_version ? "info" : "muted"}
										title={
											<span className="flex items-center gap-1.5">
												{m.name}
												<span className="font-mono text-sm text-muted-foreground">
													{readout(m, items.indexOf(m))}
												</span>
											</span>
										}
										subtitle={
											<span className="truncate">
												{m.description || "No description."}
											</span>
										}
										pinActions={selected}
										actions={
											selected ? (
												<Button
													size="sm"
													variant="ghost"
													onClick={() => onOpenModel(m.id)}
												>
													<ChevronRight /> Open
												</Button>
											) : null
										}
									/>
								);
							})
						)}
						{archived.filter(match).map((m) => (
							<RecordRow
								key={m.id}
								className="opacity-60"
								tone="muted"
								title={m.name}
								subtitle={
									<span className="truncate">
										archived · its versions still resolve
									</span>
								}
								pinActions
								actions={
									canWrite ? (
										<Button
											size="sm"
											variant="ghost"
											disabled={restore.isPending}
											onClick={() =>
												restore.mutate(
													{ id: m.id, data: { status: "active" } },
													{
														onSuccess: () =>
															toast.success(`${m.name} restored.`),
													},
												)
											}
										>
											Restore
										</Button>
									) : null
								}
							/>
						))}
					</div>
					<div className="flex shrink-0 items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
						<Switch
							id="models-show-archived"
							aria-label="Show archived"
							checked={showArchived}
							onCheckedChange={onShowArchived}
						/>
						<label htmlFor="models-show-archived">Show archived</label>
						{showArchived && archived.length ? ` · ${archived.length}` : ""}
					</div>
				</div>
			),
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack sections={sections} withHandle />
			</div>
			<PanelStatusBar
				left={<StatusCrumb active>Models</StatusCrumb>}
				middle={[
					<StatusCount key="published">{published} published</StatusCount>,
					...(items.length > published
						? [
								<StatusCount key="drafts" tone="warning">
									{items.length - published} never published
								</StatusCount>,
							]
						: []),
				]}
				right="a click reads it · Open authors it"
			/>
			<ModelFormDialog
				open={creating}
				username={username}
				graphSlug={graphSlug}
				model={null}
				onClose={() => setCreating(false)}
			/>
			<ImportModelDialog
				open={importing}
				username={username}
				graphSlug={graphSlug}
				onClose={() => setImporting(false)}
				onImported={(modelId) => {
					setImporting(false);
					onOpenModel(modelId);
				}}
			/>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// One model: its three sections
// ─────────────────────────────────────────────────────────────────────────────

function ModelDetail({
	username,
	graphSlug,
	model,
	selection,
	onSelect,
	onBack,
	canWrite,
}: {
	username: string;
	graphSlug: string;
	model: GraphModelSummary;
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/** Back to the list, the row still selected — the crumb's chevron. */
	onBack: () => void;
	canWrite: boolean;
}) {
	const versions = useModelVersionsQuery(username, graphSlug, model.id);
	const list = versions.data ?? [];
	const draft = list.find((v) => v.status === "draft") ?? null;
	const active = list.find((v) => v.status === "active") ?? null;
	const openVersionId = draft?.id ?? active?.id ?? null;
	const version = useModelVersionQuery(
		username,
		graphSlug,
		model.id,
		openVersionId ?? undefined,
	);
	const staged = useStagedSetQuery(username, graphSlug, model.id, !!draft);

	// Adding is authoring, and authoring is on a draft: `+ add` is on the
	// two type sections while one is open, and `Edit` on the page opens one.
	const ctx: ModelEditCtx | undefined =
		draft && canWrite
			? { username, graphSlug, modelId: model.id, versionId: draft.id }
			: undefined;
	const [adding, setAdding] = useState<"node" | "edge" | null>(null);

	const stagedNames = new Set(
		(draft ? (staged.data?.changes ?? []) : [])
			.filter((c) => c.op !== "removed")
			.map((c) => `${c.kind}:${c.name}`),
	);
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

	// Stitch hands the model a section and a dialog; the model places both
	// (stitch-models.md). One direction — `model → stitch`, never back.
	const { section: stitchesSection, dialog: stitchesDialog } =
		useStitchesSection({
			username,
			graphSlug,
			versionId: active?.id ?? null,
			selection,
		});

	const sections: PanelStackSection[] = [
		{
			// The drill-in is the first section: `MODELS / AirRoutes`
			// is its header and the chevron the way back. Its body is empty — what
			// the model *is* reads on the page header.
			id: "model",
			title: (
				<span className="flex min-w-0 items-center gap-1">
					<span className="shrink-0 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						Models
					</span>
					<span className="shrink-0 text-muted-foreground opacity-60">/</span>
					<span className="truncate font-medium">{model.name}</span>
				</span>
			),
			headerActions: [
				{
					key: "back",
					name: "Back to models",
					icon: ChevronLeft,
					onClick: onBack,
				},
			],
			actionsOnHover: false,
			// A header and nothing under it — collapsed, it is the crumb alone.
			defaultCollapsed: true,
			content: null,
		},
		{
			id: "node-types",
			title: <SectionTitle count={nodeTypes.length}>Node types</SectionTitle>,
			headerActions: ctx
				? [
						{
							key: "add",
							name: "Add a node type",
							icon: Plus,
							onClick: () => setAdding("node"),
						},
					]
				: [],
			actionsOnHover: false,
			content: (
				<div className="pb-2.5">
					{nodeTypes.length === 0 ? (
						<p className="px-3 text-base text-muted-foreground">
							Nothing modelled yet.
						</p>
					) : (
						nodeTypes.map((nt) => (
							<TypeRow
								key={nt.id}
								name={nt.name}
								staged={stagedNames.has(`node_type:${nt.name}`)}
								detail={propertySummary(nt)}
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
			headerActions: ctx
				? [
						{
							key: "add",
							name: "Declare an edge type",
							icon: Plus,
							onClick: () => setAdding("edge"),
						},
					]
				: [],
			actionsOnHover: false,
			content: (
				<div className="pb-2.5">
					{edgeTypes.length === 0 ? (
						<p className="px-3 text-base text-muted-foreground">
							No edge types.
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
		// Closed until asked for; declaring starts from a selected type.
		{ ...stitchesSection, defaultCollapsed: true },
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack sections={sections} withHandle />
			</div>
			<PanelStatusBar
				left={<StatusCrumb active>{model.name}</StatusCrumb>}
				middle={[
					draft ? (
						<StatusCount
							key="staged"
							tone={staged.data?.count ? "info" : "muted"}
						>
							{draft.version ? `v${draft.version} · ` : ""}draft ·{" "}
							{staged.data?.count ?? 0} staged
						</StatusCount>
					) : (
						<StatusCount key="active">
							{active ? `v${active.version} · active` : "never published"}
						</StatusCount>
					),
				]}
				right={`${nodeTypes.length + edgeTypes.length} types`}
			/>
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
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

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
		<RecordRow
			active={active}
			onClick={onClick}
			tone={staged ? "info" : "muted"}
			title={
				<span className="flex items-center gap-1.5">
					<span className="font-mono">{name}</span>
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
		<span className="border border-primary/25 bg-primary/15 px-1.5 py-0.5 text-sm font-semibold uppercase leading-none text-primary">
			staged
		</span>
	);
}

interface NamedType {
	id: string;
	name: string;
	property_mappings?: unknown[];
}

/** — staged rows sort first, then the rest alphabetically. */
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

function propertySummary(type: { property_mappings?: unknown[] }): string {
	const count = type.property_mappings?.length ?? 0;
	const names = (type.property_mappings ?? [])
		.map((m) => (m as { property_key?: { name?: string } }).property_key?.name)
		.filter(Boolean)
		.slice(0, 4);
	return `${count} props${names.length ? ` · ${names.join(" · ")}` : ""}${
		count > names.length ? " …" : ""
	}`;
}
