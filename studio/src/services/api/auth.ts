import { apiClient } from "@/services/api/client";
import type {
	AuthResponse,
	AuthUser,
	PersonalAccessTokenCreated,
	PersonalAccessTokenList,
	ThemeSelection,
	UsernameAvailabilityResponse,
} from "@/types/auth";

export const authApi = {
	usernameAvailable: async (username: string) =>
		(
			await apiClient.get<UsernameAvailabilityResponse>(
				"/api/v1/auth/username-available",
				{
					params: { username },
				},
			)
		).data,

	// `identifier` is a username or an email (docs/for-developers/modules/identity-and-access/features/accounts.md).
	login: async (identifier: string, password: string) =>
		(
			await apiClient.post<AuthResponse>("/api/v1/auth/login", {
				identifier,
				password,
			})
		).data,

	logout: async (refreshToken: string) => {
		await apiClient.post("/api/v1/auth/logout", {
			refresh_token: refreshToken,
		});
	},

	me: async () => (await apiClient.get<AuthUser>("/api/v1/auth/me")).data,

	patchMe: async (body: {
		first_name?: string;
		last_name?: string | null;
		username?: string;
		// Theme selection persisted to the profile (docs/for-developers/modules/platform/features/theming.md); merged server-side
		// into `preferences.theme`.
		theme?: ThemeSelection;
	}) => (await apiClient.patch<AuthUser>("/api/v1/auth/me", body)).data,

	changePassword: async (current_password: string, new_password: string) => {
		await apiClient.post("/api/v1/auth/me/password", {
			current_password,
			new_password,
		});
	},

	deleteMe: async (password: string) => {
		await apiClient.delete("/api/v1/auth/me", { data: { password } });
	},

	// Personal access tokens
	// (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
	// Every call here needs a session — a token cannot manage tokens (PT4).
	listTokens: async () =>
		(await apiClient.get<PersonalAccessTokenList>("/api/v1/auth/me/tokens"))
			.data,

	// `expires_in_days: null` is "never" — a choice the client states, not omits.
	createToken: async (name: string, expires_in_days: number | null) =>
		(
			await apiClient.post<PersonalAccessTokenCreated>(
				"/api/v1/auth/me/tokens",
				{ name, expires_in_days },
			)
		).data,

	revokeToken: async (id: string) => {
		await apiClient.delete(`/api/v1/auth/me/tokens/${id}`);
	},
};
