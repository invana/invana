import type { Tone } from "@/pages/graphs-detail/shared/statusTone";
import { AppStatusBar, cn } from "@invana/ui";
import type { ReactNode } from "react";

/**
 * A panel's own status line, on the kit's `AppStatusBar`.
 *
 * `left` says where you are inside the panel (`Tasks · Plan`, with the current
 * one in foreground weight); `middle` carries live counts that would otherwise
 * make a user click each row to discover (`1 running · 1 needs input`); `right`
 * is the keyboard shortcut or the one-line rule for this surface.
 *
 * **Kit candidate.** `AppStatusBar` gives the bar; the three named slots are the
 * convention nine panels share, and factoring them is what stopped the footers
 * drifting in height, weight and order. Tracked in
 * `docs/for-developers/building-studio/design-kit-coverage.md`.
 */
export function PanelStatusBar({
	left,
	middle,
	right,
}: {
	left?: ReactNode;
	middle?: ReactNode[];
	right?: ReactNode;
}) {
	return (
		<AppStatusBar end={right} className="shrink-0">
			{/* `AppStatusBar` puts everything it is given inside a single truncating
			    span, so its own `gap-2` never reaches these. The group carries its
			    own row and its own gap. */}
			<span className="flex min-w-0 items-center gap-3">
				{left}
				{(middle ?? []).map((item, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: literal status fragments
					<span key={i} className="shrink-0">
						{item}
					</span>
				))}
			</span>
		</AppStatusBar>
	);
}

/**
 * A live count in the status bar, coloured by what it is asking of you.
 *
 * The hi-fi tints these and nothing else on the line — `1 running` in the brand
 * green, `1 needs input` in amber — because the whole reason the counts are here
 * rather than discoverable by clicking each row is that one of them means *you
 * are the bottleneck*, and a monochrome line hides which.
 */
export function StatusCount({
	children,
	tone = "muted",
}: {
	children: ReactNode;
	tone?: Tone;
}) {
	const tones: Record<Tone, string> = {
		muted: "text-muted-foreground",
		queued: "text-muted-foreground",
		info: "text-primary",
		running: "text-primary",
		warning: "text-warning",
		success: "text-success",
		error: "text-destructive",
	};
	return <span className={tones[tone]}>{children}</span>;
}

/** One word in the status bar's `left` group; the current one is not muted. */
export function StatusCrumb({
	children,
	active,
	onClick,
}: {
	children: ReactNode;
	active?: boolean;
	onClick?: () => void;
}) {
	const className = cn(
		active ? "font-medium text-foreground" : "text-muted-foreground",
		onClick && "hover:text-foreground",
	);
	if (!onClick) return <span className={className}>{children}</span>;
	return (
		<button type="button" onClick={onClick} className={className}>
			{children}
		</button>
	);
}
