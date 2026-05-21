/**
 * Zustand auth store, persisted to localStorage (HttpOnly cookies deferred
 * per mvp.md). The store also wires itself into the axios client via
 * registerAuthAccess so the interceptors can read/refresh tokens without
 * a circular import.
 *
 * Per RFC-017 the active Graph is derived from the URL (/u/:username/:graphSlug),
 * not from session state. The store therefore tracks only the user + tokens.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerAuthAccess } from "../services/api/client";
import type { AuthUser } from "../types/auth";

interface AuthState {
	user: AuthUser | null;
	accessToken: string | null;
	refreshToken: string | null;
	hydrated: boolean;
	setSession: (params: {
		user: AuthUser;
		accessToken: string;
		refreshToken: string;
	}) => void;
	setTokens: (params: { accessToken: string; refreshToken: string }) => void;
	setUser: (user: AuthUser) => void;
	clear: () => void;
}

const STORAGE_KEY = "invana.auth";

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			accessToken: null,
			refreshToken: null,
			hydrated: false,
			setSession: ({ user, accessToken, refreshToken }) =>
				set({ user, accessToken, refreshToken }),
			setTokens: ({ accessToken, refreshToken }) =>
				set({ accessToken, refreshToken }),
			setUser: (user) => set({ user }),
			clear: () =>
				set({
					user: null,
					accessToken: null,
					refreshToken: null,
				}),
		}),
		{
			name: STORAGE_KEY,
			onRehydrateStorage: () => (state) => {
				if (state) state.hydrated = true;
			},
		},
	),
);

// Wire the axios interceptors to read/refresh from this store.
// Done at module load so it's ready before any request fires.
registerAuthAccess({
	getAccessToken: () => useAuthStore.getState().accessToken,
	getRefreshToken: () => useAuthStore.getState().refreshToken,
	setTokens: ({ accessToken, refreshToken }) =>
		useAuthStore.getState().setTokens({ accessToken, refreshToken }),
	clear: () => useAuthStore.getState().clear(),
});
