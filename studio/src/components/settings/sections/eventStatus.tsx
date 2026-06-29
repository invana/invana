/**
 * Derived "status" facet for the events filter. Events have no status column,
 * so we infer a coarse outcome from the action name and the free-form
 * `details` payload: a `*_failed` action or `details.ok === false` is a
 * failure, `details.ok === true` is a success, and everything else (most
 * events) has no recorded outcome. Filtering is client-side over the loaded
 * buffer, like the search bar.
 */

import { RichSelect, type RichSelectOption } from "@invana/ui";
import { CircleCheck, CircleSlash, CircleX } from "lucide-react";
import type { AuditEvent } from "../../../types/events";

export type EventStatus = "success" | "failed" | "none";

export function eventStatus(event: AuditEvent): EventStatus {
	const ok = event.details?.ok;
	if (event.action.endsWith("_failed") || ok === false) return "failed";
	if (ok === true) return "success";
	return "none";
}

export function matchesStatusFilter(
	event: AuditEvent,
	statuses: string[],
): boolean {
	if (statuses.length === 0) return true;
	return statuses.includes(eventStatus(event));
}

const STATUS_OPTIONS: RichSelectOption[] = [
	{ value: "success", label: "Success", icon: CircleCheck },
	{ value: "failed", label: "Failed", icon: CircleX },
	{ value: "none", label: "No status", icon: CircleSlash },
];

export function StatusFilter({
	value,
	onChange,
}: {
	value: string[];
	onChange: (next: string[]) => void;
}) {
	return (
		<RichSelect
			multiple
			label="Status"
			options={STATUS_OPTIONS}
			value={value}
			onChange={(v) => onChange(Array.isArray(v) ? v : [v])}
			renderValue={(sel) => `Status${sel.length > 0 ? ` (${sel.length})` : ""}`}
			triggerClassName="h-7"
		/>
	);
}
