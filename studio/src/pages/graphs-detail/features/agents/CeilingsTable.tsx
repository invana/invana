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
 * **A table, not a form of ten inputs.** The value is editable in place — a
 * ceiling is a number somebody sets — but the row's other two columns are what
 * makes the number mean anything, and a row of bare inputs carries neither.
 *
 * Empty is *the default applies*, never zero: a blank ceiling is the Graph's,
 * and `0` would be an agent that may not take a step.
 *
 * **One table per group, drawn where it is read** (AG23 · EB9): *Effort* on the
 * agent's Thinking tab, *Budget* and *Reach* on its Activity tab beside the
 * meters they cap. Effort is `agents.effort`; the other two are `agents.budget`.
 */

import { Input } from "@invana/forms";
import { type ColumnDef, DataTable } from "@invana/tables";
import { useMemo } from "react";

/** How a ceiling is held, in the reader's words. */
type Enforcement = "admission" | "validation" | "drawn" | "unread";

/** What a number limits — how hard it tries, what it spends, how wide it spreads. */
export type CeilingGroup = "effort" | "budget" | "reach";

interface Ceiling {
	key: string;
	group: CeilingGroup;
	label: string;
	/** What the number bounds — one short phrase, not a sentence. */
	bounds: string;
	enforcement: Enforcement;
}

/**
 * Every key of `effective_budget`, in the order a run spends them: the shape of
 * one run, then what it may spawn, then what it may spend, then what it may
 * hold at once. A ceiling the record carries and the screen does not draw is
 * one nobody can work within (EB6).
 */
const CEILINGS: readonly Ceiling[] = [
	{
		key: "max_steps",
		group: "effort",
		label: "steps",
		bounds: "nodes one run may execute",
		enforcement: "validation",
	},
	{
		key: "max_replans",
		group: "effort",
		label: "replans",
		bounds: "times a plan may be rewritten mid-run",
		enforcement: "validation",
	},
	{
		key: "max_clarifications",
		group: "effort",
		label: "clarifications",
		bounds: "questions per run · 0 = never asks",
		enforcement: "validation",
	},
	{
		key: "max_children",
		group: "reach",
		label: "children",
		bounds: "agents this one may spawn",
		enforcement: "validation",
	},
	{
		key: "max_depth",
		group: "reach",
		label: "depth",
		bounds: "how far delegation may nest",
		enforcement: "validation",
	},
	{
		key: "max_tokens",
		group: "budget",
		label: "tokens",
		bounds: "in + out across the run",
		enforcement: "drawn",
	},
	{
		key: "max_cost_usd_run",
		group: "budget",
		label: "$ per run",
		bounds: "one run's spend",
		enforcement: "drawn",
	},
	{
		key: "max_cost_usd_month",
		group: "budget",
		label: "$ this month",
		bounds: "spend across the month",
		enforcement: "drawn",
	},
	{
		key: "max_fanout",
		group: "reach",
		label: "fan-out",
		bounds: "lanes one map_over may open",
		enforcement: "unread",
	},
	{
		key: "max_concurrent_runs",
		group: "reach",
		label: "concurrent runs",
		bounds: "runs this agent may hold at once",
		enforcement: "admission",
	},
];

const ENFORCEMENT_WORDS: Record<Enforcement, string> = {
	admission: "at admission",
	validation: "before dispatch",
	drawn: "declared · drawn against",
	unread: "declared · nothing reads it yet",
};

export interface CeilingsTableProps {
	group: CeilingGroup;
	/** The agent's own `effort` or `budget` — the keys somebody set, not the defaults. */
	values: Record<string, number>;
	onChange: (values: Record<string, number>) => void;
	/** What a run reads where `values` is silent — drawn as the placeholder. */
	effective?: Record<string, number>;
	readOnly?: boolean;
}

export function CeilingsTable({
	group,
	values: budget,
	onChange,
	effective,
	readOnly,
}: CeilingsTableProps) {
	const columns = useMemo<ColumnDef<Ceiling>[]>(
		() => [
			{
				id: "ceiling",
				header: "Ceiling",
				enableSorting: false,
				cell: ({ row }) => (
					<span className="flex min-w-0 flex-col">
						<span className="font-medium">{row.original.label}</span>
						<span className="truncate text-sm text-muted-foreground">
							{row.original.bounds}
						</span>
					</span>
				),
			},
			{
				id: "value",
				header: "Value",
				enableSorting: false,
				cell: ({ row }) => (
					<Input
						type="number"
						min={0}
						aria-label={row.original.label}
						// Empty is *the Graph's default applies* — clearing removes the
						// key rather than writing a zero nobody chose.
						value={budget[row.original.key] ?? ""}
						placeholder={
							effective?.[row.original.key] != null
								? String(effective[row.original.key])
								: "—"
						}
						disabled={readOnly}
						className="h-7 w-20"
						onChange={(e) => {
							const next = { ...budget };
							if (e.target.value === "") delete next[row.original.key];
							else next[row.original.key] = Number(e.target.value);
							onChange(next);
						}}
					/>
				),
			},
			{
				id: "enforced",
				header: "Enforced",
				enableSorting: false,
				cell: ({ row }) => (
					<span
						className={
							row.original.enforcement === "unread"
								? "text-sm text-warning"
								: "text-sm text-muted-foreground"
						}
					>
						{ENFORCEMENT_WORDS[row.original.enforcement]}
					</span>
				),
			},
		],
		[budget, onChange, effective, readOnly],
	);
	const rows = useMemo(
		() => CEILINGS.filter((c) => c.group === group),
		[group],
	);

	return (
		<DataTable
			columns={columns}
			data={rows}
			enableSorting={false}
			enablePagination={false}
			// A 420px drawer has no room for a column chooser over ten rows the
			// reader did not choose the shape of.
			enableColumnVisibility={false}
		/>
	);
}
