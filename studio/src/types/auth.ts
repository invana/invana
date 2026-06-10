/** Shared auth + graph membership types. Must mirror engine schemas (RFC-017).
 *  Membership is binary (RFC-023) — there is no per-graph role. */

export interface GraphMembership {
	graph_id: string;
	graph_name: string;
	graph_slug: string;
	owner_username: string;
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

export interface UsernameAvailabilityResponse {
	available: boolean;
	reason?: "taken" | "reserved" | "invalid_format";
}
