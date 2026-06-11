import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	type SendMessageBody,
	sessionsApi,
} from "../../../../services/api/sessions";
import type { QueryResponse, QueryRunPayload } from "../../../../types/query";
import type { Session } from "../../../../types/session";

function toBody(payload: QueryRunPayload): SendMessageBody {
	if (payload.mode === "ql") {
		return { content: payload.query, mode: "ql", language: payload.language };
	}
	// NL has no backend yet — the engine records the prompt and replies with the
	// "not wired" message; llmProviderId / attachments aren't sent.
	return { content: payload.query, mode: "nl" };
}

/**
 * Server-backed session state (RFC-024). Wraps the sessions API in TanStack
 * Query: a list query drives the panel's list view, a detail query the thread,
 * and `send` / `rerun` mutations run queries through the engine. Exposes the
 * same surface the panel/composer already consume.
 */
export function useSessions(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	const qc = useQueryClient();
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const u = username ?? "";
	const g = graphSlug ?? "";
	const ready = !!username && !!graphSlug;

	const listKey = ["sessions", u, g] as const;
	const detailKey = (id: string) => ["session", u, g, id] as const;

	const sessionsQuery = useQuery({
		queryKey: listKey,
		queryFn: () => sessionsApi.list(u, g),
		enabled: ready,
	});

	const activeSessionQuery = useQuery({
		queryKey: detailKey(activeSessionId ?? ""),
		queryFn: () => sessionsApi.get(u, g, activeSessionId as string),
		enabled: ready && !!activeSessionId,
	});

	const sessions = sessionsQuery.data?.items ?? [];

	// Show the thread shell immediately on open: fall back to the list summary
	// (no messages) while the detail query is still loading.
	const activeSession = useMemo<Session | null>(() => {
		if (!activeSessionId) return null;
		if (activeSessionQuery.data) return activeSessionQuery.data;
		return sessions.find((s) => s.id === activeSessionId) ?? null;
	}, [activeSessionId, activeSessionQuery.data, sessions]);

	const sendMutation = useMutation({
		mutationFn: async (body: SendMessageBody) => {
			// Two-step when no session is open: create an empty session, then send
			// (the message endpoint returns the run result for the canvas).
			let id = activeSessionId;
			if (!id) {
				const created = await sessionsApi.create(u, g);
				id = created.id;
			}
			const resp = await sessionsApi.sendMessage(u, g, id, body);
			return { id, result: resp.result };
		},
		onSuccess: ({ id }) => {
			setActiveSessionId(id);
			qc.invalidateQueries({ queryKey: listKey });
			qc.invalidateQueries({ queryKey: detailKey(id) });
		},
	});

	const rerunMutation = useMutation({
		mutationFn: ({ id, messageId }: { id: string; messageId: string }) =>
			sessionsApi.rerunMessage(u, g, id, messageId),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: detailKey(id) });
			qc.invalidateQueries({ queryKey: listKey });
		},
	});

	const send = async (
		payload: QueryRunPayload,
	): Promise<{ sessionId: string; result: QueryResponse | null }> => {
		const { id, result } = await sendMutation.mutateAsync(toBody(payload));
		return { sessionId: id, result };
	};

	const rerun = async (messageId: string): Promise<QueryResponse | null> => {
		if (!activeSessionId) return null;
		const { result } = await rerunMutation.mutateAsync({
			id: activeSessionId,
			messageId,
		});
		return result;
	};

	// Refetch from the engine — the list always, plus the open thread when one
	// is active. Used by the panel's header refresh control.
	const refresh = () => {
		void sessionsQuery.refetch();
		if (activeSessionId) void activeSessionQuery.refetch();
	};

	return {
		sessions,
		activeSession,
		activeSessionId,
		isRunning: sendMutation.isPending || rerunMutation.isPending,
		isRefreshing:
			sessionsQuery.isFetching ||
			(!!activeSessionId && activeSessionQuery.isFetching),
		send,
		rerun,
		refresh,
		openSession: (id: string) => setActiveSessionId(id),
		backToList: () => setActiveSessionId(null),
	};
}
