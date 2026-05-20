/** Shared auth + workspace types. Must mirror engine schemas. */

export type WorkspaceRole = "developer" | "analyst" | "admin";

export interface WorkspaceMembership {
	workspace_id: string;
	workspace_name: string;
	workspace_slug: string;
	role: WorkspaceRole;
}

export interface AuthUser {
	id: string;
	email: string;
	first_name: string;
	last_name: string | null;
	is_superuser: boolean;
	workspaces: WorkspaceMembership[];
}

export interface AuthResponse {
	user: AuthUser;
	access_token: string;
	refresh_token: string;
	token_type: string;
}

export interface Workspace {
	id: string;
	name: string;
	slug: string;
	created_by_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface WorkspaceMember {
	user_id: string;
	email: string;
	first_name: string;
	last_name: string | null;
	role: WorkspaceRole;
	created_at: string;
}

export interface Invitation {
	id: string;
	email: string;
	workspace_id: string;
	role: WorkspaceRole;
	invited_by_id: string | null;
	expires_at: string;
	accepted_at: string | null;
	created_at: string;
}

export interface InvitationCreateResponse extends Invitation {
	redeem_url: string;
}
