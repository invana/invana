/**
 * The model page — `models:<graph>` in `Workbook` (the-model-page.md).
 *
 * One board, whatever the scope: the scope, the tab and the window are the
 * URL's (`useModelsView`), so the panel beside it and a reload read the same
 * reading. It fetches and answers actions; `modelsPageSpec` composes and
 * `@invana/boards` draws. Every write on a model is on this page's header,
 * never in the panel.
 */

import { Board } from "@invana/boards";
import { Button, EmptyState, EmptyStateLock } from "@invana/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Boxes, Check, Lock, Plus, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import { useTypeCountsQuery } from "@/pages/graphs-detail/features/explorer";
import {
	graphsApi,
	useGraphConnectionQuery,
} from "@/pages/graphs-detail/features/graphs";
import { modelsApi } from "@/pages/graphs-detail/features/models/api";
import { DeleteModelDialog } from "@/pages/graphs-detail/features/models/model-editor/components/DeleteModelDialog";
import { ImportModelDialog } from "@/pages/graphs-detail/features/models/model-editor/components/ImportModelDialog";
import { ModelFormDialog } from "@/pages/graphs-detail/features/models/model-editor/components/ModelFormDialog";
import { ModelCanvas } from "@/pages/graphs-detail/features/models/model-editor/ModelCanvas";
import type { ModelSelection } from "@/pages/graphs-detail/features/models/model-editor/types";
import {
	useCommitDraftMutation,
	useCreateDraftMutation,
	useCreateIndexMutation,
	useDiscardStagedChangeMutation,
	useDiscardStagedSetMutation,
	useModelInsightsQuery,
	useModelLinksQuery,
	useModelQuery,
	useModelsQuery,
	useModelVersionsQuery,
	usePhysicalSchemaQuery,
	useShapeQuery,
	useStagedSetQuery,
	useUpdateModelMutation,
} from "@/pages/graphs-detail/features/models/queries";
import { AllModelsCanvas } from "@/pages/graphs-detail/features/models/stitch/AllModelsCanvas";
import { useAllModels } from "@/pages/graphs-detail/features/models/stitch/useAllModels";
import type {
	Advice,
	BindingStitch,
	GraphModelSummary,
} from "@/pages/graphs-detail/features/models/types";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { routedAction } from "@/pages/graphs-detail/shared/dashboardSpec";
import { ApiError } from "@/services/api/client";
import { ArchiveRefused, PublishConfirm } from "./ModelsDialogs";
import {
	LOCKED_UNTIL_PUBLISHED,
	MODELS_ACTIONS,
	type ModelsMenuItem,
	type ModelsScope,
	modelsPageSpec,
	windowOf,
} from "./modelsPageSpec";
import { ShapeSheet } from "./performanceRows";
import { type ModelsTab, useModelsView } from "./useModelsView";

const ICONS = { ...DASHBOARD_ICONS, plus: Plus, upload: Upload, check: Check };

/** What each tab waits on until its read ships. */
const WAITS_ON: Partial<Record<ModelsTab, string>> = {
	usage:
		"Usage counts who asked about each type and property, from the query log. This engine does not keep one.",
	performance:
		"Performance groups every query by its shape, with p50, p95 and advice, from the query log. This engine does not keep one.",
	growth:
		"Growth draws records over time, from the count taken whenever something writes data. This engine does not take them.",
};

/** `invana_neo4j.connector.Neo4jConnector` → `Neo4j`. */
const connectorName = (cls: string | undefined) =>
	(cls?.split(".").pop() ?? "the database").replace(/Connector$/, "") ||
	"the database";

export function ModelsPage({
	username,
	graphSlug,
	backend,
	selection,
	onSelect,
	canWrite = true,
	onOpenRun,
}: {
	username: string;
	graphSlug: string;
	backend?: CanvasBackend;
	/** The type selected on the Model tab — its form spans the column beneath. */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/** Membership is binary today, so every member writes. */
	canWrite?: boolean;
	/** A Growth mark's run, opened as a board beside this one. */
	onOpenRun?: (runId: string) => void;
}) {
	const { view, set } = useModelsView();
	const queryClient = useQueryClient();
	const models = useModelsQuery(username, graphSlug);
	const authored = useMemo(
		() =>
			(models.data ?? []).filter(
				(m) => m.origin !== "introspected" && m.status !== "archived",
			),
		[models.data],
	);
	const { frames } = useAllModels(username, graphSlug);
	const allLinks = useModelLinksQuery(username, graphSlug);
	const counts = useTypeCountsQuery(username, graphSlug);
	const connection = useGraphConnectionQuery(username, graphSlug);

	const scoped = authored.find((m) => m.id === view.scope) ?? null;
	const physical = usePhysicalSchemaQuery(
		username,
		graphSlug,
		scoped?.id ?? null,
	);
	const insights = useModelInsightsQuery(
		username,
		graphSlug,
		scoped?.id ?? null,
		view.window,
	);
	// A picked shape is a reading of the page, not a place — it does not go in
	// the URL (names the four keys that do).
	const [shape, setShape] = useState<string | null>(null);
	const shapeCard = useShapeQuery(username, graphSlug, shape, view.window);
	const createIndex = useCreateIndexMutation(username, graphSlug);
	const [staging, setStaging] = useState(false);

	/** Advice is a draft change, never a write: open the owner's draft if it has none, then stage. */
	const stageIndex = async (advice: Advice) => {
		if (!advice.model_id) return;
		setStaging(true);
		try {
			const owned = await modelsApi.listVersions(
				username,
				graphSlug,
				advice.model_id,
			);
			const draftVersion =
				owned.find((v) => v.status === "draft") ??
				(await createDraft.mutateAsync({
					modelId: advice.model_id,
					basedOn: owned.find((v) => v.status === "active")?.version ?? null,
				}));
			await createIndex.mutateAsync({
				modelId: advice.model_id,
				versionId: draftVersion.id,
				data: {
					name: `${advice.label}_${advice.property}`.toLowerCase(),
					target_kind: "node_type",
					target_label: advice.label,
					properties: [advice.property],
					index_type: "range",
				},
			});
			toast.success(
				`Staged an index on ${advice.label}.${advice.property} in ${advice.model_name} — publishing creates it.`,
			);
			setShape(null);
			set({ scope: advice.model_id });
		} finally {
			setStaging(false);
		}
	};
	const detail = useModelQuery(username, graphSlug, scoped?.id);
	const versions = useModelVersionsQuery(username, graphSlug, scoped?.id);
	const draft = versions.data?.find((v) => v.status === "draft") ?? null;
	const active = versions.data?.find((v) => v.status === "active") ?? null;
	const staged = useStagedSetQuery(username, graphSlug, scoped?.id, !!draft);

	const createDraft = useCreateDraftMutation(username, graphSlug);
	const commit = useCommitDraftMutation(username, graphSlug);
	const discardAll = useDiscardStagedSetMutation(username, graphSlug);
	const discardOne = useDiscardStagedChangeMutation(username, graphSlug);
	const update = useUpdateModelMutation(username, graphSlug);
	const introspect = useMutation({
		mutationFn: () => graphsApi.introspectConnection(username, graphSlug),
		onSettled: () =>
			queryClient.invalidateQueries({
				queryKey: ["schemas", username, graphSlug, "physical"],
			}),
		onSuccess: () =>
			toast.success(
				"Reading what the database holds — the mirror refreshes when it lands.",
			),
	});

	const [editing, setEditing] = useState<GraphModelSummary | "new" | null>(
		null,
	);
	const [importing, setImporting] = useState(false);
	const [deleting, setDeleting] = useState<GraphModelSummary | null>(null);
	const [publishing, setPublishing] = useState(false);
	const [refused, setRefused] = useState<{
		name: string;
		stitches: BindingStitch[];
	} | null>(null);

	const scope: ModelsScope | null = scoped
		? {
				model: scoped,
				detail: detail.data,
				draft,
				active,
				staged: draft ? (staged.data ?? null) : null,
				published: !!(
					scoped.active_version ||
					versions.data?.some((v) => v.status !== "draft")
				),
			}
		: null;

	// ⌘↵ opens the Publish confirm, as the staged bar says.
	const canPublish = canWrite && !!draft && !!staged.data?.can_commit;
	useEffect(() => {
		if (!canPublish) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setPublishing(true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canPublish]);

	const firstDraft = authored.find((m) => !m.active_version) ?? null;

	const spec = modelsPageSpec(
		{
			models: authored,
			frames,
			counts: counts.data,
			links: allLinks.data,
			physical: physical.data,
			physicalLoading: physical.isLoading,
			insights: insights.data,
			insightsLoading: insights.isLoading,
			scope,
			canWrite,
			loading: models.isLoading,
		},
		view,
		{
			modelTab: scoped ? (
				<ModelCanvas
					username={username}
					graphSlug={graphSlug}
					modelId={scoped.id}
					backend={backend}
					selection={selection}
					onSelect={onSelect}
					canWrite={canWrite}
				/>
			) : (
				<AllModelsCanvas
					username={username}
					graphSlug={graphSlug}
					backend={backend}
				/>
			),
			notMeasured: (tab) => (
				<EmptyState
					className="py-10"
					title="Not measured yet"
					description={WAITS_ON[tab]}
				/>
			),
			performance: { selected: shape, onSelect: setShape },
			onTab: (tab) => set({ tab }),
			growth: {
				canWrite,
				// A load is a run, so it lands on the Runs journal.
				onBringDataIn: () => set({}, { panel: "runs" }),
				onSeeTypes: () => set({ tab: "model", open: true }),
				onOpenRun: (runId) => onOpenRun?.(runId),
			},
			database: {
				canWrite,
				introspecting: introspect.isPending,
				onIntrospect: () => introspect.mutate(),
			},
			emptyOverview: (
				<EmptyState
					className="py-10"
					icon={<Boxes />}
					title="No model is published yet"
					description={
						firstDraft
							? `${firstDraft.name} is a draft. Publish it, or bring a model in, and this page starts to count: records, queries, and how fast they run.`
							: "Author a model, import one, or start from a starter. Once one is published this page starts to count: records, queries, and how fast they run."
					}
					actions={
						canWrite ? (
							<>
								{firstDraft ? (
									<Button
										onClick={() =>
											set({ scope: firstDraft.id, open: true, tab: "model" })
										}
									>
										Open the draft
									</Button>
								) : (
									<Button onClick={() => setEditing("new")}>
										<Plus /> New model
									</Button>
								)}
								<Button variant="outline" onClick={() => setImporting(true)}>
									<Upload /> Import
								</Button>
								<Button variant="ghost" onClick={() => setImporting(true)}>
									<BookOpen /> Starter models
								</Button>
							</>
						) : null
					}
					locks={LOCKED_UNTIL_PUBLISHED.map((t) => (
						<EmptyStateLock key={t} icon={<Lock />}>
							{t[0].toUpperCase() + t.slice(1)} opens once a model is published
						</EmptyStateLock>
					))}
				/>
			),
		},
	);

	const archive = (model: GraphModelSummary) =>
		update.mutate(
			{ id: model.id, data: { status: "archived" } },
			{
				onSuccess: () => {
					toast.success(`${model.name} archived — its versions still resolve.`);
					set({ scope: null, open: false });
				},
				onError: (err) => {
					const body = err instanceof ApiError ? err.detail : undefined;
					const detailBody = body as
						| { error?: string; stitches?: BindingStitch[] }
						| undefined;
					if (detailBody?.error === "archive_has_active_stitches")
						setRefused({
							name: model.name,
							stitches: detailBody.stitches ?? [],
						});
				},
			},
		);

	const onMenu = (item: ModelsMenuItem) => {
		switch (item) {
			case "starters":
				return setImporting(true);
			case "introspect":
				return introspect.mutate();
			case "rename":
				return scoped && setEditing(scoped);
			case "exportModel":
				return scoped && void downloadArtefact(username, graphSlug, scoped);
			case "archive":
				return scoped && archive(scoped);
			case "delete":
				return scoped && setDeleting(scoped);
		}
	};

	return (
		<>
			<Board
				className="h-full min-h-0"
				spec={spec}
				icons={ICONS}
				onAction={(action, context) => {
					const [id, ctx] = routedAction(action, context);
					switch (id) {
						case MODELS_ACTIONS.tab:
							if (ctx?.option) set({ tab: ctx.option as ModelsTab });
							return;
						case MODELS_ACTIONS.window: {
							const w = ctx?.option ? windowOf(ctx.option) : undefined;
							if (w) set({ window: w });
							return;
						}
						case MODELS_ACTIONS.allModels:
							onSelect(null);
							return set({ scope: null, open: false });
						case MODELS_ACTIONS.selectModel:
							// A click selects and keeps the tab.
							return ctx?.itemId && set({ scope: ctx.itemId });
						case MODELS_ACTIONS.selectType:
							if (!ctx?.itemId) return;
							onSelect({
								kind: frames
									.find((f) => f.modelId === scoped?.id)
									?.edgeTypes.some((t) => t.name === ctx.itemId)
									? "edge_type"
									: "node_type",
								name: ctx.itemId,
							});
							return set({ tab: "model", open: true });
						case MODELS_ACTIONS.newModel:
							return setEditing("new");
						case MODELS_ACTIONS.importModel:
							return setImporting(true);
						case MODELS_ACTIONS.more:
							return ctx?.option && onMenu(ctx.option as ModelsMenuItem);
						case MODELS_ACTIONS.edit:
							return (
								scoped &&
								createDraft.mutate({
									modelId: scoped.id,
									basedOn: active?.version ?? null,
								})
							);
						case MODELS_ACTIONS.exportModel:
							return (
								scoped && void downloadArtefact(username, graphSlug, scoped)
							);
						case MODELS_ACTIONS.publish:
							return setPublishing(true);
						case MODELS_ACTIONS.discardDraft:
							return scoped && discardAll.mutate(scoped.id);
						case MODELS_ACTIONS.discardOne:
							return (
								scoped &&
								ctx?.itemId &&
								discardOne.mutate({ modelId: scoped.id, changeId: ctx.itemId })
							);
						default:
							return;
					}
				}}
			/>

			<ModelFormDialog
				open={editing !== null}
				username={username}
				graphSlug={graphSlug}
				model={editing === "new" ? null : editing}
				onClose={() => setEditing(null)}
			/>
			<ImportModelDialog
				open={importing}
				username={username}
				graphSlug={graphSlug}
				onClose={() => setImporting(false)}
				onImported={(modelId) => {
					setImporting(false);
					// The panel opens beside the page, in the same URL write.
					set({ scope: modelId, open: true, tab: "model" }, { panel: "model" });
				}}
			/>
			<DeleteModelDialog
				model={deleting}
				username={username}
				graphSlug={graphSlug}
				onClose={() => setDeleting(null)}
				onDeleted={() => {
					onSelect(null);
					set({ scope: null, open: false });
				}}
			/>
			{scoped && draft ? (
				<PublishConfirm
					open={publishing}
					username={username}
					graphSlug={graphSlug}
					modelId={scoped.id}
					modelName={scoped.name}
					version={draft.version}
					active={active?.version ?? null}
					staged={staged.data ?? null}
					connector={connectorName(connection.data?.connector_class)}
					publishing={commit.isPending}
					onPublish={() =>
						commit.mutate(
							{ modelId: scoped.id },
							{
								onSuccess: () => {
									setPublishing(false);
									toast.success(`${scoped.name} published.`);
								},
							},
						)
					}
					onClose={() => setPublishing(false)}
				/>
			) : null}
			<ShapeSheet
				open={!!shape}
				card={shapeCard.data}
				loading={shapeCard.isLoading}
				connector={connectorName(connection.data?.connector_class)}
				canWrite={canWrite}
				staging={staging}
				onStage={(a) => void stageIndex(a)}
				onOpenRun={(runId) => onOpenRun?.(runId)}
				onClose={() => setShape(null)}
			/>
			<ArchiveRefused
				modelName={refused?.name ?? null}
				stitches={refused?.stitches ?? []}
				onOpenStitches={() => {
					setRefused(null);
					set({ scope: null, open: false, tab: "model" });
				}}
				onClose={() => setRefused(null)}
			/>
		</>
	);
}

/**
 * Export is a file, so it downloads as one. The registry is git
 * (share-a-model.md) — there is nowhere to publish it to.
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
