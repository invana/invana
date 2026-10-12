/**
 * The rule dialog — *New rule*, and a rule opened from its row.
 *
 * Four parts, in the order a rule reads:
 *
 * | Part | What it sets |
 * |---|---|
 * | Name | what the row and the inbox call it |
 * | When | event patterns from the events catalogue, grouped as in Events; with `run.finish` picked, a *Status* condition (any · failed · succeeded) written to `match.status` |
 * | Tell | members by name (sent as their ids), holders of Graph roles, and whoever the run was for |
 * | On | In app and each channel, through `DeliveryPicker` |
 *
 * *Any run fails* fills When in one click. Events a delivery itself writes
 * (rules, channels, deliveries, approval reminders) are never offered. Any
 * `match` key other than `status` is carried through an edit untouched. An
 * existing rule can be deleted, after a confirm. Every write the engine
 * refuses shows its reason inline; acts are not hidden by role.
 */

import {
	Checkbox,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@invana/ui";
import {
	GRAPH_ROLES,
	type GraphRef,
	useMembersQuery,
} from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { ActButton } from "../../../access/ActButton";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { refusalOf } from "../api";
import { DeliveryPicker } from "../DeliveryPicker";
import {
	useCreateRule,
	useDeleteRule,
	useMemberName,
	useUpdateRule,
} from "../queries";
import type { NotificationRule, RuleMatch } from "../types";
import {
	ANY_RUN_FAILS,
	RULE_EVENT_CATEGORIES,
	RUN_FINISH,
	rolePlural,
} from "./ruleText";

type Status = "any" | "failed" | "succeeded";

export interface RuleDialogProps {
	graph: GraphRef;
	/** The rule to edit; absent for *New rule*. */
	rule?: NotificationRule;
	onClose: () => void;
}

function statusOf(match: RuleMatch): Status {
	const s = match.status;
	return s === "failed" || s === "succeeded" ? s : "any";
}

/** Toggles one value in a list, keeping the list's order. */
function toggled(list: string[], value: string): string[] {
	return list.includes(value)
		? list.filter((v) => v !== value)
		: [...list, value];
}

/** Writes or edits one notification rule; mounted only while it is open. */
export function RuleDialog({ graph, rule, onClose }: RuleDialogProps) {
	const create = useCreateRule(graph);
	const update = useUpdateRule(graph);
	const remove = useDeleteRule(graph);
	const members = useMembersQuery(graph).data?.items ?? [];
	const nameOf = useMemberName(graph);

	const [name, setName] = useState(rule?.name ?? "");
	const [events, setEvents] = useState<string[]>(rule?.events ?? []);
	const [status, setStatus] = useState<Status>(statusOf(rule?.match ?? {}));
	const [memberIds, setMemberIds] = useState<string[]>(rule?.member_ids ?? []);
	const [roles, setRoles] = useState<string[]>(rule?.roles ?? []);
	const [requester, setRequester] = useState(rule?.requester ?? false);
	const [inApp, setInApp] = useState(rule?.in_app ?? true);
	const [channelIds, setChannelIds] = useState<string[]>(
		rule?.channel_ids ?? [],
	);
	const [eventsOpen, setEventsOpen] = useState(false);
	const [membersOpen, setMembersOpen] = useState(false);
	const [confirming, setConfirming] = useState(false);

	const runFinish = events.includes(RUN_FINISH);
	const pending = create.isPending || update.isPending || remove.isPending;
	const error = create.error ?? update.error ?? remove.error;

	const preset = () => {
		setEvents([...ANY_RUN_FAILS.events]);
		setStatus(ANY_RUN_FAILS.status);
		if (!name.trim()) setName(ANY_RUN_FAILS.name);
		// A rule needs someone to tell; the run's own requester is the default.
		if (!memberIds.length && !roles.length) setRequester(true);
	};

	const matchOut = (): RuleMatch => {
		const next: RuleMatch = { ...(rule?.match ?? {}) };
		if (!runFinish) return next;
		if (status === "any") delete next.status;
		else next.status = status;
		return next;
	};

	const save = () => {
		const body = {
			name: name.trim(),
			events,
			match: matchOut(),
			members: memberIds,
			roles,
			requester,
			in_app: inApp,
			channels: channelIds,
		};
		if (rule)
			update.mutate({ id: rule.id, body }, { onSuccess: () => onClose() });
		else create.mutate(body, { onSuccess: () => onClose() });
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{rule ? rule.name : "New rule"}</DialogTitle>
					<DialogDescription>
						When these events are written on the Graph, tell these people, on
						these channels.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="rule-name">Name</Label>
						<Input
							id="rule-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Any run fails"
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label>When</Label>
						<div className="flex flex-wrap items-center gap-1.5">
							<Popover open={eventsOpen} onOpenChange={setEventsOpen}>
								<PopoverTrigger asChild>
									<Button variant="outline" size="sm">
										<Plus />
										Events
										{events.length > 0 && (
											<Badge variant="secondary">{events.length}</Badge>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent align="start" className="w-96 p-0">
									<Command>
										<CommandInput placeholder="Search events…" />
										<CommandList>
											<CommandEmpty>No matching events.</CommandEmpty>
											{RULE_EVENT_CATEGORIES.map((cat) => (
												<CommandGroup key={cat.key} heading={cat.label}>
													{cat.types.map((t) => (
														<CommandItem
															key={t.action}
															value={t.action}
															keywords={[t.label, cat.label]}
															onSelect={() =>
																setEvents((es) => toggled(es, t.action))
															}
														>
															<Check
																className={
																	events.includes(t.action)
																		? "opacity-100"
																		: "opacity-0"
																}
															/>
															<span className="truncate font-mono">
																{t.action}
															</span>
															<span className="ml-auto shrink-0 pl-3 text-muted-foreground">
																{t.label}
															</span>
														</CommandItem>
													))}
												</CommandGroup>
											))}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
							<Button variant="ghost" size="sm" onClick={preset}>
								Any run fails
							</Button>
						</div>
						{events.length > 0 ? (
							<div className="flex flex-wrap gap-1">
								{events.map((e) => (
									<Badge
										key={e}
										variant="outline"
										tone="muted"
										className="font-mono"
									>
										{e}
									</Badge>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								Pick the events this rule listens for.
							</p>
						)}
						{runFinish && (
							<div className="flex items-center gap-2">
								<Label htmlFor="rule-status">Status</Label>
								<Select
									value={status}
									onValueChange={(v) => setStatus(v as Status)}
								>
									<SelectTrigger id="rule-status" className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="any">any</SelectItem>
										<SelectItem value="failed">failed</SelectItem>
										<SelectItem value="succeeded">succeeded</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}
					</div>

					<div className="flex flex-col gap-2">
						<Label>Tell</Label>
						<div className="flex flex-wrap items-center gap-1.5">
							{memberIds.map((id) => (
								<Badge key={id} variant="outline" tone="muted">
									{nameOf(id)}
								</Badge>
							))}
							<Popover open={membersOpen} onOpenChange={setMembersOpen}>
								<PopoverTrigger asChild>
									<Button variant="ghost" size="sm">
										<Plus />
										Members
									</Button>
								</PopoverTrigger>
								<PopoverContent align="start" className="w-72 p-0">
									<Command>
										<CommandInput placeholder="Search members…" />
										<CommandList>
											<CommandEmpty>No matching members.</CommandEmpty>
											{members.map((m) => (
												<CommandItem
													key={m.user_id}
													value={m.user_id}
													keywords={[m.username, m.first_name]}
													onSelect={() =>
														setMemberIds((ids) => toggled(ids, m.user_id))
													}
												>
													<Check
														className={
															memberIds.includes(m.user_id)
																? "opacity-100"
																: "opacity-0"
														}
													/>
													{nameOf(m.user_id)}
													<span className="ml-auto pl-3 text-muted-foreground">
														{m.username}
													</span>
												</CommandItem>
											))}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
							{GRAPH_ROLES.map((role) => (
								<div key={role} className="flex items-center gap-1.5">
									<Checkbox
										id={`rule-role-${role}`}
										checked={roles.includes(role)}
										onCheckedChange={() => setRoles((rs) => toggled(rs, role))}
									/>
									<Label htmlFor={`rule-role-${role}`}>
										{rolePlural(role)}
									</Label>
								</div>
							))}
						</div>
						<div className="flex items-center gap-1.5">
							<Checkbox
								id="rule-requester"
								checked={requester}
								onCheckedChange={(c) => setRequester(c === true)}
							/>
							<Label htmlFor="rule-requester">Whoever the run was for</Label>
						</div>
					</div>

					<DeliveryPicker
						graph={graph}
						label="On"
						inApp={inApp}
						channelIds={channelIds}
						onChange={(next) => {
							setInApp(next.inApp);
							setChannelIds(next.channelIds);
						}}
					/>

					{error ? <FormError error={refusalOf(error)} /> : null}
				</div>

				<DialogFooter>
					{rule && (
						<ActButton
							area="settings"
							variant="ghost"
							className="mr-auto text-destructive"
							disabled={pending}
							onClick={() => setConfirming(true)}
						>
							Delete
						</ActButton>
					)}
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<ActButton
						area="settings"
						disabled={!name.trim() || events.length === 0 || pending}
						onClick={save}
					>
						Save rule
					</ActButton>
				</DialogFooter>

				{rule && (
					<ConfirmDialog
						open={confirming}
						title={`Delete ${rule.name}?`}
						description="Nobody hears about these events from this rule again. What it already delivered stays in each inbox."
						confirmLabel="Delete rule"
						destructive
						onOpenChange={setConfirming}
						onConfirm={() =>
							remove.mutate(rule.id, { onSuccess: () => onClose() })
						}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
