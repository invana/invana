import type {
	AuthResponse,
	AuthUser,
	ThemeSelection,
	UsernameAvailabilityResponse,
} from "../../types/auth";
import { apiClient } from "./client";

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

	// `identifier` is a username or an email (RFC-034).
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
		// Theme selection persisted to the profile (RFC-044); merged server-side
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
};
