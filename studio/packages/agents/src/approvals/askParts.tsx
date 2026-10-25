/**
 * What the Waiting table and the ask dialog draw the same way: an ask's kind
 * as a badge, who it is routed to and why, how long it has waited, and its
 * run as a link to the run's page.
 */

import { Badge, Button } from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import type { Approval } from "@invana-studio/shell";

const KIND_TONE: Record<string, "warning" | "success" | "info" | "muted"> = {
	access: "warning",
	delegation: "warning",
	budget: "muted",
	send: "muted",
	question: "success",
	publish: "info",
};

export function KindBadge({ kind }: { kind: string }) {
	return (
		<Badge variant="soft" tone={KIND_TONE[kind] ?? "muted"}>
			{kind.charAt(0).toUpperCase() + kind.slice(1)}
		</Badge>
	);
}

/** `mira · world owner`, the reader named `you`. */
export function routedTo(ask: Approval, me: string | undefined): string {
	const names = (ask.approver_names ?? []).map((name) =>
		name === me ? "you" : name,
	);
	return [names.join(", "), ask.routed_reason].filter(Boolean).join(" · ");
}

/** How long a pending ask has waited — `6 mins` — or when it was answered. */
export function waited(ask: Approval): string {
	if (ask.status === "pending")
		return formatRelativeTime(new Date(ask.created_at)).replace(/ ago$/, "");
	return ask.decided_at
		? formatRelativeTime(new Date(ask.decided_at))
		: formatRelativeTime(new Date(ask.deadline_at));
}

/** `#2291`, opening the run's page. */
export function RunLink({
	ask,
	onOpen,
}: {
	ask: Approval;
	onOpen: (id: string) => void;
}) {
	if (!ask.run_id) return <span className="text-muted-foreground">—</span>;
	const runId = ask.run_id;
	return (
		<Button
			variant="secondary"
			size="sm"
			className="font-mono"
			onClick={(e) => {
				e.stopPropagation();
				onOpen(runId);
			}}
		>
			{ask.run_number != null ? `#${ask.run_number}` : runId.slice(0, 8)}
		</Button>
	);
}

/** What an answered ask ended as — `approved by mira`, `expired, not sent`. */
export function answer(ask: Approval): string {
	if (ask.status === "expired") return "expired, not sent";
	const always = ask.scope === "always" ? " · always" : "";
	return ask.decided_by_name
		? `${ask.status} by ${ask.decided_by_name}${always}`
		: `${ask.status}${always}`;
}
