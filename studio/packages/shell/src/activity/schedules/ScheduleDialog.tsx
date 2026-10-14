/**
 * **New schedule** and **Edit** — one dialog (boards `shell.schedule.new`).
 *
 * Without `schedule` it creates; with one it patches that schedule. The
 * fields, in order: Name · What to do (plain instructions) · Runs as (one of
 * the Graph's agents) · Repeat (Daily · Weekdays · Weekly on a day · Monthly
 * on a date · Custom cron) and a time · Time zone (the browser's, or UTC — and
 * on Edit the schedule's own) · Deliver to (`DeliveryPicker`) · If a firing is
 * missed · If the last run is still going · Outward approval.
 *
 * There is no sources, tools or project picker: sources are written in the
 * instructions, tools are the agent's, and a schedule needs no project.
 * Nothing is checked here beyond the fields being filled — a bad cron, an
 * unknown zone, a missing agent or channel is the engine's to refuse, and its
 * reason shows inline above the footer.
 *
 * ```tsx
 * <ScheduleDialog graph={graph} open={open} onClose={close}
 *   onSaved={(s) => onOpenSchedule(s.id)} />
 * ```
 */

import {
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Textarea,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { refusalOf } from "../notifications/api";
import { DeliveryPicker } from "../notifications/DeliveryPicker";
import {
	cronOf,
	type Repeat,
	type RepeatKind,
	repeatOf,
	WEEKDAYS,
} from "./cron";
import { useCreateSchedule, useUpdateSchedule } from "./queries";
import type {
	MissedPolicy,
	OverlapPolicy,
	Schedule,
	ScheduleWrite,
} from "./types";
import { useScheduleNames } from "./useScheduleNames";

const REPEATS: { value: RepeatKind; label: string }[] = [
	{ value: "daily", label: "Daily" },
	{ value: "weekdays", label: "Weekdays" },
	{ value: "weekly", label: "Weekly" },
	{ value: "monthly", label: "Monthly" },
	{ value: "custom", label: "Custom" },
];

const MISSED: { value: MissedPolicy; label: string }[] = [
	{ value: "catch_up", label: "Run once on recovery" },
	{ value: "run_all", label: "Run every missed one" },
	{ value: "skip", label: "Skip" },
];

const OVERLAP: { value: OverlapPolicy; label: string }[] = [
	{ value: "skip", label: "Skip" },
	{ value: "allow", label: "Run anyway" },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

function browserZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

interface Draft {
	name: string;
	instructions: string;
	agent: string;
	repeat: Repeat;
	timezone: string;
	inApp: boolean;
	channelIds: string[];
	missed: MissedPolicy;
	overlap: OverlapPolicy;
	approveOutward: boolean;
}

function draftOf(s: Schedule | undefined): Draft {
	if (!s) {
		return {
			name: "",
			instructions: "",
			agent: "",
			repeat: repeatOf("0 8 * * *"),
			timezone: browserZone(),
			inApp: true,
			channelIds: [],
			missed: "catch_up",
			overlap: "skip",
			approveOutward: true,
		};
	}
	return {
		name: s.name,
		instructions: s.instructions,
		agent: s.agent_id ?? "",
		repeat: repeatOf(s.cron),
		timezone: s.timezone,
		inApp: s.deliver_in_app,
		channelIds: s.channel_ids,
		missed: s.missed,
		overlap: s.overlap,
		approveOutward: s.approve_outward,
	};
}

export interface ScheduleDialogProps {
	graph: GraphRef;
	open: boolean;
	onClose: () => void;
	/** The schedule to edit; omitted, the dialog creates one. */
	schedule?: Schedule;
	/** A new schedule's name and instructions, filled in — the Explorer's
	 *  *Schedule this* hands the question it was asked. */
	prefill?: { name: string; instructions: string };
	/** After the engine accepts the write, with what it saved. */
	onSaved?: (schedule: Schedule) => void;
}

export function ScheduleDialog({
	graph,
	open,
	onClose,
	schedule,
	prefill,
	onSaved,
}: ScheduleDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
				{/* Mounted only while open, so each opening starts from the record. */}
				{open ? (
					<ScheduleForm
						graph={graph}
						schedule={schedule}
						prefill={prefill}
						onClose={onClose}
						onSaved={onSaved}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function ScheduleForm({
	graph,
	schedule,
	prefill,
	onClose,
	onSaved,
}: Omit<ScheduleDialogProps, "open">) {
	const create = useCreateSchedule(graph);
	const update = useUpdateSchedule(graph);
	const { agents } = useScheduleNames(graph);
	const [d, setD] = useState<Draft>(() => ({
		...draftOf(schedule),
		...(schedule ? {} : prefill),
	}));
	const set = (patch: Partial<Draft>) =>
		setD((prev) => ({ ...prev, ...patch }));
	const setRepeat = (patch: Partial<Repeat>) =>
		setD((prev) => ({ ...prev, repeat: { ...prev.repeat, ...patch } }));

	const agent = d.agent || agents[0]?.id || "";
	const zones = [...new Set([browserZone(), "UTC", d.timezone])];
	const pending = create.isPending || update.isPending;
	const error = schedule ? update.error : create.error;
	const ready =
		d.name.trim() &&
		d.instructions.trim() &&
		agent &&
		(d.repeat.kind !== "custom" || d.repeat.cron.trim());

	const submit = () => {
		const body: ScheduleWrite = {
			name: d.name.trim(),
			agent,
			instructions: d.instructions.trim(),
			cron: cronOf(d.repeat),
			timezone: d.timezone,
			missed: d.missed,
			overlap: d.overlap,
			deliver_in_app: d.inApp,
			channels: d.channelIds,
			approve_outward: d.approveOutward,
		};
		// A promise, not `mutate`'s callbacks: those are dropped if the form
		// unmounts while the list refetches under it.
		const saving = schedule
			? update.mutateAsync({ id: schedule.id, body })
			: create.mutateAsync(body);
		saving.then(
			(saved: Schedule) => {
				onClose();
				onSaved?.(saved);
			},
			() => undefined, // the refusal shows from the mutation's error
		);
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{schedule ? "Edit schedule" : "New schedule"}</DialogTitle>
				<DialogDescription>Routine work, no project needed.</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col gap-4">
				<Field>
					<FieldLabel htmlFor="schedule-name">Name</FieldLabel>
					<Input
						id="schedule-name"
						value={d.name}
						onChange={(e) => set({ name: e.target.value })}
						placeholder="AI & LLM digest"
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="schedule-instructions">What to do</FieldLabel>
					<Textarea
						id="schedule-instructions"
						rows={4}
						value={d.instructions}
						onChange={(e) => set({ instructions: e.target.value })}
					/>
					<FieldDescription>
						Plain instructions. Whatever the run finds is delivered.
					</FieldDescription>
				</Field>

				<Field>
					<FieldLabel>Runs as</FieldLabel>
					<Select value={agent} onValueChange={(v) => set({ agent: v })}>
						<SelectTrigger aria-label="Runs as">
							<SelectValue placeholder="No agents on this Graph" />
						</SelectTrigger>
						<SelectContent>
							{agents.map((a) => (
								<SelectItem key={a.id} value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>

				<Field>
					<Label>Repeat</Label>
					<div className="flex flex-wrap items-center gap-2">
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							aria-label="Repeat"
							value={d.repeat.kind}
							onValueChange={(v: string) => {
								if (!v) return;
								const kind = v as RepeatKind;
								setRepeat(
									kind === "custom"
										? { kind, cron: cronOf(d.repeat) }
										: { kind },
								);
							}}
						>
							{REPEATS.map((r) => (
								<ToggleGroupItem key={r.value} value={r.value}>
									{r.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
						{d.repeat.kind === "weekly" ? (
							<Select
								value={String(d.repeat.weekday)}
								onValueChange={(v) => setRepeat({ weekday: Number(v) })}
							>
								<SelectTrigger aria-label="On" className="w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{WEEKDAYS.map((w, i) => (
										<SelectItem key={w} value={String(i)}>
											{w}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}
						{d.repeat.kind === "monthly" ? (
							<Select
								value={String(d.repeat.day)}
								onValueChange={(v) => setRepeat({ day: Number(v) })}
							>
								<SelectTrigger aria-label="Day of the month" className="w-24">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DAYS_OF_MONTH.map((n) => (
										<SelectItem key={n} value={String(n)}>
											{n}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}
						{d.repeat.kind === "custom" ? (
							<Input
								aria-label="Cron"
								className="w-48 font-mono"
								value={d.repeat.cron}
								onChange={(e) => setRepeat({ cron: e.target.value })}
								placeholder="0 8 * * 1-5"
							/>
						) : (
							<Input
								type="time"
								aria-label="At"
								className="w-28"
								value={d.repeat.time}
								onChange={(e) =>
									e.target.value && setRepeat({ time: e.target.value })
								}
							/>
						)}
					</div>
					{d.repeat.kind === "custom" ? (
						<FieldDescription>
							Five fields: minute hour day-of-month month day-of-week.
						</FieldDescription>
					) : null}
				</Field>

				<Field>
					<FieldLabel>Time zone</FieldLabel>
					<Select
						value={d.timezone}
						onValueChange={(v) => set({ timezone: v })}
					>
						<SelectTrigger aria-label="Time zone" className="w-56">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{zones.map((z) => (
								<SelectItem key={z} value={z}>
									{z}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>

				<DeliveryPicker
					graph={graph}
					label="Deliver to"
					inApp={d.inApp}
					channelIds={d.channelIds}
					onChange={({ inApp, channelIds }) => set({ inApp, channelIds })}
				/>

				<Field>
					<Label>If a firing is missed</Label>
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						className="justify-start"
						aria-label="If a firing is missed"
						value={d.missed}
						onValueChange={(v: string) =>
							v && set({ missed: v as MissedPolicy })
						}
					>
						{MISSED.map((m) => (
							<ToggleGroupItem key={m.value} value={m.value}>
								{m.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</Field>

				<Field>
					<Label>If the last run is still going</Label>
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						className="justify-start"
						aria-label="If the last run is still going"
						value={d.overlap}
						onValueChange={(v: string) =>
							v && set({ overlap: v as OverlapPolicy })
						}
					>
						{OVERLAP.map((o) => (
							<ToggleGroupItem key={o.value} value={o.value}>
								{o.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</Field>

				<Field orientation="horizontal">
					<Switch
						id="schedule-approve"
						checked={d.approveOutward}
						onCheckedChange={(on) => set({ approveOutward: on })}
					/>
					<FieldLabel htmlFor="schedule-approve">
						Anything sent outside Invana waits for approval
					</FieldLabel>
				</Field>

				<FormError
					error={error ? refusalOf(error, "The schedule was refused.") : null}
				/>
			</div>

			<DialogFooter>
				<Button variant="ghost" onClick={onClose}>
					Cancel
				</Button>
				<Button disabled={!ready || pending} onClick={submit}>
					{schedule ? "Save" : "Create schedule"}
				</Button>
			</DialogFooter>
		</>
	);
}
