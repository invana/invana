import type {
	Invitation,
	InvitationCreateResponse,
	Workspace,
	WorkspaceMember,
	WorkspaceRole,
} from "../../types/auth";
import { apiClient } from "./client";

export const workspacesApi = {
	list: async () =>
		(await apiClient.get<Workspace[]>("/api/v1/workspaces")).data,

	create: async (body: { name: string; slug: string }) =>
		(await apiClient.post<Workspace>("/api/v1/workspaces", body)).data,

	listMembers: async (workspaceId: string) =>
		(
			await apiClient.get<WorkspaceMember[]>(
				`/api/v1/workspaces/${workspaceId}/members`,
			)
		).data,

	updateMemberRole: async (
		workspaceId: string,
		userId: string,
		role: WorkspaceRole,
	) =>
		(
			await apiClient.patch<WorkspaceMember>(
				`/api/v1/workspaces/${workspaceId}/members/${userId}`,
				{ role },
			)
		).data,

	removeMember: async (workspaceId: string, userId: string) => {
		await apiClient.delete(
			`/api/v1/workspaces/${workspaceId}/members/${userId}`,
		);
	},

	listInvitations: async (workspaceId: string) =>
		(
			await apiClient.get<Invitation[]>(
				`/api/v1/workspaces/${workspaceId}/invitations`,
			)
		).data,

	createInvitation: async (
		workspaceId: string,
		body: { email: string; role: WorkspaceRole },
	) =>
		(
			await apiClient.post<InvitationCreateResponse>(
				`/api/v1/workspaces/${workspaceId}/invitations`,
				body,
			)
		).data,

	deleteInvitation: async (workspaceId: string, invitationId: string) => {
		await apiClient.delete(
			`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`,
		);
	},
};
