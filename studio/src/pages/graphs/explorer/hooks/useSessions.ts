import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	type SendMessageBody,
	type SessionSort,
	sessionsApi,
} from "../../../../services/api/sessions";
import type { QueryResponse, QueryRunPayload } from "../../../../types/query";
import type { Session } from "../../../../types/session";

function toBody(payload: QueryRunPayload): SendMessageBody {
	if (payload.mode === "ql") {
		return { content: payload.query, mode: "ql", language: payload.language };
	}
	// NL → the engine translates the prompt into a grounded query with the
	// chosen provider (RFC-030). Attachments aren't sent yet.
	return {
		content: payload.query,
		mode: "nl",
		llm_provider_id: payload.llmProviderId,
	};
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
	// List controls that drive the server query (so paging/totals stay correct).
	const [sort, setSort] = useState<SessionSort>("updated");
	const [showArchived, setShowArchived] = useState(false);
	const u = username ?? "";
	const g = graphSlug ?? "";
	const ready = !!username && !!graphSlug;

	// sort + showArchived are part of the key so the list refetches when toggled.
	const listKey = ["sessions", u, g, sort, showArchived] as const;
	// Prefix that matches every sort/archived variant — used for invalidation so
	// a pin/archive/send touches all cached lists, not just the active one.
	const listPrefix = ["sessions", u, g] as const;
	const detailKey = (id: string) => ["session", u, g, id] as const;

	const sessionsQuery = useQuery({
		queryKey: listKey,
		queryFn: () =>
			sessionsApi.list(u, g, { sort, includeArchived: showArchived }),
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
			return { id, messageId: resp.assistantMessage.id, result: resp.result };
		},
		onSuccess: ({ id }) => {
			setActiveSessionId(id);
			qc.invalidateQueries({ queryKey: listPrefix });
			qc.invalidateQueries({ queryKey: detailKey(id) });
		},
	});

	const rerunMutation = useMutation({
		mutationFn: ({ id, messageId }: { id: string; messageId: string }) =>
			sessionsApi.rerunMessage(u, g, id, messageId),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: detailKey(id) });
			qc.invalidateQueries({ queryKey: listPrefix });
		},
	});

	// Pin/archive toggles — PATCH the flag, then refresh the list so ordering
	// (pinned-first) and archived visibility re-sort. Archiving the open session
	// drops back to the list, since it's no longer shown by default.
	const updateMutation = useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: { pinned?: boolean; archived?: boolean };
		}) => sessionsApi.update(u, g, id, body),
		onSuccess: (_data, { id, body }) => {
			qc.invalidateQueries({ queryKey: listPrefix });
			if (body.archived && !showArchived && activeSessionId === id) {
				setActiveSessionId(null);
			}
		},
	});

	const send = async (
		payload: QueryRunPayload,
	): Promise<{
		sessionId: string;
		messageId: string;
		result: QueryResponse | null;
	}> => {
		const { id, messageId, result } = await sendMutation.mutateAsync(
			toBody(payload),
		);
		return { sessionId: id, messageId, result };
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

	const setPinned = (id: string, pinned: boolean) =>
		updateMutation.mutate({ id, body: { pinned } });
	const setArchived = (id: string, archived: boolean) =>
		updateMutation.mutate({ id, body: { archived } });

	return {
		sessions,
		activeSession,
		activeSessionId,
		isRunning: sendMutation.isPending || rerunMutation.isPending,
		isRefreshing:
			sessionsQuery.isFetching ||
			(!!activeSessionId && activeSessionQuery.isFetching),
		// List controls (drive the server query).
		sort,
		setSort,
		showArchived,
		setShowArchived,
		send,
		rerun,
		refresh,
		setPinned,
		setArchived,
		openSession: (id: string) => setActiveSessionId(id),
		backToList: () => setActiveSessionId(null),
	};
}
