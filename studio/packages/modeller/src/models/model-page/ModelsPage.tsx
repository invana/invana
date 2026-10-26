/**
 * The model page — `models:<graph>` in `Workbook` (the-model-page.md).
 *
 * One board, whatever the scope: the scope, the tab and the window are the
 * URL's (`useModelsView`), so the panel beside it and a reload read the same
 * reading. It fetches and answers actions; `modelsPageSpec` composes and
 * `@invana/boards` draws. Every write on a model is on this page's header,
 * never in the panel.
 */

import { type ActionContext, Board } from "@invana/boards";
import { Button, EmptyState, EmptyStateLock } from "@invana/ui";
import type { CanvasBackend } from "@invana-studio/canvases";
import {
	ApiError,
	graphsApi,
	useGraphConnectionQuery,
} from "@invana-studio/core";
import {
	ActButton,
	comparePath,
	ReadOnlyNotice,
	routedAction,
	useAccess,
} from "@invana-studio/shell";
import { BOARD_ICONS } from "@invana-studio/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	BookOpen,
	Boxes,
	Check,
	Lock,
	Network,
	Plus,
	Upload,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { modelsApi } from "../api";
import { DeleteModelDialog } from "../model-editor/components/DeleteModelDialog";
import { ModelFormDialog } from "../model-editor/components/ModelFormDialog";
import { NewModelDialog } from "../model-editor/components/NewModelDialog";
import { OntologyImportDialog } from "../model-editor/components/OntologyImportDialog";
import { ModelCanvas } from "../model-editor/ModelCanvas";
import type { ModelSelection } from "../model-editor/types";
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
} from "../queries";
import { useAllModels } from "../stitch/useAllModels";
import type {
	Advice,
	BindingStitch,
	GraphModelSummary,
	VersionSummary,
} from "../types";
import { ModelHistory } from "./ModelHistory";
import { ArchiveRefused, PublishConfirm } from "./ModelsDialogs";
import {
	LOCKED_UNTIL_PUBLISHED,
	MODELS_ACTIONS,
	type ModelsMenuItem,
	type ModelsScope,
	modelsPageSpec,
	schemaSpec,
	windowOf,
} from "./modelsPageSpec";
import { ShapeSheet } from "./performanceRows";
import { TypePage } from "./TypePage";
import { type ModelsTab, useModelsView } from "./useModelsView";

const ICONS = {
	...BOARD_ICONS,
	plus: Plus,
	upload: Upload,
	check: Check,
	schema: Network,
};

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
	/** The type the outline or the canvas has picked — the canvas draws it selected. */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/** Membership is binary today, so every member writes. */
	canWrite?: boolean;
	/** A Growth mark's run, opened as a board beside this one. */
	onOpenRun?: (runId: string) => void;
}) {
	const { view, set } = useModelsView();
	const navigate = useNavigate();
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
	const previous = previousVersion(versions.data ?? [], active);
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

	const [editing, setEditing] = useState<GraphModelSummary | null>(null);
	const [creating, setCreating] = useState(false);
	const [fromOntology, setFromOntology] = useState(false);
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
				previous,
				staged: draft ? (staged.data ?? null) : null,
				published: !!(
					scoped.active_version ||
					versions.data?.some((v) => v.status !== "draft")
				),
			}
		: null;

	// Without the `model` role the header's writes show disabled, not absent.
	const modelGate = useAccess().gate("model");
	const writable = canWrite && modelGate.allowed;

	// ⌘↵ opens the Publish confirm, as the staged bar says.
	const canPublish = writable && !!draft && !!staged.data?.can_commit;
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

	const pageData = {
		models: authored,
		frames,
		links: allLinks.data,
		physical: physical.data,
		physicalLoading: physical.isLoading,
		insights: insights.data,
		insightsLoading: insights.isLoading,
		scope,
		canWrite: writable,
		loading: models.isLoading,
	};

	const spec = modelsPageSpec(pageData, view, {
		notMeasured: (tab) => (
			<EmptyState
				className="py-10"
				title="Not measured yet"
				description={WAITS_ON[tab]}
			/>
		),
		performance: { selected: shape, onSelect: setShape },
		history: (
			<ModelHistory
				username={username}
				graphSlug={graphSlug}
				models={scoped ? [scoped] : authored.filter((m) => m.active_version)}
				all={!scoped}
			/>
		),
		onTab: (tab) => set({ tab }),
		growth: {
			canWrite,
			// A load is a run, so it lands on the Runs journal.
			onBringDataIn: () => set({}, { panel: "runs" }),
			onSeeTypes: () => set({ open: true }),
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
										set({ scope: firstDraft.id, open: true, schema: true })
									}
								>
									Open the draft
								</Button>
							) : (
								<ActButton area="model" onClick={() => setCreating(true)}>
									<Plus /> New model
								</ActButton>
							)}
							<ActButton
								area="model"
								variant="outline"
								onClick={() => setCreating(true)}
							>
								<Upload /> Import
							</ActButton>
							<ActButton
								area="model"
								variant="ghost"
								onClick={() => setCreating(true)}
							>
								<BookOpen /> Starter models
							</ActButton>
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
	});

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

	const openDraft = () =>
		scoped &&
		createDraft.mutate({
			modelId: scoped.id,
			basedOn: active?.version ?? null,
		});

	const onMenu = (item: ModelsMenuItem) => {
		switch (item) {
			case "starters":
				return setCreating(true);
			case "ontology":
				return setFromOntology(true);
			case "introspect":
				return introspect.mutate();
			case "draft":
				return openDraft();
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

	const onBoardAction = (action: string, context?: ActionContext) => {
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
			case MODELS_ACTIONS.openModel:
				// The breadcrumb back to the model's page, from its canvas or a type.
				onSelect(null);
				return set({ schema: false, type: null });
			case MODELS_ACTIONS.selectModel:
				// A click reads that model, its outline in the leftSection, and
				// keeps the tab.
				return ctx?.itemId && set({ scope: ctx.itemId, open: true });
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
				return set({ type: ctx.itemId, open: true });
			case MODELS_ACTIONS.openSchema:
				return set({ schema: true, type: null });
			case MODELS_ACTIONS.versions:
				return set({ tab: "history", schema: false, type: null });
			case MODELS_ACTIONS.newModel:
				return setCreating(true);
			case MODELS_ACTIONS.importModel:
				return setCreating(true);
			case MODELS_ACTIONS.more:
				return ctx?.option && onMenu(ctx.option as ModelsMenuItem);
			case MODELS_ACTIONS.edit:
				return openDraft();
			case MODELS_ACTIONS.exportModel:
				return scoped && void downloadArtefact(username, graphSlug, scoped);
			case MODELS_ACTIONS.publish:
				return setPublishing(true);
			case MODELS_ACTIONS.compare:
				return (
					scoped &&
					active?.version &&
					navigate(
						comparePath({ username, graphSlug }, "model", scoped.id, {
							a: previous,
							b: active.version,
						}),
					)
				);
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
	};

	// What each type holds today, from Growth's latest count.
	const counts = new Map(
		(insights.data?.growth?.rows ?? []).map((r) => [r.key, r.now]),
	);

	let body: ReactNode;
	if (scope && view.schema) {
		// *Open in Schema*: the model's canvas, full-bleed, in place of the tabs.
		body = (
			<Board
				className="min-h-0 flex-1"
				spec={schemaSpec(
					pageData,
					view,
					<ModelCanvas
						username={username}
						graphSlug={graphSlug}
						modelId={scope.model.id}
						backend={backend}
						selection={selection}
						onSelect={(next) => {
							onSelect(next);
							// A type clicked on the canvas opens as a page of its model.
							if (next) set({ type: next.name, schema: false });
						}}
						onPublish={() => setPublishing(true)}
						onDiscard={() => discardAll.mutate(scope.model.id)}
					/>,
				)}
				icons={ICONS}
				onAction={onBoardAction}
			/>
		);
	} else if (scope && view.type) {
		body = (
			<TypePage
				username={username}
				graphSlug={graphSlug}
				scope={scope}
				typeName={view.type}
				tab={view.typeTab}
				counts={counts}
				canWrite={writable}
				creatingDraft={createDraft.isPending}
				onTab={(typeTab) => set({ typeTab })}
				onGone={() => {
					onSelect(null);
					set({ type: null });
				}}
				onAction={onBoardAction}
			/>
		);
	} else {
		body = (
			<Board
				className="min-h-0 flex-1"
				spec={spec}
				icons={ICONS}
				onAction={onBoardAction}
			/>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ReadOnlyNotice area="model" noun="model" />
			{body}

			<ModelFormDialog
				open={editing !== null}
				username={username}
				graphSlug={graphSlug}
				model={editing}
				onClose={() => setEditing(null)}
			/>
			<NewModelDialog
				open={creating}
				username={username}
				graphSlug={graphSlug}
				onClose={() => setCreating(false)}
				onCreated={(modelId, { assistant }) => {
					setCreating(false);
					// A new model lands on its draft's canvas; one the assistant is
					// drafting opens with the assistant docked beside it.
					set(
						{ scope: modelId, open: true, schema: true, type: null },
						assistant ? { right: "assistant" } : undefined,
					);
				}}
			/>
			{fromOntology ? (
				<OntologyImportDialog
					open
					username={username}
					graphSlug={graphSlug}
					onClose={() => setFromOntology(false)}
					onImported={(modelId) => {
						setFromOntology(false);
						set(
							{ scope: modelId, open: true, schema: true },
							{ panel: "model" },
						);
					}}
				/>
			) : null}
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
								// The draft turned breaking since the confirm read it:
								// read it again, and the confirm becomes the breaking one.
								onError: (err) => {
									const body =
										err instanceof ApiError
											? (err.detail as { error?: string } | undefined)
											: undefined;
									if (body?.error === "breaking_publish_needs_review")
										queryClient.invalidateQueries({
											queryKey: [
												"models",
												username,
												graphSlug,
												scoped.id,
												"draft-review",
											],
										});
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
					navigate(`/u/${username}/${graphSlug}/modeller/stitches`);
				}}
				onClose={() => setRefused(null)}
			/>
		</div>
	);
}

/** The published version before the active one, by when each was published. */
function previousVersion(
	versions: VersionSummary[],
	active: VersionSummary | null,
): string | null {
	if (!active) return null;
	const at = (v: VersionSummary) => v.activated_at ?? v.created_at;
	return (
		versions
			.filter(
				(v) =>
					v.status !== "draft" &&
					v.version &&
					v.id !== active.id &&
					at(v) <= at(active),
			)
			.sort((a, b) => at(b).localeCompare(at(a)))[0]?.version ?? null
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
