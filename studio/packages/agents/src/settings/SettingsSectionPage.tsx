/**
 * **Settings** — this Graph's agent settings, as a section page at
 * `/agents/settings` ([concurrency-and-contention.md](../../../../../docs/for-developers/modules/agents/features/concurrency-and-contention.md) ·
 * [the-agents-shell.md](../../../../../docs/for-developers/modules/agents/features/the-agents-shell.md)).
 *
 * *As the person who set this Graph's ceiling, I want the ceiling beside what
 * it is holding back, so that "why is my run waiting?" is answered where the
 * number is set.*
 *
 * - **Runs at once** — the ceiling, queue or refuse at it, *Save*. The first
 *   card.
 * - **Now** — running against the ceiling, and how many are queued.
 * - **Queued behind the ceiling** — each queued run, its place and why it
 *   waits; a run opens its page.
 * - **Pools** — every configured pool, busy or quiet. They stay here until
 *   Workers holds them.
 *
 * Every number is the engine's contention read, polled while the page is open
 * because the queue lives in the runtime and changes without anything else
 * changing.
 */

import {
	Button,
	PropertyList,
	PropertyRow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	formatRelativeTime,
	type GraphContention,
	graphsApi,
} from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { ConcurrencyFields } from "./ConcurrencyFields";
import { PoolsTable } from "./PoolsTable";

type Queued = GraphContention["queued"][number];

export function SettingsSectionPage({
	username,
	graphSlug,
	tab,
	onTab,
}: SectionPageProps) {
	const contention = useQuery({
		queryKey: ["contention", username, graphSlug] as const,
		queryFn: () => graphsApi.contention(username, graphSlug),
		refetchInterval: 5_000,
	});
	const data = contention.data;

	return (
		<SectionPage section="concurrency" tab={tab} onTab={onTab}>
			<SectionBody>
				<div className="grid items-start gap-3 lg:grid-cols-2">
					<div className="flex flex-col gap-2">
						<PanelSection card title="Runs at once">
							<ConcurrencyFields username={username} graphSlug={graphSlug} />
						</PanelSection>
						<p className="text-sm text-muted-foreground">
							Limits on one agent are on its own page; the pools are below until
							Workers holds them.
						</p>
					</div>
					<div className="flex flex-col gap-3">
						{data ? (
							<>
								<PanelSection card title="Now">
									<PropertyList>
										<PropertyRow label="Running">
											{data.ceiling
												? `${data.running_count} of ${data.ceiling}`
												: `${data.running_count} · no ceiling`}
										</PropertyRow>
										<PropertyRow label="Queued">
											{data.queued_count}
										</PropertyRow>
									</PropertyList>
								</PanelSection>
								<PanelSection card title="Queued behind the ceiling">
									<QueuedRuns queued={data.queued} />
								</PanelSection>
							</>
						) : (
							<FleetReadState
								loading={contention.isLoading}
								error={contention.error}
								what="what runs now"
							/>
						)}
					</div>
				</div>
				{data ? (
					<PanelSection card title="Pools">
						<PoolsTable pools={data.pools} />
					</PanelSection>
				) : null}
			</SectionBody>
		</SectionPage>
	);
}

function QueuedRuns({ queued }: { queued: Queued[] }) {
	const open = useAgentsOpen();
	if (!queued.length)
		return (
			<p className="py-2 text-muted-foreground">
				Nothing is waiting — every run has a slot.
			</p>
		);
	return (
		<Table bordered={false} density="compact">
			<TableHeader>
				<TableRow>
					<TableHead>Queued</TableHead>
					<TableHead>Run</TableHead>
					<TableHead className="whitespace-nowrap">Waiting because</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{queued.map((run) => (
					<TableRow key={run.run_id}>
						<TableCell className="whitespace-nowrap text-warning">
							#{run.position}
						</TableCell>
						<TableCell className="whitespace-nowrap">
							<Button
								variant="link"
								size="sm"
								className="h-auto p-0 font-mono"
								onClick={() => open.run(run.run_id)}
							>
								{run.run_id.slice(0, 8)}
							</Button>
							<span className="text-muted-foreground">
								{" "}
								· queued {formatRelativeTime(new Date(run.queued_at))}
							</span>
						</TableCell>
						<TableCell className="w-full">{waitingBecause(run)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/** Why this run is waiting, in the words that decide what to do about it. */
function waitingBecause(run: Queued): string {
	return run.triggered_by === "user" || run.triggered_by === "person"
		? "a person is waiting"
		: `triggered by ${run.triggered_by}`;
}
