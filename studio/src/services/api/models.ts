import { request } from "@/services/api/client";
import type {
	CommitResult,
	ConstraintCreate,
	EdgeTypeCreate,
	EdgeTypeUpdate,
	GlobalModel,
	GraphModelCreate,
	GraphModelResponse,
	GraphModelSummary,
	GraphModelUpdate,
	IndexCreate,
	ModelArtefact,
	ModelImportResult,
	ModelLink,
	ModelLinkDeclare,
	ModelUpgradeResult,
	NodeTypeCreate,
	NodeTypeUpdate,
	PropertyKeyCreate,
	PropertyKeyUpdate,
	SchemaDiff,
	StagedSet,
	StarterSummary,
	StitchPreview,
	VersionActivate,
	VersionCreate,
	VersionSummary,
} from "@/types/models";
import type {
	ConstraintResponse,
	EdgeTypeResponse,
	GraphVersionResponse,
	IndexResponse,
	NodeTypeResponse,
	PropertyKeyResponse,
} from "@/types/schemas";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/models`;
}

/** Links and the global model hang off the graph, not off one model. */
function graphBase(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

function ver(
	username: string,
	graphSlug: string,
	modelId: string,
	versionId: string,
): string {
	return `${base(username, graphSlug)}/${modelId}/versions/${versionId}`;
}

const post = (path: string, data: unknown) =>
	request(path, { method: "POST", body: JSON.stringify(data) });
const patch = (path: string, data: unknown) =>
	request(path, { method: "PATCH", body: JSON.stringify(data) });
const del = (path: string) => request<void>(path, { method: "DELETE" });

export const modelsApi = {
	// ── Models ──────────────────────────────────────────────────────────────
	list: (u: string, g: string) => request<GraphModelSummary[]>(base(u, g)),
	get: (u: string, g: string, id: string) =>
		request<GraphModelResponse>(`${base(u, g)}/${id}`),
	create: (u: string, g: string, data: GraphModelCreate) =>
		post(`${base(u, g)}`, data) as Promise<GraphModelResponse>,
	update: (u: string, g: string, id: string, data: GraphModelUpdate) =>
		patch(`${base(u, g)}/${id}`, data) as Promise<GraphModelResponse>,
	remove: (u: string, g: string, id: string) => del(`${base(u, g)}/${id}`),

	// ── Versions ────────────────────────────────────────────────────────────
	listVersions: (u: string, g: string, id: string) =>
		request<VersionSummary[]>(`${base(u, g)}/${id}/versions`),
	getVersion: (u: string, g: string, id: string, vid: string) =>
		request<GraphVersionResponse>(`${base(u, g)}/${id}/versions/${vid}`),
	getActiveVersion: (u: string, g: string, id: string) =>
		request<GraphVersionResponse>(`${base(u, g)}/${id}/active-version`),
	createDraft: (u: string, g: string, id: string, data: VersionCreate = {}) =>
		post(`${base(u, g)}/${id}/versions`, data) as Promise<GraphVersionResponse>,
	activate: (
		u: string,
		g: string,
		id: string,
		vid: string,
		data: VersionActivate = {},
	) =>
		post(
			`${base(u, g)}/${id}/versions/${vid}/activate`,
			data,
		) as Promise<GraphVersionResponse>,

	// ── Type authoring (draft versions only) ──────────────────────────────────
	createNodeType: (
		u: string,
		g: string,
		id: string,
		vid: string,
		data: NodeTypeCreate,
	) =>
		post(`${ver(u, g, id, vid)}/node-types`, data) as Promise<NodeTypeResponse>,
	updateNodeType: (
		u: string,
		g: string,
		id: string,
		vid: string,
		typeId: string,
		data: NodeTypeUpdate,
	) =>
		patch(
			`${ver(u, g, id, vid)}/node-types/${typeId}`,
			data,
		) as Promise<NodeTypeResponse>,
	deleteNodeType: (
		u: string,
		g: string,
		id: string,
		vid: string,
		typeId: string,
	) => del(`${ver(u, g, id, vid)}/node-types/${typeId}`),

	createEdgeType: (
		u: string,
		g: string,
		id: string,
		vid: string,
		data: EdgeTypeCreate,
	) =>
		post(`${ver(u, g, id, vid)}/edge-types`, data) as Promise<EdgeTypeResponse>,
	updateEdgeType: (
		u: string,
		g: string,
		id: string,
		vid: string,
		typeId: string,
		data: EdgeTypeUpdate,
	) =>
		patch(
			`${ver(u, g, id, vid)}/edge-types/${typeId}`,
			data,
		) as Promise<EdgeTypeResponse>,
	deleteEdgeType: (
		u: string,
		g: string,
		id: string,
		vid: string,
		typeId: string,
	) => del(`${ver(u, g, id, vid)}/edge-types/${typeId}`),

	createPropertyKey: (
		u: string,
		g: string,
		id: string,
		vid: string,
		data: PropertyKeyCreate,
	) =>
		post(
			`${ver(u, g, id, vid)}/property-keys`,
			data,
		) as Promise<PropertyKeyResponse>,
	updatePropertyKey: (
		u: string,
		g: string,
		id: string,
		vid: string,
		keyId: string,
		data: PropertyKeyUpdate,
	) =>
		patch(
			`${ver(u, g, id, vid)}/property-keys/${keyId}`,
			data,
		) as Promise<PropertyKeyResponse>,
	deletePropertyKey: (
		u: string,
		g: string,
		id: string,
		vid: string,
		keyId: string,
	) => del(`${ver(u, g, id, vid)}/property-keys/${keyId}`),

	createConstraint: (
		u: string,
		g: string,
		id: string,
		vid: string,
		data: ConstraintCreate,
	) =>
		post(
			`${ver(u, g, id, vid)}/constraints`,
			data,
		) as Promise<ConstraintResponse>,
	deleteConstraint: (
		u: string,
		g: string,
		id: string,
		vid: string,
		constraintId: string,
	) => del(`${ver(u, g, id, vid)}/constraints/${constraintId}`),

	createIndex: (
		u: string,
		g: string,
		id: string,
		vid: string,
		data: IndexCreate,
	) => post(`${ver(u, g, id, vid)}/indexes`, data) as Promise<IndexResponse>,
	deleteIndex: (
		u: string,
		g: string,
		id: string,
		vid: string,
		indexId: string,
	) => del(`${ver(u, g, id, vid)}/indexes/${indexId}`),

	/** What changed between two published versions (domain-models.md · Surfaces). */
	versionDiff: (
		u: string,
		g: string,
		id: string,
		versionId: string,
		against?: string,
	) =>
		request<SchemaDiff>(
			`${base(u, g)}/${id}/versions/${versionId}/diff${
				against ? `?against=${against}` : ""
			}`,
		),

	// ── The staged set and the commit (model-editor.md) ──────────────────────
	// The draft is the staged set, so there is nothing to POST as you edit: the
	// bar reads the difference, and one action turns it into a version.
	staged: (u: string, g: string, id: string) =>
		request<StagedSet>(`${base(u, g)}/${id}/draft/staged`),
	discardAll: (u: string, g: string, id: string) =>
		post(`${base(u, g)}/${id}/draft/discard`, {}) as Promise<StagedSet>,
	discardOne: (u: string, g: string, id: string, changeId: string) =>
		request<StagedSet>(
			`${base(u, g)}/${id}/draft/staged/${encodeURIComponent(changeId)}`,
			{ method: "DELETE" },
		),
	commit: (u: string, g: string, id: string, version?: string | null) =>
		post(`${base(u, g)}/${id}/commit`, {
			version: version ?? null,
		}) as Promise<CommitResult>,

	// ── Portability (share-a-model.md) ───────────────────────────────────────
	starters: (u: string, g: string) =>
		request<StarterSummary[]>(`${base(u, g)}/starters`),
	exportModel: (u: string, g: string, id: string, versionId?: string) =>
		request<ModelArtefact>(
			`${base(u, g)}/${id}/export${versionId ? `?version_id=${versionId}` : ""}`,
		),
	importModel: (
		u: string,
		g: string,
		body: { artefact?: ModelArtefact; starter?: string; name?: string },
	) => post(`${base(u, g)}/import`, body) as Promise<ModelImportResult>,
	upgradeModel: (
		u: string,
		g: string,
		id: string,
		body: { artefact?: ModelArtefact; starter?: string },
	) => post(`${base(u, g)}/${id}/upgrade`, body) as Promise<ModelUpgradeResult>,

	// ── Links and the global model (stitch-models.md) ────────────────────────
	links: (u: string, g: string) =>
		request<ModelLink[]>(`${graphBase(u, g)}/model-links`),
	declareLink: (u: string, g: string, data: ModelLinkDeclare) =>
		post(`${graphBase(u, g)}/model-links`, data) as Promise<ModelLink>,
	removeLink: (u: string, g: string, linkId: string) =>
		del(`${graphBase(u, g)}/model-links/${linkId}`),
	/** How many the rule resolves — a key on each side, counted before declaring. */
	previewStitch: (
		u: string,
		g: string,
		data: {
			source_type: string;
			source_property: string;
			target_type: string;
			target_property: string;
			identity_match?: "exact" | "case_insensitive";
		},
	) =>
		post(
			`${graphBase(u, g)}/model-links/preview`,
			data,
		) as Promise<StitchPreview>,
	/** Flip every staged stitch to active, in one action (ST21). */
	commitStitches: (u: string, g: string) =>
		post(`${graphBase(u, g)}/model-links/commit`, {}) as Promise<unknown>,
	/** Drop the staged set, or one stitch out of it. */
	discardStitches: (u: string, g: string, linkId?: string) =>
		post(`${graphBase(u, g)}/model-links/discard`, {
			link_id: linkId ?? null,
		}) as Promise<unknown>,
	globalModel: (u: string, g: string) =>
		request<GlobalModel>(`${graphBase(u, g)}/global-model`),
};
