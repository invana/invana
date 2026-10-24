/**
 * What the rule board borrows from Skills: its action ids and two wording
 * helpers. Nothing here fetches and nothing here renders — a composer is a
 * pure function of one read.
 */

import type { Rule } from "@invana-studio/core";
import { formatRelativeTime } from "@invana-studio/core";

/** Action ids a board answers. The spec carries the string; the page carries the behaviour. */
export const SKILL_ACTIONS = {
	/** `Board ¦ spec.json`. */
	view: "view",
	/** `Edit` — puts the section back on this record, drilled in. */
	edit: "edit",
	/** A step or citation row — opens the run it came from. */
	openRun: "open-run",
} as const;

/** A rule is its statement, so the crumb is the statement — shortened, never reworded. */
export function ruleTitle(rule: Rule): string {
	const statement = rule.statement.trim();
	return statement.length > 60 ? `${statement.slice(0, 59)}…` : statement;
}

/** `2m ago`, or nothing at all — an absent instant is absent, not `never`. */
export function when(at: string | null | undefined): string {
	return at ? formatRelativeTime(new Date(at)) : "—";
}
