/**
 * What every Ledger tab draws the same way: a verdict as a badge with its
 * refusal reason, an actor chain with the acting one in bold, a function as
 * inline code, a row's time, and the windows a read takes.
 *
 * Composed from `@invana/ui` and tokens only. Every number is the engine's.
 */

import { Badge, TypographyInlineCode } from "@invana/ui";
import { formatGrouped } from "@invana-studio/core";
import { Fragment } from "react";
import type { ChainLink } from "./types";

/** The windows a ledger read takes — the engine's keys and their words. */
export const SINCE_OPTIONS = [
	{ value: "today", label: "Today" },
	{ value: "24h", label: "Last 24 hours" },
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
];

export const sinceLabel = (since: string) =>
	SINCE_OPTIONS.find((o) => o.value === since)?.label ?? since;

/** What a ledger row touched — the engine's layers. */
export const LAYER_OPTIONS = [
	"graph",
	"web",
	"llm",
	"secret",
	"agent",
	"run",
	"lens",
	"access",
	"rule",
].map((value) => ({ value, label: value }));

const VERDICT_TONE: Record<string, "success" | "destructive" | "warning"> = {
	allowed: "success",
	refused: "destructive",
	approval: "warning",
	held: "warning",
};

/** `allowed` · `refused · grant` · `approval` · `held · approval`. */
export function VerdictBadge({
	verdict,
	refusedBy,
}: {
	verdict: string;
	refusedBy?: string | null;
}) {
	const words =
		verdict === "held"
			? "held · approval"
			: refusedBy
				? `${verdict} · ${refusedBy}`
				: verdict;
	return (
		<Badge variant="soft" tone={VERDICT_TONE[verdict] ?? "muted"}>
			{words}
		</Badge>
	);
}

/** `ravi ▸ Route Auditor ▸ Hub Checker LHR`, the acting one in bold. */
export function ActorChain({ chain }: { chain: ChainLink[] }) {
	if (!chain.length) return <span className="text-muted-foreground">—</span>;
	return (
		<span>
			{chain.map((link, i) => {
				const last = i === chain.length - 1;
				return (
					<Fragment
						key={chain
							.slice(0, i + 1)
							.map((l) => l.id ?? l.name)
							.join(">")}
					>
						{i > 0 && <span className="text-muted-foreground"> ▸ </span>}
						<span className={last ? "font-medium" : "text-muted-foreground"}>
							{link.name}
						</span>
					</Fragment>
				);
			})}
		</span>
	);
}

export function Act({ act }: { act: string }) {
	return <TypographyInlineCode>{act}</TypographyInlineCode>;
}

/** `10:14:02` today, else `Oct 22 18:11`. */
export function rowTime(iso: string): string {
	const at = new Date(iso);
	const today = new Date();
	const time = at.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	if (at.toDateString() === today.toDateString()) return time;
	return `${at.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time.slice(0, 5)}`;
}

/** `10:20` — when a check last ran. */
export const clock = (iso: string | null | undefined) =>
	iso
		? new Date(iso).toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			})
		: "—";

export const n = (v: number | null | undefined) =>
	v == null ? "—" : formatGrouped(v);

/** `28 robots · 9 grant · 3 ceiling`, as the engine counted them. */
export function byReason(counts: Record<string, number>): string {
	return Object.entries(counts)
		.filter(([, c]) => c > 0)
		.map(([reason, c]) => `${formatGrouped(c)} ${reason}`)
		.join(" · ");
}

/** `graph/Airport · 12 rows` — the address, then the engine's volume line. */
export function touchedLine(row: { touched: string; touched_line: string }) {
	if (!row.touched) return row.touched_line || "—";
	if (!row.touched_line || row.touched_line.includes(row.touched))
		return row.touched_line || row.touched;
	return `${row.touched} · ${row.touched_line}`;
}

/** `#2291`, or `—` for an act outside a run. */
export const runLabel = (number: number | null, id: string | null) =>
	number != null ? `#${number}` : id ? id.slice(0, 8) : "—";
