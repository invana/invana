/**
 * The journal's filter chips — `kind · status · role · agent · since`
 * (see-what-ran.md C1 · SR10 · `operate.runs.list`).
 *
 * One chip per dimension, each opening its own menu. A set chip carries its
 * value and a `×` that clears only that filter, so a narrowed journal says how
 * it was narrowed while it scrolls — a funnel alone would hide that.
 */

import type { RunsFilters, RunsSince } from "@/hooks/queries/useRuns";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	FilterBar,
	FilterChip,
} from "@invana/ui";

export const RUN_KINDS = ["nl", "ql", "import", "bulk"] as const;
export const RUN_STATUSES = [
	"queued",
	"running",
	"awaiting_approval",
	"awaiting_input",
	"succeeded",
	"failed",
	"cancelled",
] as const;
export const RUN_ROLES = ["execute", "plan", "evaluate"] as const;
export const RUN_SINCE: { value: RunsSince; label: string }[] = [
	{ value: "today", label: "today" },
	{ value: "7d", label: "7 days" },
	{ value: "30d", label: "30 days" },
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
	value: string | null | undefined;
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
					value={set?.label}
					active={Boolean(set)}
					onRemove={set ? () => onChange(null) : undefined}
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
	filters,
	onChange,
	agents,
}: {
	filters: RunsFilters;
	onChange: (patch: Partial<RunsFilters>) => void;
	agents: { id: string; name: string }[];
}) {
	return (
		<FilterBar className="h-auto flex-wrap px-3 py-2">
			<Chip
				label="kind"
				value={filters.kind}
				options={plain(RUN_KINDS)}
				allLabel="every kind"
				onChange={(kind) => onChange({ kind })}
			/>
			<Chip
				label="status"
				value={filters.status}
				options={plain(RUN_STATUSES)}
				allLabel="every status"
				onChange={(status) => onChange({ status })}
			/>
			<Chip
				label="role"
				value={filters.role}
				options={plain(RUN_ROLES)}
				allLabel="every role"
				onChange={(role) => onChange({ role })}
			/>
			<Chip
				label="agent"
				value={filters.agentId}
				options={agents.map((a) => ({ value: a.id, label: a.name }))}
				allLabel="every agent"
				onChange={(agentId) => onChange({ agentId })}
			/>
			<Chip
				label="since"
				value={filters.since}
				options={RUN_SINCE}
				allLabel="all time"
				onChange={(since) => onChange({ since: since as RunsSince | null })}
			/>
		</FilterBar>
	);
}
