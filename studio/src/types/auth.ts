/** Shared auth + graph membership types. Must mirror engine schemas (docs/for-developers/modules/identity-and-access/spec.md).
 *  Membership is binary (docs/for-developers/modules/identity-and-access/features/membership.md) — there is no per-graph role. */

export interface GraphMembership {
	graph_id: string;
	graph_name: string;
	graph_slug: string;
	owner_username: string;
}

/** The studio theme selection persisted under `preferences.theme` (docs/for-developers/modules/platform/features/theming.md).
 *  Mirrors `@invana/themes` ThemeSelection; `accent === null` → the theme's own
 *  signature accent. */
export interface ThemeSelection {
	theme: string;
	mode: "light" | "dark" | "system";
	accent: string | null;
}

/** Open per-user UI-preferences bag returned by the engine. */
export interface UserPreferences {
	theme?: ThemeSelection;
	[key: string]: unknown;
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
	preferences: UserPreferences;
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

/** A personal access token as the list shows it
 *  (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
 *  The secret is not here — it exists once, in the create response (PT2). */
export interface PersonalAccessToken {
	id: string;
	name: string;
	/** Display tail only — rendered as `invana_pat_…abcd`. */
	last_four: string;
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
	expired: boolean;
}

/** The list, plus what this deployment allows — the picker and the ceiling are
 *  rendered from configuration rather than restated here (C10). */
export interface PersonalAccessTokenList {
	tokens: PersonalAccessToken[];
	expiry_day_choices: number[];
	max_tokens: number;
}

/** The one response that carries the secret. */
export interface PersonalAccessTokenCreated {
	token: PersonalAccessToken;
	secret: string;
}
