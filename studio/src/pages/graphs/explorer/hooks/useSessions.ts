import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type RecordOperationBody,
	type SendMessageBody,
	type SessionSort,
	sessionsApi,
} from "../../../../services/api/sessions";
import {
	type ThinkingStreamHandle,
	messageFromEmission,
	thinkingsApi,
} from "../../../../services/api/thinkings";
import { useAuthStore } from "../../../../stores/auth.store";
import { useThinkingStore } from "../../../../stores/thinking.store";
import type { QueryResponse, QueryRunPayload } from "../../../../types/query";
import type { Session, SessionMessage } from "../../../../types/session";
import {
	type Emission,
	LIVE_THINKING_STATUSES,
} from "../../../../types/thinking";

// A session's title is seeded from its first message so it's never blank —
// mirrors the engine's `_title_from_text` (64-char cap + ellipsis). Set at
// create time (not on send completion) so it survives a navigate-away/abort
// before the query finishes. The engine still fills it in as a fallback.
function titleFromMessage(text: string): string {
	const clean = text.split(/\s+/).filter(Boolean).join(" ");
	if (!clean) return "New session";
	return clean.length > 64 ? `${clean.slice(0, 64)}…` : clean;
}

function toBody(payload: QueryRunPayload): SendMessageBody {
	if (payload.mode === "ql") {
		return {
			content: payload.query,
			mode: "ql",
			language: payload.language,
			timeout_s: payload.timeoutS,
		};
	}
	// NL → the engine translates the prompt into a grounded query with the
	// chosen provider (RFC-030). Attachments aren't sent yet.
	return {
		content: payload.query,
		mode: "nl",
		llm_provider_id: payload.llmProviderId,
		timeout_s: payload.timeoutS,
	};
}

export interface UseSessionsOptions {
	surface?: "explorer" | "modeller";
	modelId?: string;
	/** A query result landed on a thinking's stream (RFC-055) — the page paints
	 *  it. Fires once per result, before the reply settles. */
	onResult?: (info: {
		sessionId: string;
		messageId: string;
		thinkingId: string;
		result: QueryResponse;
	}) => void;
	/** A thinking reached a terminal state (done / cancelled / needs input). */
	onThinkingSettled?: (info: {
		sessionId: string;
		messageId: string;
		thinkingId: string;
		status: string;
	}) => void;
}

/**
 * Server-backed session state (RFC-024) on the thinking runtime (RFC-055).
 * Wraps the sessions API in TanStack Query: a list query drives the panel's
 * list view, a detail query the thread. Sending returns as soon as the engine
 * has recorded the ask (202) and opened a thinking; this hook then tails the
 * thinking's SSE stream into the thinking store, so the reply's step rows move
 * live, and refetches the thread when the run settles.
 */
export function useSessions(
	username: string | undefined,
	graphSlug: string | undefined,
	opts?: UseSessionsOptions,
) {
	const qc = useQueryClient();
	// Default to the Explorer surface so existing callers are untouched (RFC-031).
	const surface = opts?.surface ?? "explorer";
	const modelId = opts?.modelId;
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	// List controls that drive the server query (so paging/totals stay correct).
	const [sort, setSort] = useState<SessionSort>("updated");
	const [showArchived, setShowArchived] = useState(false);
	const u = username ?? "";
	const g = graphSlug ?? "";
	const ready = !!username && !!graphSlug;
	const accessToken = useAuthStore((s) => s.accessToken);

	// surface scopes the list so Explorer and Modeller panels never show each
	// other's sessions; sort + showArchived refetch the list when toggled.
	const listKey = ["sessions", u, g, surface, sort, showArchived] as const;
	// Prefix that matches every sort/archived variant for this surface — used for
	// invalidation so a pin/archive/send touches all cached lists for the surface.
	const listPrefix = ["sessions", u, g, surface] as const;
	const detailKey = useCallback(
		(id: string) => ["session", u, g, id] as const,
		[u, g],
	);

	const sessionsQuery = useQuery({
		queryKey: listKey,
		queryFn: () =>
			sessionsApi.list(u, g, { sort, includeArchived: showArchived, surface }),
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

	// The POST that records an ask is in flight — the composer is locked for it.
	const [sending, setSending] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	// ── Thinking streams ──────────────────────────────────────────────────────
	// One EventSource per live thinking, keyed by thinking id. Opened on send /
	// rerun and for any running reply the thread loads (reload mid-run, UC12);
	// closed on a terminal frame. Emissions fold into the thinking store.
	const streams = useRef<Map<string, ThinkingStreamHandle>>(new Map());
	const seed = useThinkingStore((s) => s.seed);
	const applyEmission = useThinkingStore((s) => s.apply);
	const views = useThinkingStore((s) => s.views);
	// Latest callbacks, readable from stream handlers wired once.
	const optsRef = useRef(opts);
	optsRef.current = opts;

	// Seed/append messages onto a session's cached detail. Writing fresh data
	// keeps the just-enabled detail query from refetching over it (data is within
	// staleTime), so the optimistic thread survives until we invalidate on done.
	const patchDetail = useCallback(
		(id: string, fn: (prev: Session | undefined) => Session | undefined) =>
			qc.setQueryData(detailKey(id), fn),
		[qc, detailKey],
	);

	const openStream = useCallback(
		(thinkingId: string, sessionId: string, messageId: string) => {
			if (!accessToken || streams.current.has(thinkingId)) return;
			seed({ id: thinkingId, sessionId, messageId });
			const after = useThinkingStore.getState().views[thinkingId]?.seq ?? 0;
			const settle = (status: string) => {
				streams.current.delete(thinkingId);
				qc.invalidateQueries({ queryKey: detailKey(sessionId) });
				qc.invalidateQueries({ queryKey: listPrefix });
				optsRef.current?.onThinkingSettled?.({
					sessionId,
					messageId,
					thinkingId,
					status,
				});
			};
			const handle = thinkingsApi.stream(u, g, thinkingId, {
				token: accessToken,
				after,
				onEmission: (e: Emission) => {
					applyEmission(thinkingId, e);
					if (e.kind === "result") {
						optsRef.current?.onResult?.({
							sessionId,
							messageId,
							thinkingId,
							result: e.payload.result as QueryResponse,
						});
					}
					if (
						e.kind === "thinking.done" ||
						e.kind === "thinking.cancelled" ||
						e.kind === "clarification.requested"
					) {
						// The terminal frame carries the settled reply — patch it in so
						// the thread updates before the refetch lands.
						const m = messageFromEmission(
							e.payload.message as Record<string, unknown> | undefined,
						);
						if (m) {
							patchDetail(sessionId, (prev) =>
								prev
									? {
											...prev,
											messages: prev.messages.map((x) =>
												x.id === m.id ? { ...x, ...m, steps: x.steps } : x,
											),
										}
									: prev,
							);
						}
						settle(String(e.payload.status ?? e.kind));
					}
				},
				onError: () => settle("disconnected"),
			});
			streams.current.set(thinkingId, handle);
		},
		[
			accessToken,
			u,
			g,
			qc,
			detailKey,
			listPrefix,
			seed,
			applyEmission,
			patchDetail,
		],
	);

	// Replies still running when a thread loads (reload mid-run) get a tail.
	useEffect(() => {
		if (!activeSession) return;
		for (const m of activeSession.messages) {
			if (m.role === "assistant" && m.status === "running" && m.thinkingId) {
				openStream(m.thinkingId, activeSession.id, m.id);
			}
		}
	}, [activeSession, openStream]);

	// Close every tail on unmount.
	useEffect(
		() => () => {
			for (const h of streams.current.values()) h.close();
			streams.current.clear();
		},
		[],
	);

	// A run is live on the open session (its thinking is queued or thinking).
	// Drives the composer's send↔stop toggle and the disabled state.
	const liveThinking = useMemo(() => {
		if (!activeSessionId) return null;
		return (
			Object.values(views).find(
				(v) =>
					v.sessionId === activeSessionId &&
					LIVE_THINKING_STATUSES.has(v.status),
			) ?? null
		);
	}, [views, activeSessionId]);
	const running = sending || liveThinking !== null;

	// Pin/archive toggles — PATCH the flag, then refresh the list so ordering
	// (pinned-first) and archived visibility re-sort. Archiving the open session
	// drops back to the list, since it's no longer shown by default.
	const updateMutation = useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: { pinned?: boolean; archived?: boolean; title?: string };
		}) => sessionsApi.update(u, g, id, body),
		onSuccess: (_data, { id, body }) => {
			qc.invalidateQueries({ queryKey: listPrefix });
			// A rename also changes the open thread's title (the breadcrumb + the
			// canvas tab both read it), so refresh the detail too.
			if (body.title !== undefined) {
				qc.invalidateQueries({ queryKey: detailKey(id) });
			}
			if (body.archived && !showArchived && activeSessionId === id) {
				setActiveSessionId(null);
			}
		},
	});

	const send = async (
		payload: QueryRunPayload,
		hooks?: {
			// Fired the instant a brand-new session is created (before the query
			// returns), so the caller can spin up its canvas right away rather than
			// waiting for the first result. Not called when reusing an open session.
			onSessionCreated?: (session: Session) => void;
		},
	): Promise<{
		sessionId: string | null;
		messageId: string | null;
		thinkingId: string | null;
	}> => {
		setSending(true);
		const controller = new AbortController();
		abortRef.current = controller;

		// Optimistic pair shown the instant the user sends: their prompt + a
		// "running" placeholder. The engine's 202 replaces them with the real rows
		// (ids, thinking id, queued steps) a round trip later.
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
			content: surface === "modeller" ? "Generating model…" : "Running query…",
			createdAt: now,
			status: "running",
		};

		let sessionId: string | null = activeSessionId;
		try {
			if (!sessionId) {
				// No open session — create one, then drop into it right away with the
				// optimistic pair already in place (no list→detail wait). A modeller
				// session carries its surface + (optional) model binding (RFC-031).
				const created = await sessionsApi.create(u, g, {
					surface,
					model_id: modelId,
					title: titleFromMessage(payload.query),
				});
				sessionId = created.id;
				patchDetail(sessionId, () => ({
					...created,
					messages: [userMsg, runningMsg],
				}));
				setActiveSessionId(sessionId);
				hooks?.onSessionCreated?.(created);
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
			const sid = sessionId;
			// Swap the optimistic pair for the recorded rows — the reply now carries
			// its thinking id and the queued plan (UC1).
			patchDetail(sid, (prev) =>
				prev
					? {
							...prev,
							messages: prev.messages.map((m) =>
								m.id === userMsg.id
									? resp.userMessage
									: m.id === runningMsg.id
										? resp.assistantMessage
										: m,
							),
						}
					: prev,
			);
			qc.invalidateQueries({ queryKey: listPrefix });
			if (resp.thinkingId) {
				openStream(resp.thinkingId, sid, resp.assistantMessage.id);
			}
			return {
				sessionId,
				messageId: resp.assistantMessage.id,
				thinkingId: resp.thinkingId,
			};
		} catch (err) {
			// The POST itself failed (or was aborted before it returned): mark the
			// placeholder so the thread doesn't sit on "running" forever.
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
													? "Stopped by you."
													: ((err as Error)?.message ?? "Query failed."),
											}
										: m,
								),
							}
						: prev,
				);
			}
			if (stopped) return { sessionId, messageId: null, thinkingId: null };
			throw err;
		} finally {
			abortRef.current = null;
			setSending(false);
		}
	};

	// Re-run a reply's query: a new thinking on the same thought (RFC-048
	// rethink). The reply's step list is replaced by the new run's; the result
	// arrives on `onResult` like a first run.
	const rerun = async (messageId: string): Promise<string | null> => {
		if (!activeSessionId) return null;
		const id = activeSessionId;
		setSending(true);
		try {
			const { message, thinkingId } = await sessionsApi.rerunMessage(
				u,
				g,
				id,
				messageId,
			);
			patchDetail(id, (prev) =>
				prev
					? {
							...prev,
							messages: prev.messages.map((m) =>
								m.id === message.id ? { ...m, ...message } : m,
							),
						}
					: prev,
			);
			if (thinkingId) openStream(thinkingId, id, messageId);
			return thinkingId;
		} finally {
			setSending(false);
		}
	};

	// Log an explicit "Load to canvas" as an operation turn (RFC-046), then
	// refetch the thread + list so it shows. No-op without an active session.
	const recordLoad = async (body: RecordOperationBody) => {
		if (!activeSessionId) return;
		const id = activeSessionId;
		try {
			await sessionsApi.recordOperation(u, g, id, body);
		} finally {
			qc.invalidateQueries({ queryKey: detailKey(id) });
			qc.invalidateQueries({ queryKey: listPrefix });
		}
	};

	// The conversation context (prior turns) the model was given for an assistant
	// reply (RFC-036/040) — recomputed server-side, fetched lazily on disclosure.
	const fetchContext = (messageId: string) =>
		sessionsApi.getMessageContext(u, g, activeSessionId ?? "", messageId);

	// Record a 👍/👎 vote on a reply (RFC-038/039). Optimistic so the thumb
	// highlights instantly; revert by refetch on failure.
	const setFeedback = async (
		messageId: string,
		value: "up" | "down" | null,
	) => {
		if (!activeSessionId) return;
		const id = activeSessionId;
		patchDetail(id, (prev) =>
			prev
				? {
						...prev,
						messages: prev.messages.map((m) =>
							m.id === messageId ? { ...m, feedback: value ?? undefined } : m,
						),
					}
				: prev,
		);
		try {
			await sessionsApi.setFeedback(u, g, id, messageId, value);
		} catch {
			qc.invalidateQueries({ queryKey: detailKey(id) });
		}
	};

	// Stop thinking (UC9): cancel the live thinking on the engine; the stream's
	// `thinking.cancelled` frame settles the reply. A POST still in flight is
	// aborted too.
	const stop = () => {
		abortRef.current?.abort();
		if (liveThinking) void thinkingsApi.cancel(u, g, liveThinking.id);
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
	// Rename a session — its title is the single name for the session and its 1:1
	// canvas (RFC-045), shown in the breadcrumb and the canvas tab.
	const renameSession = (id: string, title: string) =>
		updateMutation.mutateAsync({ id, body: { title } });

	return {
		sessions,
		activeSession,
		activeSessionId,
		isRunning: running,
		/** The thinking currently running on the open session, if any. */
		liveThinking,
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
		recordLoad,
		fetchContext,
		setFeedback,
		stop,
		refresh,
		setPinned,
		setArchived,
		renameSession,
		openSession: (id: string) => setActiveSessionId(id),
		backToList: () => setActiveSessionId(null),
	};
}
