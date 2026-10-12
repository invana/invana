/**
 * Activity › Schedules (board `shell.schedules`) — what runs itself on this
 * Graph.
 *
 * Two cards. **Coming up** draws the next seven days, a dot on each day an
 * active schedule fires (`ComingUp`). **Schedules** lists every schedule:
 * its name, then *cron as words · agent · delivery · next in …*, and
 * *failed last run* or *paused* when so; a row opens the schedule's page
 * through `onOpenSchedule`. *New schedule* sits on that card's header and
 * opens `ScheduleDialog`; once the engine accepts it, the new schedule's
 * page opens.
 *
 * No schedules draws the kit's `EmptyState` — *Nothing is scheduled* — with
 * *New schedule* as its action. Loading draws skeletons; a failed read
 * draws an `EmptyState` with *Try again*. Every act shows regardless of role:
 * a refused write says the engine's reason in the dialog.
 */

import {
	Button,
	Card,
	EmptyState,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	SectionHeader,
	Skeleton,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { CalendarClock, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ComingUp } from "./ComingUp";
import { cronWords, nextIn } from "./cron";
import { useFiringsQuery, useSchedulesQuery } from "./queries";
import { ScheduleDialog } from "./ScheduleDialog";
import type { Schedule } from "./types";
import { useScheduleNames } from "./useScheduleNames";

export interface SchedulesTabProps {
	graph: GraphRef;
	/** A row opens that schedule's page. */
	onOpenSchedule: (id: string) => void;
}

export function SchedulesTab({ graph, onOpenSchedule }: SchedulesTabProps) {
	const list = useSchedulesQuery(graph);
	const [creating, setCreating] = useState(false);

	const newButton = (
		<Button size="sm" onClick={() => setCreating(true)}>
			<Plus />
			New schedule
		</Button>
	);
	const dialog = (
		<ScheduleDialog
			graph={graph}
			open={creating}
			onClose={() => setCreating(false)}
			onSaved={(s) => onOpenSchedule(s.id)}
		/>
	);

	// The dialog keeps one place in the tree, so the list filling in under it
	// (the first schedule replacing the empty state) never remounts it.
	return (
		<>
			<SchedulesBody
				graph={graph}
				list={list}
				newButton={newButton}
				onOpenSchedule={onOpenSchedule}
			/>
			{dialog}
		</>
	);
}

function SchedulesBody({
	graph,
	list,
	newButton,
	onOpenSchedule,
}: {
	graph: GraphRef;
	list: ReturnType<typeof useSchedulesQuery>;
	newButton: ReactNode;
	onOpenSchedule: (id: string) => void;
}) {
	const items = list.data?.items ?? [];
	if (list.isLoading) {
		return (
			<div className="flex flex-col gap-2 p-4">
				{["a", "b", "c"].map((k) => (
					<Skeleton key={k} className="h-12 w-full" />
				))}
			</div>
		);
	}
	if (list.isError) {
		return (
			<EmptyState
				className="h-full"
				icon={<CalendarClock className="size-6" />}
				title="The schedules could not be read"
				description="The Graph's schedules did not load."
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={() => void list.refetch()}
					>
						Try again
					</Button>
				}
			/>
		);
	}
	if (items.length === 0) {
		return (
			<EmptyState
				className="h-full"
				icon={<CalendarClock className="size-6" />}
				title="Nothing is scheduled"
				description="A schedule runs an agent on plain instructions — a digest, a morning plan — and delivers what it finds to the Inbox or a channel."
				actions={newButton}
			/>
		);
	}

	const pausedCount = items.filter((s) => s.status === "paused").length;
	return (
		<div className="flex h-full flex-col gap-3 overflow-auto p-4">
			<ComingUp graph={graph} schedules={items} />
			<Card className="overflow-hidden">
				<SectionHeader
					title="Schedules"
					count={
						pausedCount
							? `${items.length} · ${pausedCount} paused`
							: items.length
					}
					actions={newButton}
					className="px-4"
				/>
				<ItemGroup className="p-2">
					{items.map((s) => (
						<ScheduleRow
							key={s.id}
							graph={graph}
							schedule={s}
							onOpen={() => onOpenSchedule(s.id)}
						/>
					))}
				</ItemGroup>
			</Card>
		</div>
	);
}

function ScheduleRow({
	graph,
	schedule,
	onOpen,
}: {
	graph: GraphRef;
	schedule: Schedule;
	onOpen: () => void;
}) {
	const { agentName, delivery } = useScheduleNames(graph);
	const last = useFiringsQuery(graph, schedule.id, 1).data?.items[0];
	const paused = schedule.status === "paused";
	const facts = [
		cronWords(schedule.cron),
		agentName(schedule.agent_id),
		delivery(schedule),
		...(paused ? [] : [nextIn(schedule.next_fire_at)]),
	].join(" · ");
	return (
		<Item variant="muted" dim={paused}>
			<ItemContent className="min-w-0">
				<ItemTitle className="truncate">{schedule.name}</ItemTitle>
				<ItemDescription>
					{facts}
					{paused ? " · paused" : null}
					{last?.outcome === "failed" ? (
						<>
							{" · "}
							<span className="text-destructive">failed last run</span>
						</>
					) : null}
				</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Button
					variant="outline"
					size="sm"
					aria-label={`Open ${schedule.name}`}
					onClick={onOpen}
				>
					Open
				</Button>
			</ItemActions>
		</Item>
	);
}
