/**
 * A group's page, opened as a tab of its own (`?page=iam_group:<name>`) — its
 * members, people and agents, and the policies attached to it.
 *
 * *As an owner, I want to add people and agents to a team and attach a policy
 * to it once, so that every member holds what the team holds.*
 *
 * - **Members** — each person or agent in the group, *Add member* and
 *   *Remove*. Removing a member takes away only what the group gave it.
 * - **Policies it holds** — managed policies included, each with its kind
 *   and what it allows; a name opens the policy's page. *Attach a policy*
 *   attaches one to the group and *Detach* removes that attachment — the same
 *   acts as a policy's Held by tab.
 * - **Delete group** — its attachments go; members keep their own.
 *
 * Every write is the `iam` area's: without iam-admin the acts show disabled,
 * naming who holds it. A refusal shows in the modal that asked, in the
 * engine's words.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	RecordHeader,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton, ConfirmDialog } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { ScrollText, UsersRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useIamOpen } from "../open";
import { PAGE, ReadState } from "../people/listParts";
import {
	useGroupMutations,
	useGroupQuery,
	useIamAgentsQuery,
	usePeopleQuery,
	usePoliciesQuery,
	usePolicyMutations,
} from "../queries";
import type { GroupMemberRef, GroupPolicyRef, GroupRead } from "../types";

export interface GroupPageProps {
	username: string;
	graphSlug: string;
	/** The group's name — its address in the Graph. */
	name: string;
}

const EVERY = { limit: PAGE };

export function GroupPage({ username, graphSlug, name }: GroupPageProps) {
	const open = useIamOpen();
	const query = useGroupQuery(username, graphSlug, name);
	const groups = useGroupMutations({ username, graphSlug });
	const [adding, setAdding] = useState(false);
	const [attaching, setAttaching] = useState(false);
	const [removing, setRemoving] = useState<GroupMemberRef | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [detaching, setDetaching] = useState<GroupPolicyRef | null>(null);
	// A write invalidates the Graph's whole IAM tree, this group's read with it.
	const policies = usePolicyMutations({ username, graphSlug });
	const group = query.data;

	const crumbs = [
		{ label: "Groups", onClick: () => open.section("groups") },
		name,
	];

	if (!group)
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RecordHeader variant="page" icon={<UsersRound />} crumbs={crumbs} />
				<ReadState
					loading={query.isLoading}
					error={query.error}
					what="this group"
					onRetry={() => void query.refetch()}
				/>
			</div>
		);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<UsersRound />}
				crumbs={crumbs}
				chips={
					<span className="truncate text-sm text-muted-foreground">
						{group.people_count} people · {group.agents_count} agents
						{group.description ? ` · ${group.description}` : ""}
					</span>
				}
				actions={
					<ActButton
						area="iam"
						size="sm"
						variant="outline"
						onClick={() => {
							groups.remove.reset();
							setDeleting(true);
						}}
					>
						Delete group
					</ActButton>
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
				<FormError
					error={
						groups.remove.error ??
						groups.removeMember.error ??
						policies.detach.error
					}
				/>
				<PanelSection
					card
					title="Members"
					hint="People and agents — each holds what the group holds"
					action={
						<ActButton
							area="iam"
							size="xs"
							variant="ghost"
							onClick={() => {
								groups.addMember.reset();
								setAdding(true);
							}}
						>
							Add member
						</ActButton>
					}
				>
					{group.members.length ? (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Member</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{group.members.map((m) => (
									<TableRow key={m.id}>
										<TableCell className="font-medium">{m.name}</TableCell>
										<TableCell className="text-muted-foreground">
											{m.member_kind}
										</TableCell>
										<TableCell className="text-right">
											<ActButton
												area="iam"
												size="xs"
												variant="ghost"
												aria-label={`Remove ${m.name}`}
												onClick={() => setRemoving(m)}
											>
												Remove
											</ActButton>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-muted-foreground">
							No members yet — its policies reach no one.
						</p>
					)}
				</PanelSection>
				<PanelSection
					card
					title="Policies it holds"
					action={
						<ActButton
							area="iam"
							size="xs"
							variant="ghost"
							onClick={() => setAttaching(true)}
						>
							Attach a policy
						</ActButton>
					}
				>
					{group.held.length ? (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Policy</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead>Allows</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{group.held.map((p) => (
									<TableRow key={p.attachment_id}>
										<TableCell>
											<Button
												size="xs"
												variant="ghost"
												onClick={() => open.policy(p.name)}
											>
												<ScrollText className="size-3.5" />
												{p.name}
											</Button>
										</TableCell>
										<TableCell>
											<Badge variant="outline" size="xs">
												{p.kind}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{p.summary}
										</TableCell>
										<TableCell className="text-right">
											<ActButton
												area="iam"
												size="xs"
												variant="ghost"
												aria-label={`Detach ${p.name}`}
												onClick={() => {
													policies.detach.reset();
													setDetaching(p);
												}}
											>
												Detach
											</ActButton>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-muted-foreground">
							No policy attached — its members hold only their own.
						</p>
					)}
				</PanelSection>
			</div>
			<AddMemberDialog
				username={username}
				graphSlug={graphSlug}
				group={group}
				open={adding}
				onOpenChange={setAdding}
			/>
			<AttachDialog
				username={username}
				graphSlug={graphSlug}
				group={group}
				open={attaching}
				onOpenChange={setAttaching}
			/>
			<ConfirmDialog
				open={removing !== null}
				title={`Remove ${removing?.name ?? ""} from ${group.name}?`}
				description="It loses what the group gave it. Policies it holds of its own stay."
				confirmLabel="Remove"
				destructive
				onOpenChange={(o) => !o && setRemoving(null)}
				onConfirm={() => {
					if (removing)
						groups.removeMember.mutate({ name: group.name, id: removing.id });
					setRemoving(null);
				}}
			/>
			<ConfirmDialog
				open={detaching !== null}
				title={`Detach ${detaching?.name ?? ""} from ${group.name}?`}
				description="Its members lose what this policy gave them through the group. Policies they hold of their own stay."
				confirmLabel="Detach"
				destructive
				onOpenChange={(o) => !o && setDetaching(null)}
				onConfirm={() => {
					if (detaching)
						policies.detach.mutate({
							name: detaching.name,
							id: detaching.attachment_id,
						});
					setDetaching(null);
				}}
			/>
			<ConfirmDialog
				open={deleting}
				title={`Delete ${group.name}?`}
				description="Its attachments go with it. Its members keep the policies they hold of their own."
				confirmLabel="Delete group"
				destructive
				onOpenChange={setDeleting}
				onConfirm={() =>
					groups.remove.mutate(group.name, {
						onSuccess: () => open.section("groups"),
					})
				}
			/>
		</div>
	);
}

/** One option a picker offers. */
interface Choice {
	id: string;
	label: string;
}

/** A labelled select over a list the engine returned. */
function ChoiceSelect({
	id,
	label,
	value,
	choices,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	choices: Choice[];
	onChange: (value: string) => void;
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger id={id} aria-label={label}>
				<SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
			</SelectTrigger>
			<SelectContent>
				{choices.map((c) => (
					<SelectItem key={c.id} value={c.id}>
						{c.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** *Add member* — a person of this Graph, or one of its agents. */
function AddMemberDialog({
	username,
	graphSlug,
	group,
	open,
	onOpenChange,
}: {
	username: string;
	graphSlug: string;
	group: GroupRead;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { addMember } = useGroupMutations({ username, graphSlug });
	const people = usePeopleQuery(username, graphSlug, EVERY);
	const agents = useIamAgentsQuery(username, graphSlug, EVERY);
	const [kind, setKind] = useState<"person" | "agent">("person");
	const [member, setMember] = useState("");

	useEffect(() => {
		if (open) setMember("");
	}, [open]);

	const choices: Choice[] =
		kind === "person"
			? (people.data?.items ?? []).map((p) => ({
					id: p.user_id,
					label: p.username,
				}))
			: (agents.data?.items ?? []).map((a) => ({
					id: a.agent_id,
					label: a.name,
				}));

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!member) return;
		addMember.mutate(
			{ name: group.name, data: { member_kind: kind, member_id: member } },
			{ onSuccess: () => onOpenChange(false) },
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={submit} className="space-y-4" noValidate>
					<DialogHeader>
						<DialogTitle>Add a member to {group.name}</DialogTitle>
						<DialogDescription>
							A member holds every policy attached to the group, as long as it
							is in it.
						</DialogDescription>
					</DialogHeader>
					<SegmentedControl
						size="sm"
						aria-label="Member kind"
						value={kind}
						onValueChange={(v) => {
							setKind(v as "person" | "agent");
							setMember("");
						}}
						options={[
							{ value: "person", label: "Person" },
							{ value: "agent", label: "Agent" },
						]}
					/>
					<ChoiceSelect
						id="group-member"
						label={kind === "person" ? "Person" : "Agent"}
						value={member}
						choices={choices}
						onChange={setMember}
					/>
					<FormError error={addMember.error} />
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={addMember.isPending || !member}>
							Add member
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** *Attach a policy* — the group holds it, and so does every member. */
function AttachDialog({
	username,
	graphSlug,
	group,
	open,
	onOpenChange,
}: {
	username: string;
	graphSlug: string;
	group: GroupRead;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { attach } = usePolicyMutations({ username, graphSlug });
	const policies = usePoliciesQuery(username, graphSlug, EVERY);
	const [policy, setPolicy] = useState("");

	useEffect(() => {
		if (open) {
			setPolicy("");
			attach.reset();
		}
	}, [open, attach.reset]);

	const choices: Choice[] = (policies.data?.items ?? []).map((p) => ({
		id: p.name,
		label: `${p.name} · ${p.kind}`,
	}));

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!policy) return;
		attach.mutate(
			{
				name: policy,
				data: { holder_kind: "group", holder_id: group.id, ends: "always" },
			},
			{ onSuccess: () => onOpenChange(false) },
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={submit} className="space-y-4" noValidate>
					<DialogHeader>
						<DialogTitle>Attach a policy to {group.name}</DialogTitle>
						<DialogDescription>
							Every person and agent in the group holds it at once.
						</DialogDescription>
					</DialogHeader>
					<ChoiceSelect
						id="group-policy"
						label="Policy"
						value={policy}
						choices={choices}
						onChange={setPolicy}
					/>
					{group.held.length ? (
						<p className="text-muted-foreground">
							Holds now:{" "}
							{group.held.map((p) => (
								<Badge
									key={p.attachment_id}
									variant="outline"
									size="xs"
									className="mr-1"
								>
									{p.name}
								</Badge>
							))}
						</p>
					) : null}
					<FormError error={attach.error} />
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={attach.isPending || !policy}>
							Attach
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
