import type {
	ConstraintCreate,
	EdgeTypeCreate,
	EdgeTypeUpdate,
	GraphModelCreate,
	GraphModelResponse,
	GraphModelSummary,
	GraphModelUpdate,
	IndexCreate,
	NodeTypeCreate,
	NodeTypeUpdate,
	PropertyKeyCreate,
	VersionActivate,
	VersionCreate,
	VersionSummary,
} from "../../types/models";
import type {
	ConstraintResponse,
	EdgeTypeResponse,
	GraphVersionResponse,
	IndexResponse,
	NodeTypeResponse,
	PropertyKeyResponse,
} from "../../types/schemas";
import { request } from "./client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/models`;
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
	setDefault: (u: string, g: string, id: string) =>
		post(`${base(u, g)}/${id}/set-default`, {}) as Promise<GraphModelResponse>,

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
};
