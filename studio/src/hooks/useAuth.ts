import { authApi } from "../services/api/auth";
import { useAuthStore } from "../stores/auth.store";
import type { GraphRole } from "../types/auth";

export function useAuth() {
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const refreshToken = useAuthStore((s) => s.refreshToken);
	const setSession = useAuthStore((s) => s.setSession);
	const setUser = useAuthStore((s) => s.setUser);
	const clear = useAuthStore((s) => s.clear);

	/** Resolve the user's membership in a specific Graph by owner + slug.
	 *  Per RFC-017 the active Graph comes from the URL — pass the URL params. */
	function membershipForGraph(
		username: string | undefined,
		slug: string | undefined,
	) {
		if (!username || !slug || !user) return null;
		return (
			user.graphs.find(
				(g) => g.owner_username === username && g.graph_slug === slug,
			) ?? null
		);
	}

	function rolesForGraph(
		username: string | undefined,
		slug: string | undefined,
	) {
		const m = membershipForGraph(username, slug);
		const role: GraphRole | null = m?.role ?? null;
		return {
			role,
			isAdmin: role === "admin",
			isBuilder: role === "admin" || role === "developer",
			isAnalyst: role === "analyst",
			isMember: !!m,
		};
	}

	const isAuthenticated = !!accessToken && !!user;
	const isSuperuser = !!user?.is_superuser;

	const displayName = user
		? user.last_name
			? `${user.first_name} ${user.last_name}`
			: user.first_name
		: "";

	async function logout() {
		if (refreshToken) {
			try {
				await authApi.logout(refreshToken);
			} catch {
				// Ignore — clear locally regardless.
			}
		}
		clear();
	}

	return {
		user,
		isAuthenticated,
		isSuperuser,
		displayName,
		membershipForGraph,
		rolesForGraph,
		setSession,
		setUser,
		clear,
		logout,
	};
}
