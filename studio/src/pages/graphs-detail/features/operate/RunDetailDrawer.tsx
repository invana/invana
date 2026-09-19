/**
 * A run, read end to end in the drawer — **version C** ([§3b](../../../../../docs/for-developers/building-studio/graph-detail-page.md)).
 *
 * Three bands, and nothing else is needed to read a run:
 *
 * | Band | Answers |
 * |---|---|
 * | `Stats` | *what happened* — written, reported, duration, retries, lanes, cost |
 * | `Performance` | *where did the time go* — the Gantt, one row per Task on the run's own clock |
 * | `Log` | *why* — live, tailing, filterable by task and level, taking the height that is left |
 *
 * **A run in flight and a run that finished are the same three bands** (SR16).
 * The Gantt grows a *now* line and an unfilled bar, Stats climb, the log tails,
 * and the foot offers `Cancel` while the run is non-terminal — there is no
 * separate live view to build or to keep honest.
 *
 * **Picking a Task filters the log to it** (SR15). A Gantt row and a log line
 * are the same Task seen twice, and they say the same word for it because the
 * engine stamps each line with the `task_key` its trace gave the step — so the
 * debugging loop (*which one was slow → what did it say*) never leaves the
 * column.
 *
 * **And it stays an overview.** The task table, the flow, the full log, what
 * landed and `result.json` are `More`, and `More` opens the **run dashboard**
 * as a page (SR13 · SR36) — a panel that tried to be the dashboard would be a
 * dashboard in 420px.
 */

import { formatDuration } from "@/lib/time";
import { runsApi } from "@/services/api/runs";
import type { RunNode } from "@/types/run";
import {
	Button,
	Eyebrow,
	MetricGrid,
	MetricTile,
	Spinner,
	TaskGantt,
	type TaskGanttStatus,
	type TaskGanttTask,
} from "@invana/ui";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { useMemo, useState } from "react";

const LIVE_STATUSES = new Set(["queued", "running"]);

export interface RunDetailDrawerProps {
	username: string;
	graphSlug: string;
	runId: string;
	/** `More` — opens this run's dashboard as a page (SR13). */
	onOpenDashboard?: (runId: string) => void;
}

export function RunDetailDrawer({
	username,
	graphSlug,
	runId,
	onOpenDashboard,
}: RunDetailDrawerProps) {
	// **One detail for every kind of run.** There used to be two, chosen by
	// looking the id up in the journal, because an import job id and a run id
	// looked alike and only the row knew which was which. There is one record
	// now, so there is nothing to discriminate
	// (task-model-migration.md § 6.7).
	return (
		<RunDetail
			username={username}
			graphSlug={graphSlug}
			id={runId}
			onOpenDashboard={onOpenDashboard}
		/>
	);
}

/**
 * One run — its stats and where the time went.
 *
 * **No Log band and no Reported band yet.** A run's lines go to `run_logs`
 * (LD17) and a load's rejections are `snapshot_model`'s grouped report, and
 * neither is on `/runs/{id}` — SR17's `result.json` is what exposes them, and
 * it arrives with S4. What a reader comes here for now is *which Tasks ran and
 * where the time went*, and that is the Gantt, which reads the same trace for
 * every kind of run (SR21).
 */
function RunDetail({
	username,
	graphSlug,
	id,
	onOpenDashboard,
}: {
	username: string;
	graphSlug: string;
	id: string;
	onOpenDashboard?: (runId: string) => void;
}) {
	const trace = useQuery({
		queryKey: ["runs", username, graphSlug, id] as const,
		queryFn: () => runsApi.get(username, graphSlug, id),
	});
	const [task, setTask] = useState<string | null>(null);
	const steps = trace.data?.steps ?? [];
	const live = LIVE_STATUSES.has(trace.data?.status ?? "");

	const tasks: TaskGanttTask[] = useMemo(
		() =>
			steps.map((s) => ({
				key: s.taskKey,
				label: s.label || s.taskKey,
				status: s.status as TaskGanttStatus,
				startedAt: s.startedAt,
				finishedAt: s.finishedAt,
				log: s.detail || undefined,
				result: s.output,
				error: s.error
					? {
							code: s.error.cls,
							message: s.error.message,
							detail: s.error.cause,
						}
					: undefined,
			})),
		[steps],
	);

	if (trace.isLoading) {
		return (
			<div className="p-4">
				<Spinner />
			</div>
		);
	}
	if (!trace.data) {
		return (
			<p className="p-4 text-sm text-muted-foreground">
				This run's trace has been pruned.
			</p>
		);
	}

	const done = steps.filter((s) => s.finishedAt).length;
	const retried = steps.filter((s) => s.attempt > 1);
	const first = steps.find((s) => s.startedAt)?.startedAt ?? null;
	const last =
		[...steps].reverse().find((s) => s.finishedAt)?.finishedAt ?? null;
	const ms = durationMs(first, last);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 border-b p-3">
				<Eyebrow>Stats</Eyebrow>
				<MetricGrid minTileWidth={110} className="mt-1.5">
					<MetricTile
						label="Tasks"
						value={steps.length}
						caption={`${done} finished`}
					/>
					<MetricTile
						label="Duration"
						value={ms == null ? "—" : formatDuration(ms)}
						caption={trace.data.status}
					/>
					<MetricTile
						label="Retries"
						value={retried.length}
						caption={retried.length ? retried[0].taskKey : "none"}
					/>
					<MetricTile
						label="Cost"
						value={tokensOf(steps) ? "—" : "$0.00"}
						caption={tokensOf(steps) ? "tokens only" : "no llm"}
					/>
				</MetricGrid>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto p-3">
				<Eyebrow aside={performanceAside(steps, task)}>Performance</Eyebrow>
				{tasks.length ? (
					<TaskGantt
						className="mt-1.5"
						tasks={tasks}
						origin={first ?? undefined}
						density="compact"
						labelWidth={112}
						nowMs={live ? Date.now() : undefined}
						openEnded={live}
						selectedKey={task}
						onSelectTask={(key) => setTask((c) => (c === key ? null : key))}
					/>
				) : (
					<p className="mt-1.5 text-sm text-muted-foreground">
						No Tasks recorded for this run.
					</p>
				)}
			</div>

			{onOpenDashboard ? (
				<div className="shrink-0 border-t p-2">
					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() => onOpenDashboard(id)}
					>
						<LayoutDashboard className="h-4 w-4" />
						More
					</Button>
				</div>
			) : null}
		</div>
	);
}

function performanceAside(steps: RunNode[], selected: string | null) {
	if (selected) {
		const slowest = [...steps]
			.map((t) => [t, durationMs(t.startedAt, t.finishedAt) ?? -1] as const)
			.sort((a, b) => b[1] - a[1])[0];
		if (!slowest || slowest[1] < 0) return undefined;
		return `slowest ${slowest[0].taskKey} · ${formatDuration(slowest[1])}`;
	}
	const retried = steps.filter((t) => t.attempt > 1).length;
	const never = steps.filter((t) => t.status === "stopped").length;
	const parts = [
		retried ? `${retried} retried` : null,
		never ? `${never} never ran` : null,
	].filter(Boolean);
	return parts.length ? parts.join(" · ") : undefined;
}

function durationMs(
	from: string | Date | null | undefined,
	to: string | Date | null | undefined,
): number | null {
	if (!from) return null;
	const a = new Date(from).getTime();
	const b = to ? new Date(to).getTime() : Date.now();
	return Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
}

function tokensOf(steps: RunNode[]): number {
	return steps.reduce((n, s) => n + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);
}
