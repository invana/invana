/**
 * Keeps the active theme selection in sync with the signed-in user's profile
 * (RFC-044). The `<ThemeProvider>` already persists the selection to
 * localStorage (per-device); this bridge makes it follow the user across
 * devices by reconciling with the engine:
 *
 *  - **Hydrate** — the first time a user is known (login / stored session), if
 *    their `preferences.theme` is set it's applied to the provider. The server
 *    is the source of truth on login; the local (pre-login) selection is only a
 *    fallback used until then.
 *  - **Persist** — after hydration, any live change from a picker (the header
 *    `<ThemeSelector>` or the settings form) is PATCHed to `/auth/me`. Both
 *    entry points drive the same provider, so they're covered here once — no
 *    per-widget save wiring. The updated user is written back to the auth store
 *    so a later re-read matches (no echo).
 *
 * Renders nothing; mount it once inside `<ThemeProvider>`.
 */

import { useTheme } from "@invana/themes";
import { useEffect, useRef } from "react";
import { authApi } from "../services/api/auth";
import { useAuthStore } from "../stores/auth.store";
import type { ThemeSelection } from "../types/auth";

const keyOf = (s: ThemeSelection) => `${s.theme}|${s.mode}|${s.accent ?? ""}`;

export function ThemeSyncBridge() {
	const { theme, mode, accent, setTheme, setMode, setAccent } = useTheme();
	const user = useAuthStore((s) => s.user);
	const setUser = useAuthStore((s) => s.setUser);

	// The user id we've hydrated for, and the last selection we know the server
	// holds — guards against re-hydrating and against echoing a value back.
	const hydratedFor = useRef<string | null>(null);
	const lastSynced = useRef<string | null>(null);

	// Hydrate once per signed-in user.
	useEffect(() => {
		if (!user) {
			hydratedFor.current = null;
			lastSynced.current = null;
			return;
		}
		if (hydratedFor.current === user.id) return;
		hydratedFor.current = user.id;

		const pref = user.preferences?.theme;
		if (!pref) {
			// No server selection yet — let the next local change push one up.
			lastSynced.current = null;
			return;
		}
		// Mark as already-synced so applying it below doesn't PATCH it straight back.
		lastSynced.current = keyOf(pref);
		if (pref.theme !== theme) setTheme(pref.theme);
		if (pref.mode !== mode) setMode(pref.mode);
		if ((pref.accent ?? null) !== accent) setAccent(pref.accent ?? null);
	}, [user, theme, mode, accent, setTheme, setMode, setAccent]);

	// Persist live changes to the profile (only once hydrated for this user).
	useEffect(() => {
		if (!user || hydratedFor.current !== user.id) return;
		const selection: ThemeSelection = { theme, mode, accent };
		const key = keyOf(selection);
		if (key === lastSynced.current) return;
		lastSynced.current = key;
		authApi
			.patchMe({ theme: selection })
			.then(setUser)
			.catch(() => {
				// Non-fatal: the change already applied + persisted locally. Allow a
				// later change (or reload) to retry the sync.
			});
	}, [user, theme, mode, accent, setUser]);

	return null;
}
