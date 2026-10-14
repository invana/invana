/**
 * **Coming up** — the Schedules tab's first card: seven day columns from
 * today, one row per active schedule (*name · cron as words*), and a dot on
 * each day its cron fires.
 *
 * Days are read in the browser's zone, one calendar day at a time
 * (`firesOn`), so a row says *which days*, not the minute. The dot turns
 * `error` when the schedule's last firing failed, so a schedule that keeps
 * failing reads as a red row before anyone opens it. Paused schedules are
 * left out: nothing of theirs is coming up.
 */

import {
	Card,
	SectionHeader,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { useMemo } from "react";
import { cronWords, firesOn } from "./cron";
import { useFiringsQuery } from "./queries";
import type { Schedule } from "./types";

/** Today and the six days after it, at local noon. */
function week(): Date[] {
	const today = new Date();
	return Array.from(
		{ length: 7 },
		(_, i) =>
			new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12),
	);
}

const dayLabel = (d: Date) =>
	d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

export function ComingUp({
	graph,
	schedules,
}: {
	graph: GraphRef;
	schedules: Schedule[];
}) {
	const days = useMemo(week, []);
	const active = schedules.filter((s) => s.status === "active");
	return (
		<Card className="overflow-hidden">
			<SectionHeader title="Coming up" count="next 7 days" className="px-4" />
			{active.length === 0 ? (
				<p className="px-4 py-3 text-muted-foreground">
					Nothing is coming up — every schedule is paused.
				</p>
			) : (
				<Table density="compact" aria-label="Coming up">
					<TableHeader>
						<TableRow>
							<TableHead>Schedule</TableHead>
							{days.map((d) => (
								<TableHead key={d.toISOString()}>{dayLabel(d)}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{active.map((s) => (
							<ComingUpRow key={s.id} graph={graph} schedule={s} days={days} />
						))}
					</TableBody>
				</Table>
			)}
		</Card>
	);
}

function ComingUpRow({
	graph,
	schedule,
	days,
}: {
	graph: GraphRef;
	schedule: Schedule;
	days: Date[];
}) {
	const last = useFiringsQuery(graph, schedule.id, 1).data?.items[0];
	const failed = last?.outcome === "failed";
	return (
		<TableRow>
			<TableCell className="truncate">
				{schedule.name} · {cronWords(schedule.cron)}
			</TableCell>
			{days.map((d) => (
				<TableCell key={d.toISOString()}>
					{firesOn(schedule.cron, d) ? (
						<StatusDot
							tone={failed ? "error" : "success"}
							label={`${schedule.name} fires ${dayLabel(d)}${failed ? " · last run failed" : ""}`}
						/>
					) : null}
				</TableCell>
			))}
		</TableRow>
	);
}
