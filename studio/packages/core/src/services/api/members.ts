import { listQueryToApi } from "../../lib/listQuery";
import type {
	GraphAccess,
	GraphMember,
	GraphMemberAdd,
	GraphRole,
} from "../../types/access";
import type { ListQuery, Page } from "../../types/list";
import type { GraphRef } from "../../types/product";
import { apiClient } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// A Graph's members and the caller's access
// (docs/for-developers/modules/identity-and-access/features/roles.md)
// ─────────────────────────────────────────────────────────────────────────────

const graphBase = (g: GraphRef) => `/api/v1/u/${g.username}/${g.graphSlug}`;

export const membersApi = {
	/** `q` searches username and email; `role` filters; sorted by username. */
	list: async (g: GraphRef, query: ListQuery = {}) =>
		(
			await apiClient.get<Page<GraphMember>>(
				`${graphBase(g)}/members${listQueryToApi(query)}`,
			)
		).data,

	add: async (g: GraphRef, body: GraphMemberAdd) =>
		(await apiClient.post<GraphMember>(`${graphBase(g)}/members`, body)).data,

	/** Replaces the member's roles; an empty list leaves them a viewer. */
	setRoles: async (g: GraphRef, username: string, roles: GraphRole[]) =>
		(
			await apiClient.patch<GraphMember>(
				`${graphBase(g)}/members/${encodeURIComponent(username)}`,
				{ roles },
			)
		).data,

	remove: async (g: GraphRef, username: string) => {
		await apiClient.delete(
			`${graphBase(g)}/members/${encodeURIComponent(username)}`,
		);
	},

	/** What the caller may change, area by area. */
	access: async (g: GraphRef) =>
		(await apiClient.get<GraphAccess>(`${graphBase(g)}/access`)).data,
};
