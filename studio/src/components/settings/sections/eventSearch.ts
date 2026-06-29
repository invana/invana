/**
 * Free-text matcher for the events search bar. Filters the *loaded* event
 * buffer client-side (the read API has no full-text search) across the fields
 * a reader would scan for: action, actor, target, and the payload JSON.
 */

import type { AuditEvent } from "../../../types/events";

export function matchesEventSearch(event: AuditEvent, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const haystack = [
		event.action,
		event.actor?.username,
		event.actor?.display_name,
		event.actor_type,
		event.target_kind,
		event.target_id,
		JSON.stringify(event.details),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return haystack.includes(q);
}
