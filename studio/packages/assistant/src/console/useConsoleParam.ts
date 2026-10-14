/**
 * Whether the console is open, and on which tab — `?console=`.
 *
 * A third region, a third param: it moves independently of the left panel's
 * path and of `?right=`, so opening the console never costs either of them.
 * The value is the open tab (`records · query · log`); absent is collapsed,
 * which is what lets "collapsed" survive a reload, a panel switch and a new
 * canvas tab without a second piece of state. A stale or hand-typed value
 * reads as collapsed.
 */

import { type Session, useUpdateSearchParams } from "@invana-studio/core";
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CONSOLE_TABS, type ConsoleTab } from "./consoleRecords";

const CONSOLE_PARAM = "console";

export interface ConsoleParam {
	/** The open tab, or null while collapsed. */
	tab: ConsoleTab | null;
	open: (tab: ConsoleTab) => void;
	collapse: () => void;
	/** Open it on Records, or collapse it if it is open. */
	toggle: () => void;
}

export function useConsoleParam(): ConsoleParam {
	const [params] = useSearchParams();
	const update = useUpdateSearchParams();
	const raw = params.get(CONSOLE_PARAM);
	const tab = CONSOLE_TABS.includes(raw as ConsoleTab)
		? (raw as ConsoleTab)
		: null;

	// Through the composing writer: Log opens a beat after the assistant docks,
	// and must not drop its `?right=`.
	const write = useCallback(
		(next: ConsoleTab | null) =>
			update((prev) => {
				if (next === null) prev.delete(CONSOLE_PARAM);
				else prev.set(CONSOLE_PARAM, next);
				return prev;
			}),
		[update],
	);

	return {
		tab,
		open: write,
		collapse: useCallback(() => write(null), [write]),
		toggle: useCallback(
			() => write(tab === null ? "records" : null),
			[tab, write],
		),
	};
}

/** Wall-clock slack between the engine's timestamps and this browser's. */
const CLOCK_SLACK_MS = 60_000;

/**
 * Open the console on Log when a reply in the open thread fails **while the
 * page watches** — a reply that turns to `error`, or arrives already failed
 * after the thread was opened. Reopening an old thread with a failure in it
 * never moves the console: that failure is history, read in the thread.
 */
export function useOpenLogOnFailure(
	session: Session | null,
	openLog: () => void,
) {
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
		let failed = false;
		for (const m of session.messages) {
			if (m.role !== "assistant") continue;
			statuses.set(m.id, m.status);
			// A refusal is drawn as its own card in the thread; nothing ran.
			if (m.status !== "error" || m.refusal) continue;
			const before = prev.statuses.get(m.id);
			const turned = !fresh && prev.statuses.has(m.id) && before !== "error";
			const arrived =
				!prev.statuses.has(m.id) &&
				m.createdAt.getTime() >= openedAt - CLOCK_SLACK_MS;
			if (turned || arrived) failed = true;
		}
		seen.current = { sessionId: session.id, openedAt, statuses };
		if (failed) openLog();
	}, [session, openLog]);
}
