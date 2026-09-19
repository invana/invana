/**
 * One status vocabulary across Tasks, Agents and steps.
 *
 * The distinction that matters and is easy to lose: **`review` is not done, and
 * `cannot_answer` is not a failure.** A task in review is waiting on a human,
 * which is the governance seam working, not a problem; an outcome the graph
 * cannot support is a legitimate answer (promise #4). Colouring either of them
 * red would make the board lie about what needs attention.
 */

import type { StatusDotProps } from "@invana/ui";

/**
 * The kit's `StatusDot` tone vocabulary, used verbatim.
 *
 * What this file owns is the domain question — *what does `needs_input` mean?*
 * What a tone looks like is the kit's, so a status resolved here goes straight
 * to `StatusDot`, `Badge` or `AppStatusBar` with no second mapping table in
 * between.
 */
export type Tone = NonNullable<StatusDotProps["tone"]>;

const TASK_TONES: Record<string, Tone> = {
	open: "muted",
	assigned: "muted",
	in_progress: "running",
	// Waiting on a person — the board should draw the eye, not the alarm.
	needs_input: "warning",
	blocked: "warning",
	// A result is posted and a human owes an answer. Not done, not wrong.
	review: "info",
	done: "success",
	failed: "error",
	cancelled: "muted",
};

const AGENT_TONES: Record<string, Tone> = {
	active: "success",
	paused: "warning",
	retired: "muted",
};

const STEP_TONES: Record<string, Tone> = {
	queued: "queued",
	running: "running",
	needs_input: "warning",
	succeeded: "success",
	failed: "error",
	stopped: "muted",
};

export const taskTone = (status: string): Tone => TASK_TONES[status] ?? "muted";
export const agentTone = (status: string): Tone =>
	AGENT_TONES[status] ?? "muted";
export const stepTone = (status: string): Tone => STEP_TONES[status] ?? "muted";

/** The words the UI shows. `in_progress` is never printed with an underscore. */
export const humanStatus = (status: string): string =>
	status.replace(/_/g, " ");

/** Verify's verdict, as the badge reads it (docs/for-developers/modules/agents/spec.md). */
export const verdictLabel = (served: string | null | undefined): string =>
	({ yes: "served", partial: "partial", no: "not served" })[served ?? ""] ?? "";

export const verdictTone = (served: string | null | undefined): Tone =>
	(({ yes: "success", partial: "warning", no: "error" })[
		served ?? ""
	] as Tone) ?? "muted";
