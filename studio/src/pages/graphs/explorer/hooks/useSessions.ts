import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
	type SendMessageBody,
	type SessionSort,
	sessionsApi,
} from "../../../../services/api/sessions";
import type { QueryResponse, QueryRunPayload } from "../../../../types/query";
import type { Session, SessionMessage } from "../../../../types/session";

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

	// A run (send or rerun) is in flight. Drives the composer's send↔stop toggle
	// and the disabled state; spans the whole gesture, including the session
	// create that precedes a first send.
	const [running, setRunning] = useState(false);
	// The in-flight run's abort controller, so `stop()` can cancel it. The catch
	// paths key off `signal.aborted` to tell a user stop from a real failure.
	const abortRef = useRef<AbortController | null>(null);

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

	// Seed/append messages onto a session's cached detail. Writing fresh data
	// keeps the just-enabled detail query from refetching over it (data is within
	// staleTime), so the optimistic thread survives until we invalidate on done.
	const patchDetail = (
		id: string,
		fn: (prev: Session | undefined) => Session | undefined,
	) => qc.setQueryData(detailKey(id), fn);

	const send = async (
		payload: QueryRunPayload,
	): Promise<{
		sessionId: string | null;
		messageId: string | null;
		result: QueryResponse | null;
	}> => {
		setRunning(true);
		const controller = new AbortController();
		abortRef.current = controller;

		// Optimistic pair shown the instant the user sends: their prompt + a
		// "running" placeholder. Dropping into the thread immediately (rather than
		// waiting for the round trip) is the whole point — the placeholder also
		// carries the in-thread running animation.
		const now = new Date();
		const userMsg: SessionMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: payload.query,
			createdAt: now,
		};
		const runningMsg: SessionMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "Running query…",
			createdAt: now,
			status: "running",
		};

		let sessionId: string | null = activeSessionId;
		try {
			if (!sessionId) {
				// No open session — create one, then drop into it right away with the
				// optimistic pair already in place (no list→detail wait).
				const created = await sessionsApi.create(u, g);
				sessionId = created.id;
				patchDetail(sessionId, () => ({
					...created,
					messages: [userMsg, runningMsg],
				}));
				setActiveSessionId(sessionId);
			} else {
				patchDetail(sessionId, (prev) =>
					prev
						? {
								...prev,
								messages: [...prev.messages, userMsg, runningMsg],
								updatedAt: now,
							}
						: prev,
				);
			}

			const resp = await sessionsApi.sendMessage(
				u,
				g,
				sessionId,
				toBody(payload),
				controller.signal,
			);
			// Server is now the truth — refetch the canonical thread + list summary,
			// which replaces the optimistic pair with the persisted messages.
			qc.invalidateQueries({ queryKey: listPrefix });
			qc.invalidateQueries({ queryKey: detailKey(sessionId) });
			return {
				sessionId,
				messageId: resp.assistantMessage.id,
				result: resp.result,
			};
		} catch (err) {
			// User stop: leave their prompt, mark the placeholder stopped. Real
			// failure: surface it on the placeholder and rethrow for tracing.
			const stopped = controller.signal.aborted;
			if (sessionId) {
				patchDetail(sessionId, (prev) =>
					prev
						? {
								...prev,
								messages: prev.messages.map((m) =>
									m.id === runningMsg.id
										? {
												...m,
												status: stopped ? "stopped" : "error",
												content: stopped
													? "Query stopped."
													: ((err as Error)?.message ?? "Query failed."),
											}
										: m,
								),
							}
						: prev,
				);
			}
			if (stopped) return { sessionId, messageId: null, result: null };
			throw err;
		} finally {
			abortRef.current = null;
			setRunning(false);
		}
	};

	const rerun = async (messageId: string): Promise<QueryResponse | null> => {
		if (!activeSessionId) return null;
		const id = activeSessionId;
		setRunning(true);
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			const { result } = await sessionsApi.rerunMessage(
				u,
				g,
				id,
				messageId,
				controller.signal,
			);
			qc.invalidateQueries({ queryKey: detailKey(id) });
			qc.invalidateQueries({ queryKey: listPrefix });
			return result;
		} catch (err) {
			if (controller.signal.aborted) return null;
			throw err;
		} finally {
			abortRef.current = null;
			setRunning(false);
		}
	};

	// Cancel the in-flight run (the composer's stop control). The send/rerun
	// catch paths handle the resulting abort.
	const stop = () => abortRef.current?.abort();

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
		isRunning: running,
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
		stop,
		refresh,
		setPinned,
		setArchived,
		openSession: (id: string) => setActiveSessionId(id),
		backToList: () => setActiveSessionId(null),
	};
}
