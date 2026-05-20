import { useMemo } from "react";
import { authApi } from "../services/api/auth";
import { useAuthStore } from "../stores/auth.store";
import type { WorkspaceRole } from "../types/auth";

export function useAuth() {
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const refreshToken = useAuthStore((s) => s.refreshToken);
	const activeWorkspaceId = useAuthStore((s) => s.activeWorkspaceId);
	const setSession = useAuthStore((s) => s.setSession);
	const setUser = useAuthStore((s) => s.setUser);
	const clear = useAuthStore((s) => s.clear);
	const setActiveWorkspaceId = useAuthStore((s) => s.setActiveWorkspaceId);

	const activeMembership = useMemo(
		() =>
			user?.workspaces.find((w) => w.workspace_id === activeWorkspaceId) ??
			null,
		[user, activeWorkspaceId],
	);

	function membershipForSlug(slug: string | undefined) {
		if (!slug) return null;
		return user?.workspaces.find((w) => w.workspace_slug === slug) ?? null;
	}

	function membershipForId(id: string | undefined) {
		if (!id) return null;
		return user?.workspaces.find((w) => w.workspace_id === id) ?? null;
	}

	const role: WorkspaceRole | null = activeMembership?.role ?? null;
	const isAuthenticated = !!accessToken && !!user;
	const isSuperuser = !!user?.is_superuser;
	const isAdmin = role === "admin";
	const isBuilder = role === "admin" || role === "developer";

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
		role,
		activeWorkspaceId,
		activeMembership,
		membershipForSlug,
		membershipForId,
		isAuthenticated,
		isSuperuser,
		isAdmin,
		isBuilder,
		displayName,
		setSession,
		setUser,
		setActiveWorkspaceId,
		logout,
	};
}
