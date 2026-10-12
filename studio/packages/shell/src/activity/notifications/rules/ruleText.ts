/**
 * How a notification rule reads in a row, and which events a rule may listen
 * for.
 *
 * A row says *when* the rule fires — its event patterns and the details they
 * must match (`has status failed`), or *any product* when nothing narrows them
 * — and *who hears*: members by name, holders of a Graph role in the plural
 * (*owners*), and *whoever the run was for*.
 *
 * The events offered to a rule are the events catalogue less what a delivery
 * itself writes — rules, channels, deliveries and approval reminders — so a
 * rule can never feed itself.
 */

import {
	EVENT_CATEGORIES,
	type EventCategory,
} from "../../events/eventCatalog";
import type { NotificationRule, RuleMatch } from "../types";

/** The event every run writes when it ends; its `status` is what a rule matches. */
export const RUN_FINISH = "run.finish";

/** One click to the most common rule: tell someone when any run fails. */
export const ANY_RUN_FAILS = {
	name: "Any run fails",
	events: [RUN_FINISH],
	status: "failed",
} as const;

/** True for an action a rule may not listen for. */
export function isSelfFeeding(action: string): boolean {
	return (
		action.startsWith("notification_rule.") ||
		action.startsWith("channel.") ||
		action.startsWith("delivery.") ||
		action === "approval.remind"
	);
}

/** The events catalogue as a rule's *When* offers it, grouped as in Events. */
export const RULE_EVENT_CATEGORIES: EventCategory[] = EVENT_CATEGORIES.map(
	(c) => ({ ...c, types: c.types.filter((t) => !isSelfFeeding(t.action)) }),
).filter((c) => c.types.length > 0);

/** What narrows the events: `has status failed`, or *any product*. */
export function matchText(match: RuleMatch): string {
	const parts = Object.entries(match ?? {}).map(
		([key, value]) => `has ${key} ${String(value)}`,
	);
	return parts.length ? parts.join(" · ") : "any product";
}

/** A Graph role as the people who hold it: `owner` → *owners*. */
export function rolePlural(role: string): string {
	return role.endsWith("s") ? role : `${role}s`;
}

/** Joins names as a sentence does: *a*, *a and b*, *a, b and c*. */
function listText(names: string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Who hears a rule, by name, or *nobody* when it names no one. */
export function audienceText(
	rule: Pick<NotificationRule, "member_ids" | "roles" | "requester">,
	nameOf: (id: string) => string,
): string {
	const names = [
		...rule.member_ids.map(nameOf),
		...rule.roles.map(rolePlural),
		...(rule.requester ? ["whoever the run was for"] : []),
	];
	return names.length ? `tells ${listText(names)}` : "tells nobody";
}
