/**
 * Graph membership + invitations API. Targets `/api/v1/u/:username/:slug/...`
 * per RFC-017.
 *
 * Graph container CRUD (POST /api/v1/graphs, GET /api/v1/graphs, …) lands in
 * S2 alongside the setup wizard.
 */

import type {
	GraphMember,
	GraphRole,
	Invitation,
	InvitationCreateResponse,
} from "../../types/auth";
import { apiClient } from "./client";

function base(username: string, slug: string): string {
	return `/api/v1/u/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

export const graphMembershipApi = {
	listMembers: async (username: string, slug: string) =>
		(await apiClient.get<GraphMember[]>(`${base(username, slug)}/members`))
			.data,

	updateMemberRole: async (
		username: string,
		slug: string,
		userId: string,
		role: GraphRole,
	) =>
		(
			await apiClient.patch<GraphMember>(
				`${base(username, slug)}/members/${userId}`,
				{ role },
			)
		).data,

	removeMember: async (username: string, slug: string, userId: string) => {
		await apiClient.delete(`${base(username, slug)}/members/${userId}`);
	},

	listInvitations: async (username: string, slug: string) =>
		(await apiClient.get<Invitation[]>(`${base(username, slug)}/invitations`))
			.data,

	createInvitation: async (
		username: string,
		slug: string,
		body: { email: string; role: GraphRole },
	) =>
		(
			await apiClient.post<InvitationCreateResponse>(
				`${base(username, slug)}/invitations`,
				body,
			)
		).data,

	deleteInvitation: async (
		username: string,
		slug: string,
		invitationId: string,
	) => {
		await apiClient.delete(
			`${base(username, slug)}/invitations/${invitationId}`,
		);
	},
};
