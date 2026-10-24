/**
 * What the fleet's pages — Fleet and Performance — draw the same way.
 *
 * - The read's two seams: the kit's spinner line while the fleet is read, and
 *   the engine's own words in an `EmptyState` when it refuses.
 * - The formatters: run time as an elapsed figure, success as a percentage,
 *   tokens as a magnitude, and a change against a prior as an arrow and a
 *   percentage, with the tone the change carries.
 *
 * Composed from `@invana/ui` and tokens only. Tokens, never currency.
 */

import { EmptyState, Spinner } from "@invana/ui";
import { formatCompact, formatElapsed } from "@invana-studio/core";
import { CircleAlert } from "lucide-react";
import type { Change, FleetMeasure } from "../fleet/types";

/** Loading, or the read's refusal as the engine worded it; null once read. */
export function FleetReadState({
	loading,
	error,
	what,
}: {
	loading: boolean;
	error: Error | null;
	/** What is being read — `the fleet`, `performance`. */
	what: string;
}) {
	if (loading)
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Spinner />
				Reading {what}…
			</div>
		);
	if (!error) return null;
	return (
		<EmptyState
			icon={<CircleAlert className="size-6" />}
			title={`Could not read ${what}`}
			description={error.message}
		/>
	);
}

/** A run time in ms, or `—` when nothing settled. */
export const ms = (v: number | null | undefined) =>
	v == null ? "—" : formatElapsed(Math.round(v));

/** A rate `0`–`1` as `98.6%`, or `—`. */
export const pct = (v: number | null | undefined) =>
	v == null ? "—" : `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;

/** A token count as a magnitude, or `—`. */
export const tokens = (v: number | null | undefined) =>
	v == null ? "—" : formatCompact(Math.round(v));

/** `9 Oct` from an ISO date or timestamp. */
export const day = (iso: string) =>
	new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(
		undefined,
		{ day: "numeric", month: "short", timeZone: "UTC" },
	);

/**
 * A change as words: `↑ 38%` · `▲ 1.2 pt` · `flat`. Formatting only — the
 * engine decided the number, the direction and the band that reads flat.
 */
export function changeText(c: Change, glyphs: [string, string] = ["↑", "↓"]) {
	if (c.direction === "flat") return "flat";
	const glyph = c.direction === "up" ? glyphs[0] : glyphs[1];
	const size = Math.abs(c.by) * 100;
	return c.unit === "points"
		? `${glyph} ${size.toFixed(1)} pt`
		: `${glyph} ${Math.round(size)}%`;
}

/** The text tone of a change: worse warns, better is success, else muted. */
export function changeTone(
	c: Change | null | undefined,
): "warning" | "success" | "muted" {
	if (!c) return "muted";
	return c.tone === "worse"
		? "warning"
		: c.tone === "better"
			? "success"
			: "muted";
}

/** A tile caption's change against the window before: `↑ 38% · 7 days`. */
export function measureCaption(
	m: FleetMeasure,
	span: string,
): { caption: string; tone: "warning" | "success" | "muted" } {
	if (!m.change) return { caption: span, tone: "muted" };
	return {
		caption: `${changeText(m.change)} · ${span}`,
		tone: changeTone(m.change),
	};
}

/** The text class for a tone, on a cell or an inline figure. */
export const TONE_TEXT: Record<string, string> = {
	warning: "text-warning",
	success: "text-success",
	error: "text-destructive",
	muted: "text-muted-foreground",
};

/** Up to four evenly spread axis ticks over `n` periods. */
export function spreadTicks(n: number): number[] {
	if (n <= 1) return n ? [0] : [];
	const step = (n - 1) / 3;
	return [...new Set([0, 1, 2, 3].map((i) => Math.round(i * step)))];
}
