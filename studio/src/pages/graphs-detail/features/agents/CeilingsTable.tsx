import { usdWhole } from "@/lib/format";
/**
 * A2 · the ceilings this agent runs inside — **value · what it bounds ·
 * whether anything enforces it**.
 *
 * *As the person who set this agent's budget, I want to see which ceilings stop
 * a run and which are only drawn against, so that I do not believe a number is
 * protecting me when it is not.*
 *
 * **Declared is not the same as enforced, and the table says which**
 * ([EB7](../../../../../docs/for-developers/modules/agents/features/envelope-and-budget.md)).
 * `max_concurrent_runs` refuses at admission, naming the agent
 * ([CC11](../../../../../docs/for-developers/modules/agents/features/concurrency-and-contention.md));
 * a spend ceiling is drawn against rather than stopped on, because stopping
 * mid-run is exactly what [EB2] forbids; and `max_fanout` is unread until
 * something dispatches a `map_over`. A table that printed all ten the same way
 * would be telling the reader that ten numbers protect them when four do.
 *
 * **Drawn as the page draws it (AG38):** each row is the key a reader will meet
 * in a plan's refusal (`max_steps`), the number, and what it bounds. A ceiling
 * that is only drawn against, or that nothing reads yet, says so after what it
 * bounds — the one column the page does not draw is folded into the words.
 * The number is text until the section is edited, then an input.
 *
 * Empty is *the default applies*, never zero: a blank ceiling is the Graph's,
 * and `0` would be an agent that may not take a step.
 *
 * **One table per group, drawn where it is read** (AG23 · EB9): *Effort* on the
 * agent's Thinking tab, *Budget* and *Reach* on its Activity tab beside the
 * meters they cap. Effort is `agents.effort`; the other two are `agents.budget`.
 */

import { Input } from "@invana/forms";
import { Table, TableBody, TableCell, TableRow } from "@invana/ui";

/** How a ceiling is held, in the reader's words. */
type Enforcement = "admission" | "validation" | "drawn" | "unread";

/** What a number limits — how hard it tries, what it spends, how wide it spreads. */
type CeilingGroup = "effort" | "budget" | "reach";

interface Ceiling {
	key: string;
	group: CeilingGroup;
	/** What the number bounds — one short phrase, not a sentence. */
	bounds: string;
	enforcement: Enforcement;
	/** Money reads as money. */
	usd?: boolean;
}

/**
 * Every key of `effective_budget` and `effective_effort`, each group in the
 * order the page lists it. A ceiling the record carries and the screen does not
 * draw is one nobody can work within (EB6).
 */
const CEILINGS: readonly Ceiling[] = [
	{
		key: "max_steps",
		group: "effort",
		bounds: "steps in one plan",
		enforcement: "validation",
	},
	{
		key: "max_replans",
		group: "effort",
		bounds: "times it may re-plan after verify",
		enforcement: "validation",
	},
	{
		key: "max_clarifications",
		group: "effort",
		bounds: "questions per run · 0 = never asks",
		enforcement: "validation",
	},
	{
		key: "max_cost_usd_month",
		group: "budget",
		bounds: "a calendar month",
		enforcement: "drawn",
		usd: true,
	},
	{
		key: "max_cost_usd_run",
		group: "budget",
		bounds: "the most the work may set",
		enforcement: "drawn",
		usd: true,
	},
	{
		key: "max_tokens",
		group: "budget",
		bounds: "one run",
		enforcement: "drawn",
	},
	{
		key: "max_concurrent_runs",
		group: "reach",
		bounds: "runs at once",
		enforcement: "admission",
	},
	{
		key: "max_fanout",
		group: "reach",
		bounds: "lanes in one map",
		enforcement: "unread",
	},
	{
		key: "max_children",
		group: "reach",
		bounds: "agents spawned per run",
		enforcement: "validation",
	},
	{
		key: "max_depth",
		group: "reach",
		bounds: "levels of delegation",
		enforcement: "validation",
	},
];

/** Said only where the number does not stop a run by itself (EB7). */
const NOT_ENFORCED: Partial<Record<Enforcement, string>> = {
	drawn: "drawn against",
	unread: "nothing reads it yet",
};

export interface CeilingsTableProps {
	group: CeilingGroup;
	/** The agent's own `effort` or `budget` — the keys somebody set, not the defaults. */
	values: Record<string, number>;
	onChange: (values: Record<string, number>) => void;
	/** What a run reads where `values` is silent — drawn in its place. */
	effective?: Record<string, number>;
	/** Text, not inputs — the section is not being edited. */
	readOnly?: boolean;
}

function show(c: Ceiling, v: number | undefined): string {
	if (v == null) return "—";
	if (c.usd) return usdWhole(v);
	return v >= 1000 && v % 1000 === 0 ? `${v / 1000}k` : String(v);
}

export function CeilingsTable({
	group,
	values,
	onChange,
	effective,
	readOnly,
}: CeilingsTableProps) {
	const rows = CEILINGS.filter((c) => c.group === group);
	return (
		<Table bordered={false} density="compact">
			<TableBody>
				{rows.map((c) => {
					const own = values[c.key];
					const runs = own ?? effective?.[c.key];
					return (
						<TableRow key={c.key}>
							<TableCell className="w-0 whitespace-nowrap font-mono">
								{c.key}
							</TableCell>
							<TableCell className="w-0 whitespace-nowrap font-mono">
								{readOnly ? (
									<span
										className={
											own == null ? "text-muted-foreground" : undefined
										}
									>
										{show(c, runs)}
									</span>
								) : (
									<Input
										type="number"
										min={0}
										aria-label={c.key}
										// Empty is *the default applies* — clearing removes the key
										// rather than writing a zero nobody chose.
										value={own ?? ""}
										placeholder={runs != null ? String(runs) : "—"}
										className="h-7 w-20 text-right"
										onChange={(e) => {
											const next = { ...values };
											if (e.target.value === "") delete next[c.key];
											else next[c.key] = Number(e.target.value);
											onChange(next);
										}}
									/>
								)}
							</TableCell>
							<TableCell>
								{c.bounds}
								{NOT_ENFORCED[c.enforcement] ? (
									<span
										className={
											c.enforcement === "unread"
												? "text-warning"
												: "text-muted-foreground"
										}
									>
										{" "}
										· {NOT_ENFORCED[c.enforcement]}
									</span>
								) : null}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
