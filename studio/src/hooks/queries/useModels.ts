import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { modelsApi } from "../../services/api/models";
import type {
	ConstraintCreate,
	EdgeTypeCreate,
	EdgeTypeUpdate,
	GraphModelCreate,
	GraphModelUpdate,
	IndexCreate,
	NodeTypeCreate,
	NodeTypeUpdate,
	PropertyKeyCreate,
	PropertyKeyUpdate,
} from "../../types/models";

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

function useModelMutation<TArgs>(
	username: string,
	graphSlug: string,
	fn: (args: TArgs) => Promise<unknown>,
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
	useModelMutation(
		u,
		g,
		({ modelId, basedOn }: { modelId: string; basedOn?: string | null }) =>
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
