/**
 * Resume an existing session on a public auth page.
 *
 * Landing on `/login` with a session already in localStorage (a bookmarked
 * `/login?next=…`, a second tab, a back-button) should not ask for a password
 * again — sessions.md SS1/SS2 say the refresh token is the session, so the page
 * proves it and moves on.
 *
 * Three outcomes:
 * - `resumed`    — user + access token already in the store, or `/auth/me`
 *                  answered (the axios interceptor rotates an expired access
 *                  token underneath it, sessions.md SS3).
 * - `anonymous`  — no refresh token, or `/auth/me` refused. The store is
 *                  cleared so a stale half-session cannot linger.
 * - `checking`   — `/auth/me` is in flight; the caller shows a waiting state
 *                  instead of flashing the sign-in form.
 */

import { authApi } from "@/services/api/auth";
import { useAuthStore } from "@/stores/auth.store";
import { useEffect, useState } from "react";

export type SessionResumeState = "checking" | "resumed" | "anonymous";

export function useSessionResume(): SessionResumeState {
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const alreadySignedIn = !!user && !!accessToken;

	const [state, setState] = useState<SessionResumeState>(() => {
		if (alreadySignedIn) return "resumed";
		// A refresh token alone is still a session — the access token may have
		// expired while the tab was closed. Verify it rather than assume.
		return useAuthStore.getState().refreshToken ? "checking" : "anonymous";
	});

	useEffect(() => {
		// A sign-in completing on this page flips the store; follow it so the
		// caller redirects through the same path as a resumed session.
		if (alreadySignedIn) setState("resumed");
	}, [alreadySignedIn]);

	useEffect(() => {
		if (state !== "checking") return;
		let cancelled = false;
		(async () => {
			try {
				const fresh = await authApi.me();
				if (cancelled) return;
				useAuthStore.getState().setUser(fresh);
				setState("resumed");
			} catch {
				if (cancelled) return;
				useAuthStore.getState().clear();
				setState("anonymous");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [state]);

	return state;
}
