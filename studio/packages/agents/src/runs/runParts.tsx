/**
 * What the runs list and the run page say the same way: a run's number, its
 * status in words, the tone of that word, and its size.
 *
 * A run's status is its exit reason once it has ended — the reason the engine
 * recorded when the run settled — `running` while it runs and `waiting` while
 * it is held on a person. Nothing here derives a number; it formats the
 * engine's.
 */

import type { StatusDotProps } from "@invana/ui";
import { runLabel } from "../agents/agentParts";

type DotTone = NonNullable<StatusDotProps["tone"]>;

const LIVE = new Set(["queued", "running"]);
const WAITING = new Set(["awaiting_input", "awaiting_approval", "needs_input"]);

/** `#2291` — the run's number in its Graph; the id's head before it has one. */
export const runNumber = (id: string, number: number | null | undefined) =>
	number != null ? `#${number}` : runLabel(id);

/** `served` · `budget declined` · `running` · `waiting`. */
export function statusWord(
	status: string,
	exitReason: string | null | undefined,
): string {
	if (exitReason) return exitReason.replaceAll("_", " ");
	if (status === "queued") return "queued";
	if (LIVE.has(status)) return "running";
	if (WAITING.has(status)) return "waiting";
	return status.replaceAll("_", " ");
}

/** Served is good, a failure is bad, a run held on a person warns. */
export function statusTone(
	status: string,
	exitReason: string | null | undefined,
): DotTone {
	if (exitReason === "served") return "success";
	if (exitReason === "failed" || status === "failed") return "error";
	if (exitReason) return "muted";
	if (status === "queued") return "queued";
	if (LIVE.has(status)) return "running";
	if (WAITING.has(status)) return "warning";
	if (status === "succeeded") return "success";
	return "muted";
}

/** `1 agent` · `700 agents`. */
export const agentsWord = (n: number) => `${n} agent${n === 1 ? "" : "s"}`;

/** `09:41` — a minute on a run's clock, in the reader's zone. */
export const clock = (iso: string | null | undefined) =>
	iso
		? new Date(iso).toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			})
		: "—";
