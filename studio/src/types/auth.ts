/** Shared auth + graph membership types. Must mirror engine schemas (RFC-017). */

export type GraphRole = "developer" | "analyst" | "admin";

export interface GraphMembership {
	graph_id: string;
	graph_name: string;
	graph_slug: string;
	owner_username: string;
	role: GraphRole;
}

export interface AuthUser {
	id: string;
	email: string;
	username: string;
	first_name: string;
	last_name: string | null;
	is_superuser: boolean;
	username_last_changed_at: string | null;
	graphs: GraphMembership[];
}

export interface AuthResponse {
	user: AuthUser;
	access_token: string;
	refresh_token: string;
	token_type: string;
}

export interface GraphMember {
	user_id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string | null;
	role: GraphRole;
	created_at: string;
}

export interface Invitation {
	id: string;
	email: string;
	graph_id: string;
	role: GraphRole;
	invited_by_id: string | null;
	expires_at: string;
	accepted_at: string | null;
	created_at: string;
}

export interface InvitationCreateResponse extends Invitation {
	redeem_url: string;
}

export interface UsernameAvailabilityResponse {
	available: boolean;
	reason?: "taken" | "reserved" | "invalid_format";
}
