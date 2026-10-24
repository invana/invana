/**
 * One schedule's page (board `shell.schedule.detail`), at
 * `/activity/schedules/<id>` inside the Schedules tab.
 *
 * The header names the schedule and its agent, with the cron as words and
 * *next in …* — or *paused* — as badges, and the acts: **Run now** (a firing
 * like any other; the clock opens its run within a minute, which the page
 * says), **Pause** or **Resume**, **Edit** (`ScheduleDialog`) and **Delete**
 * (confirmed, then `onDeleted`). Under it three cards: **Instructions**, as
 * written · **Firings**, newest first, each with when it was due, its
 * outcome, *catch-up* or *run now* when so, the reason, and *Open run* ·
 * **Delivers to**, In app and each of the Graph's channels, on or off.
 *
 * It reads the schedule through `useScheduleQuery`, the same key the
 * breadcrumb names the page from. A schedule that no longer exists draws an
 * `EmptyState` saying so. Every act shows regardless of role; a refusal is
 * the engine's reason, written under the header.
 */

import {
	Badge,
	Button,
	EmptyState,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	RecordHeader,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ApiError, type GraphRef } from "@invana-studio/core";
import { FormError, PanelSection } from "@invana-studio/ui";
import { CalendarClock, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActButton } from "../../access/ActButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { refusalOf } from "../notifications/api";
import { CHANNEL_KIND_LABEL } from "../notifications/DeliveryPicker";
import { cronWords, nextIn } from "./cron";
import {
	useDeleteSchedule,
	useFiringsQuery,
	usePauseSchedule,
	useResumeSchedule,
	useRunScheduleNow,
	useScheduleQuery,
} from "./queries";
import { ScheduleDialog } from "./ScheduleDialog";
import type { Firing, FiringOutcome, Schedule } from "./types";
import { useScheduleNames } from "./useScheduleNames";

export interface SchedulePageProps {
	graph: GraphRef;
	scheduleId: string;
	/** After *Delete*: back to the Schedules tab. */
	onDeleted: () => void;
	/** *Open run* on a firing. */
	onOpenRun: (runId: string) => void;
}

const when = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "—";

export function SchedulePage({
	graph,
	scheduleId,
	onDeleted,
	onOpenRun,
}: SchedulePageProps) {
	const query = useScheduleQuery(graph, scheduleId);

	if (query.isLoading) {
		return (
			<div className="flex flex-col gap-3 p-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}
	if (!query.data) {
		const gone = query.error instanceof ApiError && query.error.status === 404;
		return (
			<EmptyState
				className="h-full"
				icon={<CalendarClock className="size-6" />}
				title={
					gone
						? "This schedule no longer exists"
						: "This schedule could not be read"
				}
				description={
					gone
						? "It may have been deleted, or the link may be from another Graph."
						: refusalOf(query.error, "The schedule did not load.")
				}
				actions={
					gone ? null : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => void query.refetch()}
						>
							Try again
						</Button>
					)
				}
			/>
		);
	}
	return (
		<ScheduleBody
			graph={graph}
			schedule={query.data}
			onDeleted={onDeleted}
			onOpenRun={onOpenRun}
		/>
	);
}

function ScheduleBody({
	graph,
	schedule,
	onDeleted,
	onOpenRun,
}: {
	graph: GraphRef;
	schedule: Schedule;
	onDeleted: () => void;
	onOpenRun: (runId: string) => void;
}) {
	const { agentName } = useScheduleNames(graph);
	const firings = useFiringsQuery(graph, schedule.id);
	const runNow = useRunScheduleNow(graph);
	const pause = usePauseSchedule(graph);
	const resume = useResumeSchedule(graph);
	const remove = useDeleteSchedule(graph);
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const paused = schedule.status === "paused";
	const lastFailed = firings.data?.items[0]?.outcome === "failed";
	const refused = runNow.error ?? pause.error ?? resume.error ?? remove.error;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				size="lg"
				tone={paused ? "muted" : lastFailed ? "error" : "success"}
				crumbs={[schedule.name]}
				chips={
					<>
						<span className="text-muted-foreground">
							{agentName(schedule.agent_id)}
						</span>
						<Badge variant="outline">{cronWords(schedule.cron)}</Badge>
						<Badge variant="outline" tone={paused ? "warning" : undefined}>
							{paused ? "paused" : nextIn(schedule.next_fire_at)}
						</Badge>
					</>
				}
				actions={
					<>
						<ActButton
							area="work"
							variant="outline"
							size="sm"
							disabled={runNow.isPending}
							onClick={() => runNow.mutate(schedule.id)}
						>
							<Play />
							Run now
						</ActButton>
						{paused ? (
							<ActButton
								area="work"
								variant="ghost"
								size="sm"
								disabled={resume.isPending}
								onClick={() => resume.mutate(schedule.id)}
							>
								<Play />
								Resume
							</ActButton>
						) : (
							<ActButton
								area="work"
								variant="ghost"
								size="sm"
								disabled={pause.isPending}
								onClick={() => pause.mutate(schedule.id)}
							>
								<Pause />
								Pause
							</ActButton>
						)}
						<ActButton
							area="work"
							variant="ghost"
							size="sm"
							onClick={() => setEditing(true)}
						>
							<Pencil />
							Edit
						</ActButton>
						<ActButton
							area="work"
							variant="ghost"
							size="sm"
							onClick={() => setConfirming(true)}
						>
							<Trash2 />
							Delete
						</ActButton>
					</>
				}
			/>
			<div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
				{runNow.isSuccess ? (
					<p role="status" className="text-muted-foreground">
						Queued — the run opens within a minute.
					</p>
				) : null}
				<FormError error={refused ? refusalOf(refused) : null} />
				<div className="grid gap-3 lg:grid-cols-2">
					<div className="space-y-3">
						<PanelSection card title="Instructions">
							<p className="whitespace-pre-wrap">{schedule.instructions}</p>
						</PanelSection>
						<DeliversTo graph={graph} schedule={schedule} />
					</div>
					<PanelSection
						card
						title="Firings"
						hint={firings.data ? String(firings.data.total) : undefined}
					>
						<FiringsList
							firings={firings.data?.items}
							loading={firings.isLoading}
							next={paused ? null : schedule.next_fire_at}
							onOpenRun={onOpenRun}
						/>
					</PanelSection>
				</div>
			</div>

			<ScheduleDialog
				graph={graph}
				open={editing}
				schedule={schedule}
				onClose={() => setEditing(false)}
			/>
			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				destructive
				title={`Delete ${schedule.name}?`}
				description="Its firings go with it. Runs it opened stay in Runs."
				confirmLabel="Delete"
				onConfirm={() => remove.mutate(schedule.id, { onSuccess: onDeleted })}
			/>
		</div>
	);
}

const OUTCOME_TONE: Record<
	FiringOutcome,
	"success" | "destructive" | "muted" | "info"
> = {
	queued: "info",
	opened: "success",
	skipped: "muted",
	failed: "destructive",
};

function FiringsList({
	firings,
	loading,
	next,
	onOpenRun,
}: {
	firings: Firing[] | undefined;
	loading: boolean;
	next: string | null;
	onOpenRun: (runId: string) => void;
}) {
	if (loading) return <Skeleton className="h-24 w-full" />;
	if (!firings?.length) {
		return (
			<p className="text-muted-foreground">
				{next
					? `No firings yet — the next is ${when(next)}.`
					: "No firings yet — the schedule is paused."}
			</p>
		);
	}
	return (
		<Table density="compact" aria-label="Firings">
			<TableHeader>
				<TableRow>
					<TableHead>Due</TableHead>
					<TableHead>Outcome</TableHead>
					<TableHead className="w-full">Reason</TableHead>
					<TableHead />
				</TableRow>
			</TableHeader>
			<TableBody>
				{firings.map((f) => (
					<TableRow key={f.id}>
						<TableCell className="whitespace-nowrap">
							{when(f.due_at)}
						</TableCell>
						<TableCell className="whitespace-nowrap">
							<Badge variant="soft" tone={OUTCOME_TONE[f.outcome]}>
								{f.outcome}
							</Badge>
							{f.catch_up ? (
								<Badge variant="outline" className="ml-1">
									catch-up
								</Badge>
							) : null}
							{f.manual ? (
								<Badge variant="outline" className="ml-1">
									run now
								</Badge>
							) : null}
						</TableCell>
						<TableCell className="text-muted-foreground">
							{f.reason || "—"}
						</TableCell>
						<TableCell>
							{f.run_id ? (
								<Button
									variant="outline"
									size="xs"
									onClick={() => onOpenRun(f.run_id as string)}
								>
									Open run
								</Button>
							) : null}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/** In app and each of the Graph's channels, on when the schedule names it. */
function DeliversTo({
	graph,
	schedule,
}: {
	graph: GraphRef;
	schedule: Schedule;
}) {
	const { channels } = useScheduleNames(graph);
	const rows = [
		{
			id: "in_app",
			title: "In app",
			description: "in each recipient's Inbox",
			on: schedule.deliver_in_app,
		},
		...channels.map((c) => ({
			id: c.id,
			title: c.name,
			description: `${CHANNEL_KIND_LABEL[c.kind] ?? c.kind} · ${c.target}`,
			on: schedule.channel_ids.includes(c.id),
		})),
	];
	const on = rows.filter((r) => r.on).length;
	return (
		<PanelSection card title="Delivers to" hint={`${on} of ${rows.length}`}>
			<ItemGroup>
				{rows.map((r) => (
					<Item key={r.id} size="sm" dim={!r.on}>
						<ItemContent className="min-w-0">
							<ItemTitle>{r.title}</ItemTitle>
							<ItemDescription className="truncate">
								{r.description}
							</ItemDescription>
						</ItemContent>
						<ItemActions>
							<Badge variant="outline" tone={r.on ? "success" : "muted"}>
								{r.on ? "on" : "off"}
							</Badge>
						</ItemActions>
					</Item>
				))}
			</ItemGroup>
		</PanelSection>
	);
}
