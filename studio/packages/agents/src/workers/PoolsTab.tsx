/**
 * Workers › Pools — tiles, *Workers · last 30 min*, Worker events and the
 * pools. A pool row opens the pool's page as a workbook tab. With no pools
 * anywhere the page says where steps run instead.
 */

import { LineChart } from "@invana/charts";
import { type ColumnDef, DataTable } from "@invana/tables";
import { EmptyState, MetricGrid, MetricTile } from "@invana/ui";
import { formatGrouped } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { useMemo } from "react";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import {
	AdminButton,
	DASH,
	labelsText,
	PoolStateChip,
	slotsOf,
	span,
	whenOf,
} from "./parts";
import { useEventsQuery, useOverviewQuery, usePoolsQuery } from "./queries";
import type { PoolRow, PoolsOverview, WorkerEventRow } from "./types";

const RUNS_ON_LABEL = {
	docker: "Docker",
	python: "Python",
	kubernetes: "Kubernetes",
} as const;

/** `+12% vs 7-day`, from the engine's whole percent. */
function against(pct: number | null): string | undefined {
	if (pct == null) return undefined;
	return `${pct > 0 ? "+" : ""}${pct}% vs 7-day`;
}

export function PoolsTab({ onAdd }: { onAdd: () => void }) {
	const overview = useOverviewQuery();
	const pools = usePoolsQuery();

	if (overview.isLoading || pools.isLoading || overview.error || pools.error)
		return (
			<FleetReadState
				loading={overview.isLoading || pools.isLoading}
				error={overview.error ?? pools.error}
				what="the pools"
			/>
		);
	if (!overview.data || !pools.data) return null;

	if (pools.data.items.length === 0)
		return (
			<EmptyState
				title="No workers yet"
				description={
					overview.data.executor === "inline"
						? "Steps run inside the engine on this install. Add workers to run tool steps on other machines."
						: "No pool exists on this install. Add workers to make one."
				}
				actions={<AdminButton onClick={onAdd}>Add workers</AdminButton>}
			/>
		);

	return (
		<>
			<Tiles totals={overview.data.totals} />
			<div className="grid items-start gap-2.5 lg:grid-cols-2">
				<WorkersChart overview={overview.data} />
				<EventsCard />
			</div>
			<PoolsCard pools={pools.data.items} />
		</>
	);
}

function Tiles({ totals: t }: { totals: PoolsOverview["totals"] }) {
	return (
		<MetricGrid minTileWidth={160}>
			<MetricTile
				label="Workers"
				value={formatGrouped(t.workers)}
				caption={`${t.starting} starting · ${t.lost} lost`}
				captionTone={t.lost > 0 ? "warning" : "muted"}
			/>
			<MetricTile
				label="Slots busy"
				value={slotsOf(t.slots_busy, t.slots)}
				caption={t.busy_pct == null ? undefined : `${t.busy_pct}%`}
				captionTone="muted"
			/>
			<MetricTile
				label="Queue"
				value={formatGrouped(t.queued)}
				caption={t.oldest_s == null ? undefined : `oldest ${span(t.oldest_s)}`}
				captionTone="muted"
			/>
			<MetricTile
				label="Envelopes a minute"
				value={formatGrouped(t.envelopes_a_minute)}
				caption={against(t.envelopes_vs_7d_pct)}
				captionTone="muted"
			/>
			<MetricTile
				label="Lost · 24 h"
				value={t.lost_24h}
				caption={t.lost_24h_last ?? undefined}
				captionTone={t.lost_24h > 0 ? "warning" : "muted"}
			/>
		</MetricGrid>
	);
}

const hhmm = (iso: string) =>
	new Date(iso).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

/** The series point a mark sits on: the one nearest its time. */
function nearest(series: PoolsOverview["series"], at: string): number {
	const t = new Date(at).getTime();
	let best = 0;
	let gap = Number.POSITIVE_INFINITY;
	series.forEach((p, i) => {
		const g = Math.abs(new Date(p.at).getTime() - t);
		if (g < gap) {
			gap = g;
			best = i;
		}
	});
	return best;
}

function WorkersChart({ overview }: { overview: PoolsOverview }) {
	const { series, marks } = overview;
	const last = series.length - 1;
	return (
		<PanelSection card title="Workers · last 30 min">
			<LineChart
				values={series.map((p) => p.workers)}
				labels={series.map((p) => hhmm(p.at))}
				ticks={last > 0 ? [0, Math.floor(last / 2), last] : undefined}
				marks={marks.map((m) => ({
					index: nearest(series, m.at),
					label: m.label,
				}))}
				empty="No worker has reported in the last 30 minutes"
			/>
		</PanelSection>
	);
}

const eventColumns: ColumnDef<WorkerEventRow>[] = [
	{
		id: "when",
		header: "When",
		cell: ({ row }) => (
			<span className="font-mono">{whenOf(row.original.at)}</span>
		),
	},
	{ id: "pool", header: "Pool", cell: ({ row }) => row.original.pool },
	{
		id: "change",
		header: "Change",
		cell: ({ row }) => row.original.change_text,
	},
	{
		id: "why",
		header: "Why",
		cell: ({ row }) => (
			<span className="text-muted-foreground">{row.original.why}</span>
		),
	},
];

/** The newest worker events; Capacity shows the same list with who made each. */
export function EventsCard({ withActor }: { withActor?: boolean }) {
	const events = useEventsQuery();
	const columns = useMemo<ColumnDef<WorkerEventRow>[]>(
		() =>
			withActor
				? [
						...eventColumns,
						{
							id: "by",
							header: "By",
							cell: ({ row }) => row.original.actor ?? "engine",
						},
					]
				: eventColumns,
		[withActor],
	);
	return (
		<PanelSection card title="Worker events">
			{events.isLoading || events.error ? (
				<FleetReadState
					loading={events.isLoading}
					error={events.error}
					what="the events"
				/>
			) : (
				<DataTable
					columns={columns}
					data={events.data?.items ?? []}
					enableSorting={false}
					getRowId={(row) => row.id}
					emptyState="No worker has joined, been lost or drained yet"
				/>
			)}
		</PanelSection>
	);
}

function setBy(p: PoolRow): string {
	return p.set_by === "replicas" && p.replicas != null
		? `${p.replicas} replicas`
		: "by hand";
}

function PoolsCard({ pools }: { pools: PoolRow[] }) {
	const open = useAgentsOpen();
	const columns = useMemo<ColumnDef<PoolRow>[]>(
		() => [
			{
				id: "pool",
				header: "Pool",
				cell: ({ row }) => (
					<span className="font-medium">{row.original.name}</span>
				),
			},
			{
				id: "runs_on",
				header: "Runs on",
				cell: ({ row }) =>
					`${RUNS_ON_LABEL[row.original.runs_on]} · ${row.original.runs_on_detail}`,
			},
			{
				id: "labels",
				header: "Labels",
				cell: ({ row }) => (
					<span className="font-mono">{labelsText(row.original.labels)}</span>
				),
			},
			{
				id: "workers",
				header: "Workers",
				cell: ({ row }) => (
					<span className="font-mono">{row.original.workers}</span>
				),
			},
			{
				id: "set_by",
				header: "Set by",
				cell: ({ row }) => setBy(row.original),
			},
			{
				id: "slots",
				header: "Slots busy",
				cell: ({ row }) => (
					<span className="font-mono">
						{slotsOf(row.original.slots_busy, row.original.slots)}
					</span>
				),
			},
			{
				id: "queued",
				header: "Queued",
				cell: ({ row }) => (
					<span className="font-mono">
						{formatGrouped(row.original.queued)}
					</span>
				),
			},
			{
				id: "oldest",
				header: "Oldest",
				cell: ({ row }) => (
					<span className="font-mono">
						{row.original.oldest_s == null ? DASH : span(row.original.oldest_s)}
					</span>
				),
			},
			{
				id: "state",
				header: "State",
				cell: ({ row }) => <PoolStateChip state={row.original.state} />,
			},
		],
		[],
	);
	return (
		<DataTable
			columns={columns}
			data={pools}
			enableSorting={false}
			getRowId={(row) => row.id}
			onRowClick={(row) => open.pool(row.name)}
		/>
	);
}
