/**
 * The journal's controls — a search over the ask, then one chip per filter
 * the engine takes: `kind · status · agent · since`
 * (see-what-ran.md `operate.runs.list`).
 *
 * Every control writes the URL through `useListParams`; the engine decides
 * which runs match. A set chip shows its value; clearing one filter is the
 * applied-filters strip's `×`, so each filter is removed in one place.
 */

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	FilterBar,
	FilterChip,
	SearchInput,
} from "@invana/ui";
import type { ListUrl } from "@invana-studio/core";

const RUN_KINDS = ["nl", "ql", "import", "bulk"] as const;
const RUN_STATUSES = [
	"queued",
	"running",
	"awaiting_approval",
	"awaiting_input",
	"succeeded",
	"failed",
	"cancelled",
] as const;
const RUN_SINCE: Option[] = [
	{ value: "24h", label: "last 24 hours" },
	{ value: "7d", label: "last 7 days" },
	{ value: "30d", label: "last 30 days" },
	{ value: "90d", label: "last 90 days" },
];

interface Option {
	value: string;
	label: string;
}

function Chip({
	label,
	value,
	options,
	allLabel,
	onChange,
}: {
	label: string;
	value: string | undefined;
	options: Option[];
	allLabel: string;
	onChange: (v: string | null) => void;
}) {
	const set = value ? options.find((o) => o.value === value) : undefined;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<FilterChip
					label={label}
					value={set?.label ?? value}
					active={Boolean(value)}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuRadioGroup
					value={value ?? ""}
					onValueChange={(v) => onChange(v || null)}
				>
					<DropdownMenuRadioItem value="">{allLabel}</DropdownMenuRadioItem>
					{options.map((o) => (
						<DropdownMenuRadioItem key={o.value} value={o.value}>
							{o.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const plain = (values: readonly string[]): Option[] =>
	values.map((v) => ({ value: v, label: v }));

export function RunsFilterBar({
	list,
	agents,
}: {
	list: ListUrl;
	agents: { id: string; name: string }[];
}) {
	const filters = list.query.filters ?? {};
	const chip = (field: string) => ({
		value: filters[field]?.[0],
		onChange: (v: string | null) => list.setFilter(field, v ? [v] : []),
	});
	return (
		<FilterBar className="h-auto flex-wrap px-3 py-2">
			<SearchInput
				inputSize="sm"
				className="w-64"
				placeholder="Search what was asked"
				aria-label="Search runs"
				value={list.query.q ?? ""}
				onChange={list.setQ}
			/>
			<Chip
				label="kind"
				options={plain(RUN_KINDS)}
				allLabel="every kind"
				{...chip("kind")}
			/>
			<Chip
				label="status"
				options={plain(RUN_STATUSES)}
				allLabel="every status"
				{...chip("status")}
			/>
			<Chip
				label="agent"
				options={agents.map((a) => ({ value: a.id, label: a.name }))}
				allLabel="every agent"
				{...chip("agent_id")}
			/>
			<Chip
				label="since"
				options={RUN_SINCE}
				allLabel="all time"
				{...chip("since")}
			/>
		</FilterBar>
	);
}
