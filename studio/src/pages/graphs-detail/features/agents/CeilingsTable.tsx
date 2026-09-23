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
 */

import { Input } from "@invana/forms";
import { type ColumnDef, DataTable } from "@invana/tables";
import { useMemo } from "react";

/** How a ceiling is held, in the reader's words. */
type Enforcement = "admission" | "validation" | "drawn" | "unread";

interface Ceiling {
	key: string;
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
		label: "steps",
		bounds: "nodes one run may execute",
		enforcement: "validation",
	},
	{
		key: "max_replans",
		label: "replans",
		bounds: "times a plan may be rewritten mid-run",
		enforcement: "validation",
	},
	{
		key: "max_clarifications",
		label: "clarifications",
		bounds: "questions back to the asker",
		enforcement: "validation",
	},
	{
		key: "max_children",
		label: "children",
		bounds: "agents this one may spawn",
		enforcement: "validation",
	},
	{
		key: "max_depth",
		label: "depth",
		bounds: "how far delegation may nest",
		enforcement: "validation",
	},
	{
		key: "max_tokens",
		label: "tokens",
		bounds: "in + out across the run",
		enforcement: "drawn",
	},
	{
		key: "max_cost_usd_run",
		label: "$ per run",
		bounds: "one run's spend",
		enforcement: "drawn",
	},
	{
		key: "max_cost_usd_month",
		label: "$ this month",
		bounds: "spend across the month",
		enforcement: "drawn",
	},
	{
		key: "max_fanout",
		label: "fan-out",
		bounds: "lanes one map_over may open",
		enforcement: "unread",
	},
	{
		key: "max_concurrent_runs",
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
	/** The agent's own `budget` — the keys somebody set, not the defaults. */
	budget: Record<string, number>;
	onChange: (budget: Record<string, number>) => void;
}

export function CeilingsTable({ budget, onChange }: CeilingsTableProps) {
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
						placeholder="—"
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
		[budget, onChange],
	);

	return (
		<DataTable
			columns={columns}
			data={CEILINGS as Ceiling[]}
			enableSorting={false}
			enablePagination={false}
			// A 420px drawer has no room for a column chooser over ten rows the
			// reader did not choose the shape of.
			enableColumnVisibility={false}
		/>
	);
}
