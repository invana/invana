/**
 * The Inbox before the engine records notifications: what the runs journal
 * already says needs a person.
 *
 * Two kinds of row, read off one list of the Graph's runs:
 *
 * | Row | Which runs | Next step |
 * |---|---|---|
 * | waiting | `awaiting_input` — a run stopped on someone's answer, at any age | Answer |
 * | failed | `failed` and finished within the last 7 days | Open run |
 *
 * Newest first. There is no read state, so nothing here is *unread* — the
 * count is the number of rows. When notifications land, this module is what
 * they replace.
 */
import type { ProductId, TaskRunSummary } from "@invana-studio/core";

/** How far back a failure still needs someone. */
export const FAILED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface InboxItem {
	run: TaskRunSummary;
	reason: "waiting" | "failed";
	/** When it came to need someone — the run's finish, else its start. */
	at: number;
	/** The product the run came from, named on the row. */
	product: ProductId;
}

/**
 * Which product a run came from: a load is Datasets', a Todo's run Projects',
 * a stitch Modeller's. A typed query (`ql`) is the person's even when an agent
 * carried it, so it is Explorer's; any other run an agent performed is the
 * agent's. What is left — an unagented `nl` ask, a canvas act, a run that
 * predates the column — is Explorer's.
 */
export function productOfRun(run: TaskRunSummary): ProductId {
	if (run.kind === "import" || run.kind === "bulk") return "datasets";
	if (run.task_id) return "projects";
	if (run.kind === "stitch") return "modeller";
	if (run.kind === "ql") return "explorer";
	if (run.agent_id) return "agents";
	return "explorer";
}

function timeOf(run: TaskRunSummary): number {
	const iso = run.finished_at ?? run.started_at ?? run.queued_at;
	return iso ? new Date(iso).getTime() : 0;
}

export function inboxOf(
	runs: readonly TaskRunSummary[],
	now: number,
): InboxItem[] {
	const items: InboxItem[] = [];
	for (const run of runs) {
		const at = timeOf(run);
		if (run.status === "awaiting_input") {
			items.push({ run, reason: "waiting", at, product: productOfRun(run) });
		} else if (run.status === "failed" && now - at <= FAILED_WINDOW_MS) {
			items.push({ run, reason: "failed", at, product: productOfRun(run) });
		}
	}
	return items.sort((a, b) => b.at - a.at);
}

/** A run's name on a row: what the opener wrote, else its Todo, else its plan. */
export function runTitle(run: TaskRunSummary): string {
	return run.body ?? run.task_title ?? run.workflow_key;
}
