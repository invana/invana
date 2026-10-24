/**
 * Whether the console is open, on which tab, and where in it — `?console=`.
 *
 * A third region, a third param: it moves independently of the left panel's
 * path and of `?right=`, so opening the console never costs either of them.
 * Absent is collapsed, which is what lets "collapsed" survive a reload, a
 * panel switch and a new canvas tab without a second piece of state. Where
 * the reader is rides in the same value, so a reload lands on the same label,
 * page or query, and the param never collides with the Workbook's `?page=`:
 *
 * | Value | Open on |
 * |---|---|
 * | `data` | Data, the first label |
 * | `data:node:airport:2` | Data, that label's second page |
 * | `queries` | Queries, the list |
 * | `queries:<message id>` | Queries, that query's step |
 *
 * A stale or hand-typed value reads as collapsed.
 */

import { type Session, useUpdateSearchParams } from "@invana-studio/core";
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
	CONSOLE_TABS,
	type ConsoleTab,
	type LabelKind,
	queryStepsOf,
} from "./consoleRecords";

const CONSOLE_PARAM = "console";

export interface DataPlace {
	kind: LabelKind;
	label: string;
	page: number;
}

export interface ConsoleParam {
	/** The open tab, or null while collapsed. */
	tab: ConsoleTab | null;
	/** Data's label and page, when one is named. */
	data: DataPlace | null;
	/** The query open in Queries — its reply's id. */
	query: string | null;
	openData: (place?: DataPlace) => void;
	openQueries: (messageId?: string | null) => void;
	collapse: () => void;
	/** The footer's counts: open on this tab, or collapse it when it is the open one. */
	toggle: (tab: ConsoleTab) => void;
}

interface Parsed {
	tab: ConsoleTab | null;
	data: DataPlace | null;
	query: string | null;
}

function parseConsole(raw: string | null): Parsed {
	const none = { tab: null, data: null, query: null };
	if (!raw) return none;
	const [head, ...rest] = raw.split(":");
	if (!CONSOLE_TABS.includes(head as ConsoleTab)) return none;
	if (head === "queries")
		return { tab: "queries", data: null, query: rest.join(":") || null };
	const [kind, ...tail] = rest;
	if (kind !== "node" && kind !== "relationship")
		return { tab: "data", data: null, query: null };
	const page = Number(tail.at(-1));
	const paged = Number.isInteger(page) && page > 0 && tail.length > 1;
	const label = (paged ? tail.slice(0, -1) : tail).join(":");
	return {
		tab: "data",
		data: label ? { kind, label, page: paged ? page : 1 } : null,
		query: null,
	};
}

export function useConsoleParam(): ConsoleParam {
	const [params] = useSearchParams();
	const update = useUpdateSearchParams();
	const { tab, data, query } = parseConsole(params.get(CONSOLE_PARAM));

	// Through the composing writer: the console opens a beat after the
	// assistant docks, and must not drop its `?right=`.
	const write = useCallback(
		(next: string | null) =>
			update((prev) => {
				if (next === null) prev.delete(CONSOLE_PARAM);
				else prev.set(CONSOLE_PARAM, next);
				return prev;
			}),
		[update],
	);

	return {
		tab,
		data,
		query,
		openData: useCallback(
			(place?: DataPlace) =>
				write(
					place ? `data:${place.kind}:${place.label}:${place.page}` : "data",
				),
			[write],
		),
		openQueries: useCallback(
			(messageId?: string | null) =>
				write(messageId ? `queries:${messageId}` : "queries"),
			[write],
		),
		collapse: useCallback(() => write(null), [write]),
		toggle: useCallback(
			(next: ConsoleTab) => write(tab === next ? null : next),
			[tab, write],
		),
	};
}

/** Wall-clock slack between the engine's timestamps and this browser's. */
const CLOCK_SLACK_MS = 60_000;

/**
 * Open the console when a reply in the open thread settles **while the page
 * watches** — a reply that turns, or arrives already settled, after the thread
 * was opened:
 *
 * | Reply | Console opens on |
 * |---|---|
 * | failed | Queries, at that query's step — its Log is where the failing line is |
 * | a query (`ql`) that answered | Data — the rows it drew |
 *
 * An ask in words stays in the chat; its records are one click away on the
 * reply. Reopening an old thread never moves the console: what it holds is
 * history, read in the thread.
 */
export function useOpenConsoleOnSettle(
	session: Session | null,
	console_: Pick<ConsoleParam, "openData" | "openQueries">,
) {
	const { openData, openQueries } = console_;
	const seen = useRef<{
		sessionId: string | null;
		openedAt: number;
		statuses: Map<string, string | undefined>;
	}>({ sessionId: null, openedAt: 0, statuses: new Map() });

	useEffect(() => {
		if (!session) {
			seen.current = { sessionId: null, openedAt: 0, statuses: new Map() };
			return;
		}
		const prev = seen.current;
		const fresh = prev.sessionId !== session.id;
		const openedAt = fresh ? Date.now() : prev.openedAt;
		const statuses = new Map<string, string | undefined>();
		let failed: string | null = null;
		let answered = false;
		for (const m of session.messages) {
			if (m.role !== "assistant") continue;
			statuses.set(m.id, m.status);
			// A refusal is drawn as its own card in the thread; nothing ran.
			// A canvas operation is the board's own act, not an answer.
			if (m.refusal || m.operation) continue;
			const settledAs =
				m.status === "error"
					? "failed"
					: m.mode === "ql" && m.status === "ok"
						? "answered"
						: null;
			if (!settledAs) continue;
			const before = prev.statuses.get(m.id);
			const turned = !fresh && prev.statuses.has(m.id) && before !== m.status;
			const arrived =
				!prev.statuses.has(m.id) &&
				m.createdAt.getTime() >= openedAt - CLOCK_SLACK_MS;
			if (!(turned || arrived)) continue;
			if (settledAs === "failed") failed = m.id;
			else answered = true;
		}
		seen.current = { sessionId: session.id, openedAt, statuses };
		// A failure wins: it is the one the reader has to read.
		if (failed && queryStepsOf(session).some((q) => q.messageId === failed))
			openQueries(failed);
		else if (failed) openQueries();
		else if (answered) openData();
	}, [session, openData, openQueries]);
}
