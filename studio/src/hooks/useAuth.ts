import { authApi } from "../services/api/auth";
import { useAuthStore } from "../stores/auth.store";

export function useAuth() {
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const refreshToken = useAuthStore((s) => s.refreshToken);
	const setSession = useAuthStore((s) => s.setSession);
	const setUser = useAuthStore((s) => s.setUser);
	const clear = useAuthStore((s) => s.clear);

	/** Resolve the user's membership in a specific Graph by owner + graphSlug.
	 *  Per RFC-017 the active Graph comes from the URL — pass the URL params. */
	function membershipForGraph(
		username: string | undefined,
		graphSlug: string | undefined,
	) {
		if (!username || !graphSlug || !user) return null;
		return (
			user.graphs.find(
				(g) => g.owner_username === username && g.graph_slug === graphSlug,
			) ?? null
		);
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
		setSession,
		setUser,
		clear,
		logout,
	};
}
