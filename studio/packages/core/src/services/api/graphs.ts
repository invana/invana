import type {
	ConnectionTestResult,
	Graph,
	GraphConnect,
	GraphConnectionCreate,
	GraphConnectionRead,
	GraphConnectRead,
	GraphContention,
	GraphCreate,
	GraphListResponse,
	GraphUpdate,
	SetupSection,
} from "../../types/graphs";
import { request } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Graph container API (docs/for-developers/modules/identity-and-access/spec.md)
// ─────────────────────────────────────────────────────────────────────────────

export const graphsApi = {
	list: (includeArchived = false) =>
		request<GraphListResponse>(
			`/api/v1/graphs${includeArchived ? "?include_archived=true" : ""}`,
		),

	/** Prove credentials before any Graph exists — recorded nowhere. */
	connectTest: (data: GraphConnectionCreate) =>
		request<ConnectionTestResult>("/api/v1/graphs/connect/test", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** Test, make the Graph, save its connection and draft a model from the database. */
	connect: (data: GraphConnect) =>
		request<GraphConnectRead>("/api/v1/graphs/connect", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	get: (username: string, graphSlug: string) =>
		request<Graph>(`/api/v1/u/${username}/${graphSlug}`),

	create: (data: GraphCreate) =>
		request<Graph>("/api/v1/graphs", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (username: string, graphSlug: string, data: GraphUpdate) =>
		request<Graph>(`/api/v1/u/${username}/${graphSlug}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, graphSlug: string) =>
		request<void>(`/api/v1/u/${username}/${graphSlug}`, { method: "DELETE" }),

	setSetupSection: (
		username: string,
		graphSlug: string,
		section: SetupSection,
		action: "skip" | "reset",
	) =>
		request<Graph>(`/api/v1/u/${username}/${graphSlug}/setup/${section}`, {
			method: "POST",
			body: JSON.stringify({ action }),
		}),

	// Connection sub-resource — 1:1 child of the Graph.
	getConnection: (username: string, graphSlug: string) =>
		request<GraphConnectionRead | null>(
			`/api/v1/u/${username}/${graphSlug}/connection`,
		),

	putConnection: (
		username: string,
		graphSlug: string,
		data: GraphConnectionCreate,
	) =>
		request<GraphConnectionRead>(
			`/api/v1/u/${username}/${graphSlug}/connection`,
			{
				method: "PUT",
				body: JSON.stringify(data),
			},
		),

	deleteConnection: (username: string, graphSlug: string) =>
		request<void>(`/api/v1/u/${username}/${graphSlug}/connection`, {
			method: "DELETE",
		}),

	pingConnection: (username: string, graphSlug: string) =>
		request<{ detail: string }>(
			`/api/v1/u/${username}/${graphSlug}/connection/ping`,
			{
				method: "POST",
			},
		),

	introspectConnection: (username: string, graphSlug: string) =>
		request<{ detail: string }>(
			`/api/v1/u/${username}/${graphSlug}/connection/introspect`,
			{
				method: "POST",
			},
		),

	// docs/for-developers/modules/graph-connectors/features/capabilities.md — accept the risk of an UNTESTED backend version (lifts read-only).
	acknowledgeConnectionVersion: (username: string, graphSlug: string) =>
		request<GraphConnectionRead>(
			`/api/v1/u/${username}/${graphSlug}/connection/acknowledge-version`,
			{ method: "POST" },
		),

	// docs/for-developers/modules/graph-connectors/features/capabilities.md — declare a server version when auto-detection is unavailable.
	declareConnectionVersion: (
		username: string,
		graphSlug: string,
		serverVersion: string,
	) =>
		request<GraphConnectionRead>(
			`/api/v1/u/${username}/${graphSlug}/connection/version`,
			{
				method: "PATCH",
				body: JSON.stringify({ server_version: serverVersion }),
			},
		),

	testConnection: (
		username: string,
		graphSlug: string,
		data: GraphConnectionCreate,
	) =>
		request<ConnectionTestResult>(
			`/api/v1/u/${username}/${graphSlug}/connection/test`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	/** The Graph's ceiling, and what it is holding back right now. */
	contention: (username: string, graphSlug: string) =>
		request<GraphContention>(`/api/v1/u/${username}/${graphSlug}/contention`),
};
