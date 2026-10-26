/**
 * One worker's page — `worker:<name>` in `mainSection`.
 *
 * Slots, steps an hour, p95 a step and uptime, what it runs now, its CPU over
 * the last 30 minutes and its log. Breadcrumb *Workers › pool › worker*.
 */

import { LineChart } from "@invana/charts";
import { CodeBlock } from "@invana/editor";
import { type ColumnDef, DataTable } from "@invana/tables";
import {
	EmptyState,
	MetricGrid,
	MetricTile,
	RecordHeader,
	Spinner,
	TypographyInlineCode,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { useContext } from "react";
import { AgentsOpenContext } from "../open";
import { SECTIONS } from "../sections/spec";
import { DrainButton } from "./DrainButton";
import {
	clockOf,
	DASH,
	millis,
	slotsOf,
	span,
	WorkerStateChip,
	whenOf,
} from "./parts";
import { useDrainWorkerMutation, useWorkerQuery } from "./queries";
import type { RunningStep } from "./types";

const stepColumns: ColumnDef<RunningStep>[] = [
	{
		id: "step",
		header: "Step",
		cell: ({ row }) => (
			<TypographyInlineCode>{row.original.function}</TypographyInlineCode>
		),
	},
	{
		id: "run",
		header: "Run",
		cell: ({ row }) =>
			row.original.run_number != null ? (
				<TypographyInlineCode>#{row.original.run_number}</TypographyInlineCode>
			) : (
				DASH
			),
	},
	{
		id: "agent",
		header: "Agent",
		cell: ({ row }) => row.original.agent ?? DASH,
	},
	{
		id: "for",
		header: "For",
		cell: ({ row }) => (
			<span className="font-mono">{span(row.original.for_s)}</span>
		),
	},
];

/** One worker — its slots, steps, CPU and log. */
export function WorkerPage({
	worker,
	onOpenPool,
}: {
	worker: string;
	onOpenPool: (name: string) => void;
}) {
	const opener = useContext(AgentsOpenContext);
	const record = useWorkerQuery(worker);
	const drain = useDrainWorkerMutation();
	const w = record.data;
	const Icon = SECTIONS.workers.icon;

	if (record.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!w)
		return (
			<EmptyState
				className="h-full"
				title="This worker is not on this install"
				description="It may have stopped and been removed. Close this page, or pick a worker in Workers."
			/>
		);

	const canDrain = w.state !== "stopped" && w.state !== "draining";
	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<Icon />}
				crumbs={[
					opener
						? {
								label: SECTIONS.workers.label,
								onClick: () => opener.section("workers", "pools"),
							}
						: SECTIONS.workers.label,
					{ label: w.pool, onClick: () => onOpenPool(w.pool) },
					w.name,
				]}
				chips={
					<>
						<WorkerStateChip state={w.state} />
						<span className="text-sm text-muted-foreground">
							{w.pool} · {w.node} · {w.version}
						</span>
					</>
				}
				actions={
					canDrain ? (
						<DrainButton
							label="Drain this worker"
							title={`Drain ${w.name}?`}
							description="It stops taking steps, finishes what it holds, then stops."
							pending={drain.isPending}
							error={drain.error}
							onConfirm={() => drain.mutate(w.name)}
						/>
					) : null
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				<div className="flex flex-col gap-2.5">
					<MetricGrid minTileWidth={160}>
						<MetricTile
							label="Slots"
							value={slotsOf(w.slots_busy, w.slots)}
							caption={w.state}
							captionTone="muted"
						/>
						<MetricTile
							label="Steps · 1 h"
							value={w.steps_1h}
							caption={`${w.failed_1h} failed`}
							captionTone={w.failed_1h > 0 ? "warning" : "muted"}
						/>
						<MetricTile label="p95 a step" value={millis(w.p95_ms)} />
						<MetricTile
							label="Up"
							value={span(w.up_s)}
							caption={`since ${whenOf(w.joined_at)}`}
							captionTone="muted"
						/>
					</MetricGrid>

					<div className="grid items-start gap-2.5 lg:grid-cols-2">
						<PanelSection card title="Running now">
							<DataTable
								columns={stepColumns}
								data={w.running}
								enableSorting={false}
								getRowId={(row) => `${row.run_id}:${row.function}`}
								emptyState={
									w.note ??
									(w.slots_busy > 0
										? "No step reported to this engine"
										: "Nothing — it is idle")
								}
							/>
						</PanelSection>

						<PanelSection card title="CPU · last 30 min">
							<LineChart
								values={w.cpu_series.map((p) => p.cpu)}
								labels={w.cpu_series.map((p) => clockOf(p.at).slice(0, 5))}
								max={100}
								format={(v) => `${v}%`}
								empty="No CPU reading in the last 30 minutes"
							/>
						</PanelSection>
					</div>

					<PanelSection card title="Log">
						{w.log.length ? (
							<CodeBlock
								value={w.log
									.map((l) => `${clockOf(l.at)} ${l.line}`)
									.join("\n")}
								language="plain"
							/>
						) : (
							<p className="text-muted-foreground">Nothing logged yet.</p>
						)}
					</PanelSection>
				</div>
			</div>
		</div>
	);
}
