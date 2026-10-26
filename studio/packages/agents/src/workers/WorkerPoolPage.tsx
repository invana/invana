/**
 * A worker pool's page — `worker_pool:<name>` in `mainSection`.
 *
 * *As an install admin, I want every worker in one pool — its state, the step
 * it runs, its slots, heartbeat and CPU — so that I see where the pool is
 * short and drain what I must.*
 */

import { EmptyState, RecordHeader, Spinner } from "@invana/ui";
import { DetailStatus } from "@invana-studio/ui";
import { useContext, useState } from "react";
import { AgentsOpenContext } from "../open";
import { SECTIONS } from "../sections/spec";
import { DrainButton } from "./DrainButton";
import { labelsText, PoolStateChip, StateChips, WorkersTable } from "./parts";
import { useDrainPoolMutation, usePoolQuery, useWorkersQuery } from "./queries";

const RUNS_ON_LABEL = {
	docker: "Docker",
	python: "Python",
	kubernetes: "Kubernetes",
} as const;

/** One worker pool — every worker in it. */
export function WorkerPoolPage({
	pool,
	onOpenWorker,
}: {
	pool: string;
	onOpenWorker: (name: string) => void;
}) {
	const opener = useContext(AgentsOpenContext);
	const record = usePoolQuery(pool);
	const drain = useDrainPoolMutation();
	const [state, setState] = useState("");
	const p = record.data;
	const workers = useWorkersQuery({ pool: p?.id ?? "", state });
	const Icon = SECTIONS.workers.icon;

	if (record.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!p)
		return (
			<EmptyState
				className="h-full"
				title="This pool is not on this install"
				description="It may have been removed. Close this page, or pick a pool in Workers."
			/>
		);

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
					p.name,
				]}
				chips={
					<>
						<PoolStateChip state={p.state} />
						<DetailStatus>{RUNS_ON_LABEL[p.runs_on]}</DetailStatus>
						<span className="text-sm text-muted-foreground">
							{p.workers} {p.workers === 1 ? "worker" : "workers"} ·{" "}
							{labelsText(p.labels)} ·{" "}
							{p.set_by === "replicas"
								? "replicas set by you"
								: "scaled by hand"}
						</span>
					</>
				}
				actions={
					<DrainButton
						label="Drain"
						title={`Drain ${p.name}?`}
						description="Every worker in the pool stops taking steps, finishes what it holds, then stops. Redeploy or add workers to bring capacity back."
						pending={drain.isPending}
						error={drain.error}
						onConfirm={() => drain.mutate(p.name)}
					/>
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				<div className="flex flex-col gap-2.5">
					<StateChips
						counts={workers.data?.counts}
						value={state}
						onChange={setState}
					/>
					{workers.data ? (
						<WorkersTable
							page={workers.data}
							onOpen={(w) => onOpenWorker(w.name)}
							empty={
								<EmptyState
									title={
										state ? `No ${state} workers in ${p.name}` : "No workers"
									}
									description="Add workers to this pool from Workers."
								/>
							}
						/>
					) : (
						<Spinner />
					)}
				</div>
			</div>
		</div>
	);
}
