/**
 * What the Workers pages share: how a duration the engine stored reads, the
 * state chips, the install-admin gate on Add / Drain / Revoke, and the
 * workers table that a pool and the Workers tab both draw.
 *
 * Every figure is the engine's; this only formats it.
 */

import { InlineMeter } from "@invana/charts";
import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Button,
	type ButtonProps,
	SegmentedControl,
	StatusDot,
	TypographyInlineCode,
} from "@invana/ui";
import { formatGrouped, useAuth } from "@invana-studio/core";
import type { Tone } from "@invana-studio/ui";
import { type ReactNode, useMemo } from "react";
import type {
	PoolState,
	RunningStep,
	WorkerListPage,
	WorkerRow,
	WorkerState,
} from "./types";

/** Why a member cannot add, drain or revoke. */
const NEEDS_ADMIN = "Install admins add and scale workers";

export const DASH = "—";

/** `41 s` · `3 min` · `2 h` — seconds the engine counted, written for a person. */
export function span(s: number | null | undefined): string {
	if (s == null) return DASH;
	if (s < 60) return `${s} s`;
	if (s < 3600) return `${Math.round(s / 60)} min`;
	return `${Math.round(s / 3600)} h`;
}

/** `1s` · `42s` — a heartbeat's age. */
const age = (s: number | null | undefined): string =>
	s == null ? DASH : `${s}s`;

/** `0.4 s` / `120 ms` for a step time the engine stored in milliseconds. */
export function millis(ms: number | null | undefined): string {
	if (ms == null) return DASH;
	return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** `108 / 144`. */
export const slotsOf = (busy: number, total: number): string =>
	`${formatGrouped(busy)} / ${formatGrouped(total)}`;

/** `10:21` for today, else `Sep 12`. */
export function whenOf(iso: string | null | undefined): string {
	if (!iso) return DASH;
	const d = new Date(iso);
	return d.toDateString() === new Date().toDateString()
		? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
		: d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** `10:21:04`. */
export const clockOf = (iso: string): string =>
	new Date(iso).toLocaleTimeString(undefined, { hour12: false });

const WORKER_TONE: Record<WorkerState, Tone> = {
	busy: "info",
	idle: "muted",
	starting: "warning",
	draining: "warning",
	lost: "error",
	stopped: "muted",
};

/** A state as the board draws it: a dot, then the word. */
function Dotted({ tone, text }: { tone: Tone; text: string }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<StatusDot tone={tone} />
			{text}
		</span>
	);
}

export const WorkerStateChip = ({ state }: { state: WorkerState }) => (
	<Dotted tone={WORKER_TONE[state]} text={state} />
);

const POOL_TONE: Record<PoolState, Tone> = {
	keeping_up: "info",
	healthy: "success",
	short: "warning",
	no_workers: "warning",
};

const POOL_STATE_TEXT: Record<PoolState, string> = {
	keeping_up: "keeping up",
	healthy: "healthy",
	short: "short",
	no_workers: "no workers",
};

export const PoolStateChip = ({ state }: { state: PoolState }) => (
	<Dotted tone={POOL_TONE[state]} text={POOL_STATE_TEXT[state]} />
);

/** A button only an install admin can press; anyone else sees it disabled, naming the role. */
export function AdminButton({ children, ...props }: ButtonProps) {
	const { isSuperuser } = useAuth();
	return (
		<Button
			size="sm"
			{...props}
			disabled={!isSuperuser || props.disabled}
			title={isSuperuser ? props.title : NEEDS_ADMIN}
		>
			{children}
		</Button>
	);
}

export const labelsText = (labels: string[]): string =>
	labels.length ? labels.join(" · ") : DASH;

function Running({ worker }: { worker: WorkerRow }) {
	if (worker.running.length === 0)
		return <span className="text-muted-foreground">{worker.note ?? DASH}</span>;
	const first: RunningStep = worker.running[0];
	const more = worker.running.length - 1;
	return (
		<span>
			{[
				first.function,
				first.run_number != null ? `#${first.run_number}` : null,
				first.agent,
			]
				.filter(Boolean)
				.join(" · ")}
			{more > 0 ? (
				<span className="text-muted-foreground"> +{more}</span>
			) : null}
		</span>
	);
}

function workerColumns(showPool: boolean): ColumnDef<WorkerRow>[] {
	const cols: ColumnDef<WorkerRow>[] = [
		{
			id: "worker",
			header: "Worker",
			cell: ({ row }) => (
				<TypographyInlineCode>{row.original.name}</TypographyInlineCode>
			),
		},
	];
	if (showPool)
		cols.push({
			id: "pool",
			header: "Pool",
			cell: ({ row }) => row.original.pool,
		});
	cols.push(
		{
			id: "node",
			header: "Node",
			cell: ({ row }) => (
				<span className="font-mono text-muted-foreground">
					{row.original.node}
				</span>
			),
		},
		{
			id: "state",
			header: "State",
			cell: ({ row }) => <WorkerStateChip state={row.original.state} />,
		},
		{
			id: "running",
			header: "Running now",
			cell: ({ row }) => <Running worker={row.original} />,
		},
		{
			id: "slots",
			header: "Slots",
			cell: ({ row }) => (
				<span className="font-mono">
					{row.original.slots
						? slotsOf(row.original.slots_busy, row.original.slots)
						: DASH}
				</span>
			),
		},
		{
			id: "heartbeat",
			header: "Heartbeat",
			cell: ({ row }) => (
				<span className="font-mono">{age(row.original.heartbeat_s)}</span>
			),
		},
		{
			id: "cpu",
			header: "CPU",
			cell: ({ row }) => (
				<InlineMeter
					className="w-28"
					label="CPU"
					value={row.original.cpu}
					max={100}
					format={(v) => `${v}%`}
				/>
			),
		},
		{
			id: "up",
			header: "Up",
			cell: ({ row }) => (
				<span className="font-mono">{span(row.original.up_s)}</span>
			),
		},
	);
	return cols;
}

const STATE_CHIPS = [
	{ value: "", label: "All", count: "all" },
	{ value: "busy", label: "Busy", count: "busy" },
	{ value: "idle", label: "Idle", count: "idle" },
	{ value: "starting", label: "Starting", count: "starting" },
	{ value: "lost", label: "Lost", count: "lost" },
] as const;

/** `All 24 · Busy 20 · Idle 1 · Starting 2 · Lost 1` — the engine's counts. */
export function StateChips({
	counts,
	value,
	onChange,
}: {
	counts: WorkerListPage["counts"] | undefined;
	value: string;
	onChange: (state: string) => void;
}) {
	return (
		<SegmentedControl
			size="sm"
			aria-label="Worker state"
			value={value || "all"}
			onValueChange={(v) => onChange(v === "all" ? "" : v)}
			options={STATE_CHIPS.map((c) => ({
				value: c.value || "all",
				label: counts ? `${c.label} ${counts[c.count]}` : c.label,
			}))}
		/>
	);
}

/** Workers, a row opens the worker. `Showing N of M` is the engine's total. */
export function WorkersTable({
	page,
	showPool,
	onOpen,
	empty,
	showCount = true,
}: {
	page: WorkerListPage;
	showPool?: boolean;
	onOpen: (worker: WorkerRow) => void;
	empty: ReactNode;
	/** Off where the table is a deliberate slice, not a page of a list. */
	showCount?: boolean;
}) {
	const columns = useMemo(() => workerColumns(!!showPool), [showPool]);
	return (
		<>
			<DataTable
				columns={columns}
				data={page.items}
				enableSorting={false}
				getRowId={(row) => row.id}
				onRowClick={onOpen}
				emptyState={empty}
			/>
			{showCount ? (
				<p className="text-sm text-muted-foreground">
					Showing {page.items.length} of {page.total}.
				</p>
			) : null}
		</>
	);
}
