/**
 * Small pieces every project surface draws the same way — the page frame, a
 * read's loading or refusal, a stance badge and a bordered box with a header —
 * composed from `@invana/ui` only.
 */

import { Badge, EmptyState, SectionHeader, Spinner } from "@invana/ui";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { STANCE_TONE } from "../records/words";
import type { Stance } from "../types";

/** A scrolling page column under the shell's header. */
export function Page({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto">
			{children}
		</div>
	);
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

export function StanceBadge({ stance }: { stance: Stance }) {
	return (
		<Badge variant="soft" tone={STANCE_TONE[stance]} size="xs">
			{stance}
		</Badge>
	);
}

/** A bordered box with a section header — `Branches`, `Evidence`, `Rules`. */
export function Box({
	title,
	count,
	actions,
	children,
}: {
	title: ReactNode;
	count?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex min-w-0 flex-col rounded-md border">
			<SectionHeader title={title} count={count} actions={actions} />
			<div className="min-w-0">{children}</div>
		</section>
	);
}

/** A bordered region a canvas fills — the branch tree, a decision's lineage. */
export function CanvasFrame({ children }: { children: ReactNode }) {
	return (
		<div className="h-[60vh] min-h-80 overflow-hidden rounded-md border">
			{children}
		</div>
	);
}

/** One muted line inside a box: an empty state or a hint. */
export function Muted({ children }: { children: ReactNode }) {
	return <p className="px-3 py-3 text-sm text-muted-foreground">{children}</p>;
}
