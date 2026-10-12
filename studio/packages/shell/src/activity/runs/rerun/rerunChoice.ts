/**
 * Whether a run can be re-run, and on which versions — decided before the
 * click, from what the run recorded.
 *
 * The engine takes a re-run of a **settled root ask** only: an `nl` or `ql`
 * run with no parent that is no longer queued, running or waiting. A step, an
 * import or a live run offers no *Re-run…*, because the request would be
 * refused and a button that only ever refuses is noise.
 *
 * *The same versions* replays the model version the run recorded. An `nl` run
 * that recorded none cannot be reproduced, so the choice is drawn disabled and
 * says why — the refusal the engine would give, said before the click. A `ql`
 * run calls no model, so it always reproduces.
 */

import type { RerunVersions } from "@invana-studio/core";
import { isLive } from "../boards/runBoards";

/** The asks a re-run takes. */
const RERUNNABLE_ASKS: ReadonlySet<string> = new Set(["nl", "ql"]);

/** Why *The same versions* is not offered on a run that predates the record. */
const SAME_UNRECORDED_REASON = "This run predates recorded model versions";

export interface RerunSubject {
	/** The trace's status. */
	status: string;
	/** The ask the root carries — `nl` · `ql` · `import`; absent on a step. */
	askKind?: string | null;
	/** The run this one is a step of; absent on a root. */
	parentRunId?: string | null;
}

/** True when the run page offers *Re-run…* for this run. */
export function isRerunnable(run: RerunSubject): boolean {
	return (
		!run.parentRunId &&
		Boolean(run.askKind && RERUNNABLE_ASKS.has(run.askKind)) &&
		!isLive(run.status)
	);
}

export interface RerunChoices {
	/** Why *The same versions* is disabled, or `null` when it is offered. */
	sameDisabled: string | null;
	/** The choice the dialog opens on. */
	initial: RerunVersions;
}

/** The dialog's two choices, for a run of this kind that recorded this model. */
export function rerunChoices(
	askKind: string | null | undefined,
	modelVersion: string | null | undefined,
): RerunChoices {
	const sameDisabled =
		askKind === "nl" && !modelVersion ? SAME_UNRECORDED_REASON : null;
	return { sameDisabled, initial: sameDisabled ? "current" : "same" };
}
