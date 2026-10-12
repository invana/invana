/**
 * TanStack Query hooks over the inbox, rules, channels, approvals and the
 * Graph's members. Keys start with the area — `["notifications" | "approvals"
 * | "members", owner, graph]` — so the bell, the Inbox and the tabs share one
 * read and one invalidation each.
 */

import { type GraphRef, useAuth } from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { approvalsApi, membersApi, notificationsApi } from "./api";
import type {
	ChannelWrite,
	NotificationRuleUpdate,
	NotificationRuleWrite,
} from "./types";

const STALE_MS = 15_000;

const notificationKeys = {
	all: (g: GraphRef | undefined) =>
		["notifications", g?.username, g?.graphSlug] as const,
	inbox: (g: GraphRef | undefined) =>
		[...notificationKeys.all(g), "inbox"] as const,
	rules: (g: GraphRef | undefined) =>
		[...notificationKeys.all(g), "rules"] as const,
	channels: (g: GraphRef | undefined) =>
		[...notificationKeys.all(g), "channels"] as const,
	approvals: (g: GraphRef | undefined) =>
		["approvals", g?.username, g?.graphSlug] as const,
	members: (g: GraphRef | undefined) =>
		["members", g?.username, g?.graphSlug] as const,
};

/** My notifications on this Graph, newest first, with the unread count. */
export function useNotificationsQuery(graph: GraphRef | undefined) {
	return useQuery({
		queryKey: notificationKeys.inbox(graph),
		queryFn: () => notificationsApi.inbox(graph as GraphRef),
		enabled: !!graph,
		staleTime: STALE_MS,
		refetchInterval: 60_000,
	});
}

/** Marks these read — or, with no ids, every unread one. */
export function useMarkRead(graph: GraphRef) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (ids?: string[]) => notificationsApi.markRead(graph, ids),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: notificationKeys.inbox(graph) }),
	});
}

export function useRulesQuery(graph: GraphRef | undefined) {
	return useQuery({
		queryKey: notificationKeys.rules(graph),
		queryFn: () => notificationsApi.rules(graph as GraphRef),
		enabled: !!graph,
		staleTime: STALE_MS,
	});
}

function useInvalidateRules(graph: GraphRef) {
	const qc = useQueryClient();
	return () =>
		qc.invalidateQueries({ queryKey: notificationKeys.rules(graph) });
}

export function useCreateRule(graph: GraphRef) {
	const invalidate = useInvalidateRules(graph);
	return useMutation({
		mutationFn: (body: NotificationRuleWrite) =>
			notificationsApi.createRule(graph, body),
		onSuccess: invalidate,
	});
}

export function useUpdateRule(graph: GraphRef) {
	const invalidate = useInvalidateRules(graph);
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: NotificationRuleUpdate }) =>
			notificationsApi.updateRule(graph, id, body),
		onSuccess: invalidate,
	});
}

export function useDeleteRule(graph: GraphRef) {
	const invalidate = useInvalidateRules(graph);
	return useMutation({
		mutationFn: (id: string) => notificationsApi.deleteRule(graph, id),
		onSuccess: invalidate,
	});
}

export function useChannelsQuery(graph: GraphRef | undefined) {
	return useQuery({
		queryKey: notificationKeys.channels(graph),
		queryFn: () => notificationsApi.channels(graph as GraphRef),
		enabled: !!graph,
		staleTime: STALE_MS,
	});
}

export function useCreateChannel(graph: GraphRef) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: ChannelWrite) =>
			notificationsApi.createChannel(graph, body),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: notificationKeys.channels(graph) }),
	});
}

/** Refused (409) while a rule or schedule names the channel. */
export function useDeleteChannel(graph: GraphRef) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => notificationsApi.deleteChannel(graph, id),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: notificationKeys.channels(graph) }),
	});
}

/** Approvals still waiting on the signed-in member. */
export function usePendingApprovalsQuery(graph: GraphRef | undefined) {
	return useQuery({
		queryKey: [
			...notificationKeys.approvals(graph),
			"mine",
			"pending",
		] as const,
		queryFn: () =>
			approvalsApi.list(graph as GraphRef, { mine: true, status: "pending" }),
		enabled: !!graph,
		staleTime: STALE_MS,
		refetchInterval: 60_000,
	});
}

/** Approve or decline; either way the approval leaves the Inbox. */
export function useDecideApproval(graph: GraphRef) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			decision,
			note,
		}: {
			id: string;
			decision: "approve" | "decline";
			note?: string;
		}) =>
			decision === "approve"
				? approvalsApi.approve(graph, id, note)
				: approvalsApi.decline(graph, id, note),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: notificationKeys.approvals(graph),
			});
			void qc.invalidateQueries({ queryKey: notificationKeys.inbox(graph) });
		},
	});
}

export function useMembersQuery(graph: GraphRef | undefined) {
	return useQuery({
		queryKey: notificationKeys.members(graph),
		queryFn: () => membersApi.list(graph as GraphRef),
		enabled: !!graph,
		staleTime: 60_000,
	});
}

/**
 * Names a member id: *you* for the signed-in member, else the member's
 * first name (their username when it is empty), else a short id while the
 * members list loads or for someone no longer on the Graph.
 */
export function useMemberName(graph: GraphRef | undefined) {
	const { user } = useAuth();
	const members = useMembersQuery(graph);
	const items = members.data?.items;
	return useCallback(
		(id: string): string => {
			if (user && String(user.id) === id) return "you";
			const m = items?.find((x) => x.user_id === id);
			if (m) return m.first_name || m.username;
			return `member ${id.slice(0, 8)}`;
		},
		[user, items],
	);
}
