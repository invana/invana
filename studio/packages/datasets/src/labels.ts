/**
 * How Datasets names the engine's enums on screen — origins, author-chain
 * roles, enforcement modes — and the token each is inked in.
 */

import type { AuthorStep, Enforcement, Origin } from "./types";

export const ORIGINS: Origin[] = [
	"official",
	"collected",
	"generated",
	"observed",
	"derived",
];

export const ORIGIN_LABEL: Record<Origin, string> = {
	official: "Official",
	collected: "Collected",
	generated: "AI-generated",
	observed: "Observed",
	derived: "Derived",
};

/** A Badge `tone` per origin, so an origin reads the same on every surface. */
export const ORIGIN_TONE: Record<
	Origin,
	"info" | "warning" | "primary" | "success" | "muted"
> = {
	official: "info",
	collected: "warning",
	generated: "primary",
	observed: "success",
	derived: "muted",
};

export const ROLE_LABEL: Record<AuthorStep["role"], string> = {
	original: "original author",
	collected_by: "collected by",
	modified_by: "modified by",
	validated_by: "validated by",
};

export const MODE_LABEL: Record<Enforcement, string> = {
	block: "Block — reject the version",
	warn: "Warn — keep and flag",
	report: "Report — score only",
};

/** `0.9733` → `97%` — conformance as a reader says it. */
export function percent(score: number): string {
	return `${Math.floor(score * 100)}%`;
}

/** `sha256:9e1a…c04` → `9e1a…c04`, short enough for a table cell. */
export function shortHash(hash: string | null | undefined): string {
	if (!hash) return "—";
	const hex = hash.replace(/^sha256:/, "");
	return `${hex.slice(0, 4)}…${hex.slice(-3)}`;
}

export function dayLabel(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/** A value as a cell shows it: null as an em dash, everything else as text. */
export function cell(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	return String(value);
}
