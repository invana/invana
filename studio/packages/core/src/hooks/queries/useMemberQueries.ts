import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { listQueryKey } from "../../lib/listQuery";
import { authApi } from "../../services/api/auth";
import { membersApi } from "../../services/api/members";
import { useAuthStore } from "../../stores/auth.store";
import type { GraphMemberAdd, GraphRole } from "../../types/access";
import type { ListQuery } from "../../types/list";
import type { GraphRef } from "../../types/product";

/**
 * A Graph's members and the signed-in member's access
 * (docs/for-developers/modules/identity-and-access/features/roles.md).
 *
 * | Hook | Reads | Key |
 * |---|---|---|
 * | `useMembersQuery` | `GET …/members` | `["members", owner, graph, query]` |
 * | `useGraphAccessQuery` | `GET …/access` | `["access", owner, graph]` |
 * | `useMemberMutations` | add · set roles · remove | invalidates both |
 *
 * The members key is the one the shell's rules and schedules name member ids
 * with, so a role change shows everywhere at once. A change to the signed-in
 * member's own roles also refreshes `/auth/me`, whose `graphs[].roles` carries
 * them.
 */

const memberKeys = {
	members: (g: GraphRef | undefined) =>
		["members", g?.username, g?.graphSlug] as const,
	access: (g: GraphRef | undefined) =>
		["access", g?.username, g?.graphSlug] as const,
};

/** Every member, for a caller that names member ids rather than listing them. */
const EVERY_MEMBER: ListQuery = { limit: 200 };

/** One page of the members list for `query`; by default every member. */
export function useMembersQuery(
	graph: GraphRef | undefined,
	query: ListQuery = EVERY_MEMBER,
) {
	return useQuery({
		queryKey: [...memberKeys.members(graph), listQueryKey(query)] as const,
		queryFn: () => membersApi.list(graph as GraphRef, query),
		enabled: !!graph,
		staleTime: 60_000,
		placeholderData: keepPreviousData,
	});
}

export function useGraphAccessQuery(graph: GraphRef | undefined) {
	return useQuery({
		queryKey: memberKeys.access(graph),
		queryFn: () => membersApi.access(graph as GraphRef),
		enabled: !!graph,
		staleTime: 60_000,
	});
}

export function useMemberMutations(graph: GraphRef) {
	const qc = useQueryClient();
	const settle = async (username?: string) => {
		await Promise.all([
			qc.invalidateQueries({ queryKey: memberKeys.members(graph) }),
			qc.invalidateQueries({ queryKey: memberKeys.access(graph) }),
		]);
		const store = useAuthStore.getState();
		if (username && store.user?.username === username) {
			try {
				store.setUser(await authApi.me());
			} catch {
				// The roles still change on the next sign-in.
			}
		}
	};
	return {
		add: useMutation({
			mutationFn: (body: GraphMemberAdd) => membersApi.add(graph, body),
			onSuccess: (m) => settle(m.username),
		}),
		setRoles: useMutation({
			mutationFn: (v: { username: string; roles: GraphRole[] }) =>
				membersApi.setRoles(graph, v.username, v.roles),
			onSuccess: (m) => settle(m.username),
		}),
		remove: useMutation({
			mutationFn: (username: string) => membersApi.remove(graph, username),
			onSuccess: (_, username) => settle(username),
		}),
	};
}
