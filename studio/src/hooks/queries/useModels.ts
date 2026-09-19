import { modelsApi } from "@/services/api/models";
import type {
	ConstraintCreate,
	EdgeTypeCreate,
	EdgeTypeUpdate,
	GraphModelCreate,
	GraphModelUpdate,
	IdentityMatch,
	IndexCreate,
	ModelArtefact,
	ModelLinkDeclare,
	NodeTypeCreate,
	NodeTypeUpdate,
	PropertyKeyCreate,
	PropertyKeyUpdate,
} from "@/types/models";
import type { GraphVersionResponse } from "@/types/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const root = (u: string, g: string) => ["models", u, g] as const;

// ── Queries ────────────────────────────────────────────────────────────────

export function useModelsQuery(username?: string, graphSlug?: string) {
	return useQuery({
		queryKey: root(username ?? "", graphSlug ?? ""),
		queryFn: () => modelsApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useModelQuery(
	username?: string,
	graphSlug?: string,
	modelId?: string,
) {
	return useQuery({
		queryKey: ["models", username, graphSlug, modelId, "detail"] as const,
		queryFn: () =>
			modelsApi.get(username as string, graphSlug as string, modelId as string),
		enabled: !!username && !!graphSlug && !!modelId,
	});
}

export function useModelVersionsQuery(
	username?: string,
	graphSlug?: string,
	modelId?: string,
) {
	return useQuery({
		queryKey: ["models", username, graphSlug, modelId, "versions"] as const,
		queryFn: () =>
			modelsApi.listVersions(
				username as string,
				graphSlug as string,
				modelId as string,
			),
		enabled: !!username && !!graphSlug && !!modelId,
	});
}

export function useModelVersionQuery(
	username?: string,
	graphSlug?: string,
	modelId?: string,
	versionId?: string,
) {
	return useQuery({
		queryKey: [
			"models",
			username,
			graphSlug,
			modelId,
			"version",
			versionId,
		] as const,
		queryFn: () =>
			modelsApi.getVersion(
				username as string,
				graphSlug as string,
				modelId as string,
				versionId as string,
			),
		enabled: !!username && !!graphSlug && !!modelId && !!versionId,
	});
}

export function useModelActiveVersionQuery(
	username?: string,
	graphSlug?: string,
	modelId?: string,
) {
	return useQuery({
		queryKey: [
			"models",
			username,
			graphSlug,
			modelId,
			"active-version",
		] as const,
		queryFn: () =>
			modelsApi.getActiveVersion(
				username as string,
				graphSlug as string,
				modelId as string,
			),
		enabled: !!username && !!graphSlug && !!modelId,
	});
}

// ── Mutations ──────────────────────────────────────────────────────────────
// Every mutation invalidates the whole ["models", u, g] subtree so the model
// list, version list, and the open version tree all refresh.

function useModelMutation<TArgs, TResult = unknown>(
	username: string,
	graphSlug: string,
	fn: (args: TArgs) => Promise<TResult>,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: root(username, graphSlug) }),
	});
}

export const useCreateModelMutation = (u: string, g: string) =>
	useModelMutation(u, g, (data: GraphModelCreate) =>
		modelsApi.create(u, g, data),
	);

export const useUpdateModelMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ id, data }: { id: string; data: GraphModelUpdate }) =>
			modelsApi.update(u, g, id, data),
	);

export const useDeleteModelMutation = (u: string, g: string) =>
	useModelMutation(u, g, (id: string) => modelsApi.remove(u, g, id));

export const useCreateDraftMutation = (u: string, g: string) =>
	useModelMutation<
		{ modelId: string; basedOn?: string | null },
		GraphVersionResponse
	>(u, g, ({ modelId, basedOn }) =>
		modelsApi.createDraft(u, g, modelId, { based_on: basedOn ?? null }),
	);

export const useActivateVersionMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({
			modelId,
			versionId,
			version,
		}: { modelId: string; versionId: string; version?: string | null }) =>
			modelsApi.activate(u, g, modelId, versionId, {
				version: version ?? null,
			}),
	);

// ── Type authoring (draft versions only) ──────────────────────────────────

type TypeCtx = { modelId: string; versionId: string };

export const useCreateNodeTypeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, data }: TypeCtx & { data: NodeTypeCreate }) =>
			modelsApi.createNodeType(u, g, modelId, versionId, data),
	);

export const useUpdateNodeTypeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({
			modelId,
			versionId,
			typeId,
			data,
		}: TypeCtx & { typeId: string; data: NodeTypeUpdate }) =>
			modelsApi.updateNodeType(u, g, modelId, versionId, typeId, data),
	);

export const useDeleteNodeTypeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, typeId }: TypeCtx & { typeId: string }) =>
			modelsApi.deleteNodeType(u, g, modelId, versionId, typeId),
	);

export const useCreateEdgeTypeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, data }: TypeCtx & { data: EdgeTypeCreate }) =>
			modelsApi.createEdgeType(u, g, modelId, versionId, data),
	);

export const useUpdateEdgeTypeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({
			modelId,
			versionId,
			typeId,
			data,
		}: TypeCtx & { typeId: string; data: EdgeTypeUpdate }) =>
			modelsApi.updateEdgeType(u, g, modelId, versionId, typeId, data),
	);

export const useDeleteEdgeTypeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, typeId }: TypeCtx & { typeId: string }) =>
			modelsApi.deleteEdgeType(u, g, modelId, versionId, typeId),
	);

export const useCreatePropertyKeyMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, data }: TypeCtx & { data: PropertyKeyCreate }) =>
			modelsApi.createPropertyKey(u, g, modelId, versionId, data),
	);

export const useUpdatePropertyKeyMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({
			modelId,
			versionId,
			keyId,
			data,
		}: TypeCtx & { keyId: string; data: PropertyKeyUpdate }) =>
			modelsApi.updatePropertyKey(u, g, modelId, versionId, keyId, data),
	);

export const useDeletePropertyKeyMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, keyId }: TypeCtx & { keyId: string }) =>
			modelsApi.deletePropertyKey(u, g, modelId, versionId, keyId),
	);

export const useCreateConstraintMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, data }: TypeCtx & { data: ConstraintCreate }) =>
			modelsApi.createConstraint(u, g, modelId, versionId, data),
	);

export const useDeleteConstraintMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({
			modelId,
			versionId,
			constraintId,
		}: TypeCtx & { constraintId: string }) =>
			modelsApi.deleteConstraint(u, g, modelId, versionId, constraintId),
	);

export const useCreateIndexMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, data }: TypeCtx & { data: IndexCreate }) =>
			modelsApi.createIndex(u, g, modelId, versionId, data),
	);

export const useDeleteIndexMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, versionId, indexId }: TypeCtx & { indexId: string }) =>
			modelsApi.deleteIndex(u, g, modelId, versionId, indexId),
	);

// ── The staged set (model-editor.md) ───────────────────────────────────────
//
// The bar reads a derived set, so it invalidates with every authoring mutation
// through the same ["models", u, g] subtree — there is nothing separate to keep
// in sync.

export function useStagedSetQuery(
	username?: string,
	graphSlug?: string,
	modelId?: string,
	enabled = true,
) {
	return useQuery({
		queryKey: ["models", username, graphSlug, modelId, "staged"] as const,
		queryFn: () =>
			modelsApi.staged(
				username as string,
				graphSlug as string,
				modelId as string,
			),
		enabled: !!username && !!graphSlug && !!modelId && enabled,
		// A draft with no changes 404s only when there is no draft at all; a
		// missing draft is a state the panel renders, not an error to retry.
		retry: false,
	});
}

export const useDiscardStagedSetMutation = (u: string, g: string) =>
	useModelMutation(u, g, (modelId: string) =>
		modelsApi.discardAll(u, g, modelId),
	);

export const useDiscardStagedChangeMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, changeId }: { modelId: string; changeId: string }) =>
			modelsApi.discardOne(u, g, modelId, changeId),
	);

export const useCommitDraftMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({ modelId, version }: { modelId: string; version?: string | null }) =>
			modelsApi.commit(u, g, modelId, version),
	);

/** What changed in a published version, against the one before it. */
export function useVersionDiffQuery(
	username?: string,
	graphSlug?: string,
	modelId?: string,
	versionId?: string,
) {
	return useQuery({
		queryKey: [
			"models",
			username,
			graphSlug,
			modelId,
			"diff",
			versionId,
		] as const,
		queryFn: () =>
			modelsApi.versionDiff(
				username as string,
				graphSlug as string,
				modelId as string,
				versionId as string,
			),
		enabled: !!username && !!graphSlug && !!modelId && !!versionId,
		// A published version is immutable, so its diff is too.
		staleTime: Number.POSITIVE_INFINITY,
	});
}

// ── Portability (share-a-model.md · starter-models.md) ─────────────────────

export function useStartersQuery(username?: string, graphSlug?: string) {
	return useQuery({
		queryKey: ["models", username, graphSlug, "starters"] as const,
		queryFn: () => modelsApi.starters(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
		// Shipped with the distribution — it does not change while the tab is open.
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export const useImportModelMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		(body: { artefact?: ModelArtefact; starter?: string; name?: string }) =>
			modelsApi.importModel(u, g, body),
	);

export const useUpgradeModelMutation = (u: string, g: string) =>
	useModelMutation(
		u,
		g,
		({
			modelId,
			...body
		}: { modelId: string; artefact?: ModelArtefact; starter?: string }) =>
			modelsApi.upgradeModel(u, g, modelId, body),
	);

// ── Links and the global model (stitch-models.md) ──────────────────────────

const linksRoot = (u: string, g: string) => ["model-links", u, g] as const;

export function useModelLinksQuery(username?: string, graphSlug?: string) {
	return useQuery({
		queryKey: linksRoot(username ?? "", graphSlug ?? ""),
		queryFn: () => modelsApi.links(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useGlobalModelQuery(username?: string, graphSlug?: string) {
	return useQuery({
		queryKey: ["global-model", username, graphSlug] as const,
		queryFn: () =>
			modelsApi.globalModel(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

/** Links change the union, so both caches go at once. */
function useLinkMutation<TArgs>(
	u: string,
	g: string,
	fn: (args: TArgs) => Promise<unknown>,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: linksRoot(u, g) });
			qc.invalidateQueries({ queryKey: ["global-model", u, g] });
		},
	});
}

export const useDeclareLinkMutation = (u: string, g: string) =>
	useLinkMutation(u, g, (data: ModelLinkDeclare) =>
		modelsApi.declareLink(u, g, data),
	);

export const useRemoveLinkMutation = (u: string, g: string) =>
	useLinkMutation(u, g, (linkId: string) => modelsApi.removeLink(u, g, linkId));

/** One action for the whole staged set — committing them one at a time would
 *  put the union in states nobody chose (ST21). */
export const useCommitStitchesMutation = (u: string, g: string) =>
	useLinkMutation(u, g, () => modelsApi.commitStitches(u, g));

export const useDiscardStitchesMutation = (u: string, g: string) =>
	useLinkMutation(u, g, (linkId?: string) =>
		modelsApi.discardStitches(u, g, linkId),
	);

/**
 * The resolve preview — a mutation, not a query, because it runs a count on the
 * bound database (stitch-models.md C3).
 *
 * The panel fires it as soon as both keys are named, so the count is on screen
 * *before* the stitch exists rather than behind a button nobody presses. One
 * rule, one key on each side (ST26), for both kinds.
 */
export function usePreviewStitchMutation(u: string, g: string) {
	return useMutation({
		mutationFn: (data: {
			source_type: string;
			source_property: string;
			target_type: string;
			target_property: string;
			identity_match?: IdentityMatch;
		}) => modelsApi.previewStitch(u, g, data),
	});
}
