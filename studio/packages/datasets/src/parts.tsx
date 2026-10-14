/**
 * Small pieces every Datasets surface draws the same way — the origin badge,
 * a sensitivity label, the page frame — composed from `@invana/ui` only.
 */

import { Badge, EmptyState, Spinner } from "@invana/ui";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ORIGIN_LABEL, ORIGIN_TONE } from "./labels";
import type { Origin } from "./types";

export function OriginBadge({ origin }: { origin: Origin }) {
	return (
		<Badge variant="outline" tone={ORIGIN_TONE[origin]} size="xs">
			{ORIGIN_LABEL[origin] ?? origin}
		</Badge>
	);
}

/** A scrolling page column under the shell's header. */
export function Page({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto">
			{children}
		</div>
	);
}

export function PageBody({ children }: { children: ReactNode }) {
	return <div className="flex flex-col gap-3 p-3">{children}</div>;
}

/** Loading, or the read's refusal as the engine worded it. */
export function ReadState({
	loading,
	error,
}: {
	loading: boolean;
	error: Error | null;
}) {
	if (loading) return <Spinner />;
	if (!error) return null;
	return (
		<EmptyState
			className="h-full"
			icon={<CircleAlert className="size-6" />}
			title="This could not be read"
			description={error.message}
		/>
	);
}
