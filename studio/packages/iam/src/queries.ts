/**
 * TanStack Query hooks for IAM. Every key sits under
 * `["iam", owner, graph, …]`:
 *
 * | Key tail | Read |
 * |---|---|
 * | `overview` | Home's counts |
 * | `policies, <list>` | one page of policies |
 * | `policy, <name>` | one policy; `…, versions` · `…, holders, <list>` · `…, limits` under it |
 * | `people, <list>` · `groups, <list>` · `group, <name>` | people and groups |
 * | `agents, <list>` · `agent, <id>, effective, …` · `agent, <id>, refusals, <list>` | agents' access |
 * | `tokens, <list>` | tokens |
 *
 * Access is one web — a policy attached to a group changes what each member
 * and each agent in it may do, and every tile on Home — so a write
 * invalidates the Graph's whole `iam` tree rather than guessing which reads
 * it touched. Impact and test access are reads sent as `POST`, so they are
 * mutations that invalidate nothing.
 */

import { type ListQuery, listQueryKey } from "@invana-studio/core";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { iamApi } from "./api";
import type {
	AccessCheckRequest,
	AttachRequest,
	EffectiveQuery,
	GroupCreate,
	GroupMemberAdd,
	GroupUpdate,
	IamTokenCreate,
	ImpactRequest,
	PolicyCreate,
	PolicyDraftRequest,
	PolicySave,
	PolicyUpdate,
	ServiceAccountCreate,
} from "./types";

type Scope = { username: string; graphSlug: string };
type Maybe = string | undefined;

/** The Graph's whole IAM tree — what every write invalidates. */
export const iamKey = (username: Maybe, graphSlug: Maybe) =>
	["iam", username, graphSlug] as const;

const policyKey = (u: Maybe, g: Maybe, name: Maybe) =>
	[...iamKey(u, g), "policy", name] as const;

const agentKey = (u: Maybe, g: Maybe, id: Maybe) =>
	[...iamKey(u, g), "agent", id] as const;

/** One read, enabled once the Graph (and the record, when named) is known. */
function useIamRead<T>(
	key: readonly unknown[],
	read: (u: string, g: string) => Promise<T>,
	username: Maybe,
	graphSlug: Maybe,
	ready = true,
	paged = false,
) {
	return useQuery({
		queryKey: key,
		queryFn: () => read(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug && ready,
		placeholderData: paged ? keepPreviousData : undefined,
	});
}

// ── reads ───────────────────────────────────────────────────────────────────

export const useIamOverviewQuery = (u: Maybe, g: Maybe) =>
	useIamRead([...iamKey(u, g), "overview"], iamApi.overview, u, g);

export const usePoliciesQuery = (u: Maybe, g: Maybe, query: ListQuery = {}) =>
	useIamRead(
		[...iamKey(u, g), "policies", listQueryKey(query)],
		(un, gs) => iamApi.policies(un, gs, query),
		u,
		g,
		true,
		true,
	);

export const usePolicyQuery = (u: Maybe, g: Maybe, name: Maybe) =>
	useIamRead(
		policyKey(u, g, name),
		(un, gs) => iamApi.policy(un, gs, name as string),
		u,
		g,
		!!name,
	);

export const usePolicyVersionsQuery = (u: Maybe, g: Maybe, name: Maybe) =>
	useIamRead(
		[...policyKey(u, g, name), "versions"],
		(un, gs) => iamApi.policyVersions(un, gs, name as string),
		u,
		g,
		!!name,
	);

export const useHoldersQuery = (
	u: Maybe,
	g: Maybe,
	name: Maybe,
	query: ListQuery = {},
) =>
	useIamRead(
		[...policyKey(u, g, name), "holders", listQueryKey(query)],
		(un, gs) => iamApi.holders(un, gs, name as string, query),
		u,
		g,
		!!name,
		true,
	);

export const usePolicyLimitsQuery = (u: Maybe, g: Maybe, name: Maybe) =>
	useIamRead(
		[...policyKey(u, g, name), "limits"],
		(un, gs) => iamApi.limits(un, gs, name as string),
		u,
		g,
		!!name,
	);

export const usePeopleQuery = (u: Maybe, g: Maybe, query: ListQuery = {}) =>
	useIamRead(
		[...iamKey(u, g), "people", listQueryKey(query)],
		(un, gs) => iamApi.people(un, gs, query),
		u,
		g,
		true,
		true,
	);

export const useGroupsQuery = (u: Maybe, g: Maybe, query: ListQuery = {}) =>
	useIamRead(
		[...iamKey(u, g), "groups", listQueryKey(query)],
		(un, gs) => iamApi.groups(un, gs, query),
		u,
		g,
		true,
		true,
	);

export const useGroupQuery = (u: Maybe, g: Maybe, name: Maybe) =>
	useIamRead(
		[...iamKey(u, g), "group", name],
		(un, gs) => iamApi.group(un, gs, name as string),
		u,
		g,
		!!name,
	);

export const useIamAgentsQuery = (u: Maybe, g: Maybe, query: ListQuery = {}) =>
	useIamRead(
		[...iamKey(u, g), "agents", listQueryKey(query)],
		(un, gs) => iamApi.agents(un, gs, query),
		u,
		g,
		true,
		true,
	);

export const useEffectiveQuery = (
	u: Maybe,
	g: Maybe,
	id: Maybe,
	query: EffectiveQuery = {},
) =>
	useIamRead(
		[
			...agentKey(u, g, id),
			"effective",
			query.started_by ?? null,
			query.world_id ?? null,
			query.run_id ?? null,
		],
		(un, gs) => iamApi.effective(un, gs, id as string, query),
		u,
		g,
		!!id,
	);

export const useRefusalsQuery = (
	u: Maybe,
	g: Maybe,
	id: Maybe,
	query: ListQuery = {},
) =>
	useIamRead(
		[...agentKey(u, g, id), "refusals", listQueryKey(query)],
		(un, gs) => iamApi.refusals(un, gs, id as string, query),
		u,
		g,
		!!id,
		true,
	);

export const useIamTokensQuery = (u: Maybe, g: Maybe, query: ListQuery = {}) =>
	useIamRead(
		[...iamKey(u, g), "tokens", listQueryKey(query)],
		(un, gs) => iamApi.tokens(un, gs, query),
		u,
		g,
		true,
		true,
	);

// ── writes ──────────────────────────────────────────────────────────────────

/** A write that, once settled, invalidates the Graph's IAM tree. */
function useIamWrite<V, R>(
	{ username, graphSlug }: Scope,
	write: (v: V) => Promise<R>,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: write,
		onSettled: () =>
			qc.invalidateQueries({ queryKey: iamKey(username, graphSlug) }),
	});
}

/** Create, change, save, draft and delete a policy; attach and detach a holder. */
export function usePolicyMutations(scope: Scope) {
	const { username: u, graphSlug: g } = scope;
	return {
		create: useIamWrite(scope, (data: PolicyCreate) =>
			iamApi.createPolicy(u, g, data),
		),
		update: useIamWrite(
			scope,
			({ name, data }: { name: string; data: PolicyUpdate }) =>
				iamApi.updatePolicy(u, g, name, data),
		),
		save: useIamWrite(
			scope,
			({ name, data }: { name: string; data?: PolicySave }) =>
				iamApi.savePolicy(u, g, name, data),
		),
		draft: useIamWrite(scope, (data: PolicyDraftRequest) =>
			iamApi.draftPolicy(u, g, data),
		),
		remove: useIamWrite(scope, (name: string) =>
			iamApi.removePolicy(u, g, name),
		),
		attach: useIamWrite(
			scope,
			({ name, data }: { name: string; data: AttachRequest }) =>
				iamApi.attach(u, g, name, data),
		),
		detach: useIamWrite(scope, ({ name, id }: { name: string; id: string }) =>
			iamApi.detach(u, g, name, id),
		),
	};
}

/** Who gains and who loses if a policy's statements were saved. */
export function useImpactMutation({ username, graphSlug }: Scope) {
	return useMutation({
		mutationFn: ({ name, data }: { name: string; data: ImpactRequest }) =>
			iamApi.impact(username, graphSlug, name, data),
	});
}

/** Test access — one principal, one act, one resource. */
export function useTestAccessMutation({ username, graphSlug }: Scope) {
	return useMutation({
		mutationFn: (data: AccessCheckRequest) =>
			iamApi.test(username, graphSlug, data),
	});
}

/** Add a service account. Members join through the Graph's `…/members`. */
export function useServiceAccountMutation(scope: Scope) {
	return useIamWrite(scope, (data: ServiceAccountCreate) =>
		iamApi.createServiceAccount(scope.username, scope.graphSlug, data),
	);
}

/** Create, change and delete a group; add and remove a member. */
export function useGroupMutations(scope: Scope) {
	const { username: u, graphSlug: g } = scope;
	return {
		create: useIamWrite(scope, (data: GroupCreate) =>
			iamApi.createGroup(u, g, data),
		),
		update: useIamWrite(
			scope,
			({ name, data }: { name: string; data: GroupUpdate }) =>
				iamApi.updateGroup(u, g, name, data),
		),
		remove: useIamWrite(scope, (name: string) =>
			iamApi.removeGroup(u, g, name),
		),
		addMember: useIamWrite(
			scope,
			({ name, data }: { name: string; data: GroupMemberAdd }) =>
				iamApi.addGroupMember(u, g, name, data),
		),
		removeMember: useIamWrite(
			scope,
			({ name, id }: { name: string; id: string }) =>
				iamApi.removeGroupMember(u, g, name, id),
		),
	};
}

/** Mint and revoke a token. */
export function useTokenMutations(scope: Scope) {
	const { username: u, graphSlug: g } = scope;
	return {
		create: useIamWrite(scope, (data: IamTokenCreate) =>
			iamApi.createToken(u, g, data),
		),
		revoke: useIamWrite(scope, (id: string) => iamApi.revokeToken(u, g, id)),
	};
}
