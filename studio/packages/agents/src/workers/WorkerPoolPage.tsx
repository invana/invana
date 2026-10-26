/**
 * A worker pool's page — `worker_pool:<name>` in `mainSection`, with three
 * tabs: Workers · Capacity · Join tokens, each the pool's own slice of the
 * Workers section's tab of that name.
 *
 * *As an install admin, I want every worker in one pool — its state, the step
 * it runs, its slots, heartbeat and CPU — so that I see where the pool is
 * short and drain what I must.*
 */

import {
	EmptyState,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { formatGrouped, useUpdateSearchParams } from "@invana-studio/core";
import { DetailStatus, PanelSection } from "@invana-studio/ui";
import { useContext, useState } from "react";
import { AgentsOpenContext } from "../open";
import { SECTIONS } from "../sections/spec";
import { stateLine } from "./CapacityTab";
import { DrainButton } from "./DrainButton";
import { EventsCard } from "./PoolsTab";
import { labelsText, StateChips, span, WorkersTable } from "./parts";
import {
	useCapacityQuery,
	useDrainPoolMutation,
	usePoolQuery,
	useWorkersQuery,
} from "./queries";
import { TokensTab } from "./TokensTab";

const TABS = [
	{ value: "workers", label: "Workers" },
	{ value: "capacity", label: "Capacity" },
	{ value: "tokens", label: "Join tokens" },
] as const;
type PoolTab = (typeof TABS)[number]["value"];

/** The pool's line of Capacity, and its events. */
function PoolCapacity({ poolId }: { poolId: string }) {
	const capacity = useCapacityQuery();
	const row = capacity.data?.rows.find((r) => r.pool_id === poolId);
	return (
		<>
			<PanelSection card title="Capacity">
				{row ? (
					<PropertyList labelWidth={150}>
						<PropertyRow label="Ready steps">
							{formatGrouped(row.ready)}
						</PropertyRow>
						<PropertyRow label="Oldest">{span(row.oldest_s)}</PropertyRow>
						<PropertyRow label="Workers">{row.workers}</PropertyRow>
						<PropertyRow label="Suggested">{row.suggested}</PropertyRow>
						<PropertyRow label="State">{stateLine(row)}</PropertyRow>
					</PropertyList>
				) : (
					<Spinner />
				)}
			</PanelSection>
			<EventsCard withActor pool={poolId} />
		</>
	);
}

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
	const update = useUpdateSearchParams();
	const [tab, setTab] = useState<PoolTab>("workers");
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
			<Tabs
				size="sm"
				value={tab}
				onValueChange={(v) => setTab(v as PoolTab)}
				className="px-3.5 pt-2"
			>
				<TabsList aria-label={`${p.name} views`}>
					{TABS.map((t) => (
						<TabsTrigger key={t.value} value={t.value}>
							{t.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				{tab === "capacity" ? (
					<div className="flex flex-col gap-2.5">
						<PoolCapacity poolId={p.id} />
					</div>
				) : tab === "tokens" ? (
					<div className="flex flex-col gap-2.5">
						<TokensTab
							pool={p.id}
							onAdd={() =>
								// Back to the section, where Add workers opens on this pool.
								update((params) => {
									params.delete("page");
									params.set("add", "where");
									params.set("pool", p.name);
									return params;
								})
							}
						/>
					</div>
				) : (
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
				)}
			</div>
		</div>
	);
}
