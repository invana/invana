/**
 * Graph membership + invitations API. Targets `/api/v1/u/:username/:graphSlug/...`
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

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${encodeURIComponent(username)}/${encodeURIComponent(graphSlug)}`;
}

export const graphMembershipApi = {
	listMembers: async (username: string, graphSlug: string) =>
		(await apiClient.get<GraphMember[]>(`${base(username, graphSlug)}/members`))
			.data,

	updateMemberRole: async (
		username: string,
		graphSlug: string,
		userId: string,
		role: GraphRole,
	) =>
		(
			await apiClient.patch<GraphMember>(
				`${base(username, graphSlug)}/members/${userId}`,
				{ role },
			)
		).data,

	removeMember: async (username: string, graphSlug: string, userId: string) => {
		await apiClient.delete(`${base(username, graphSlug)}/members/${userId}`);
	},

	listInvitations: async (username: string, graphSlug: string) =>
		(
			await apiClient.get<Invitation[]>(
				`${base(username, graphSlug)}/invitations`,
			)
		).data,

	createInvitation: async (
		username: string,
		graphSlug: string,
		body: { email: string; role: GraphRole },
	) =>
		(
			await apiClient.post<InvitationCreateResponse>(
				`${base(username, graphSlug)}/invitations`,
				body,
			)
		).data,

	deleteInvitation: async (
		username: string,
		graphSlug: string,
		invitationId: string,
	) => {
		await apiClient.delete(
			`${base(username, graphSlug)}/invitations/${invitationId}`,
		);
	},
};
