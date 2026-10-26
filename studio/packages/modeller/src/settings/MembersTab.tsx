import { type ColumnDef, DataTable } from "@invana/tables";
import { Badge, Card, SectionHeader, Skeleton } from "@invana/ui";
import {
	GRAPH_ROLES,
	type GraphMember,
	type GraphRef,
	type GraphRole,
	ROLE_MAY,
	useAuth,
	useMemberMutations,
	useMembersQuery,
} from "@invana-studio/core";
import { ActButton, ConfirmDialog } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { useEffect, useMemo, useState } from "react";
import { AddMemberDialog, EditRolesDialog } from "./MemberDialogs";

/** `Sep 2026` — when the person joined, to the month. */
function since(iso: string): string {
	return new Date(iso).toLocaleDateString("en", {
		month: "short",
		year: "numeric",
	});
}

/** Highest role first, so `owner` leads a row. */
const ranked = (roles: GraphRole[]) =>
	[...GRAPH_ROLES].reverse().filter((r) => roles.includes(r));

/**
 * Graph settings › **Members** — who is on this Graph and what each of them
 * may change (`modeller.settings.members`).
 *
 * *As an owner, I want to see every member and the roles they hold, and add,
 * re-role or remove one, so that the right people can change the right parts
 * of the Graph.*
 *
 * | Card | Rows |
 * |---|---|
 * | Members | member · roles · since, with *Edit* and *Remove* per row |
 * | Roles | role · what it may change — the key to the badges above |
 *
 * The two cards sit side by side from `lg`. *Add member* is the page head's
 * act, so whether its dialog is open is handed in. Every member reads this tab.
 * *Add member*, *Edit* and *Remove* are the
 * `settings` area's: without `owner` they show disabled, with who to ask.
 * The signed-in member's row says *you*. Agents are not members, so they
 * never list here.
 *
 * A refusal — the last owner, an unknown account — shows in the dialog that
 * asked, in the engine's words. Removing has no dialog of its own after the
 * confirm, so its refusal shows above the table.
 */
export function MembersTab({
	graph,
	adding,
	onAddingChange,
}: {
	graph: GraphRef;
	adding: boolean;
	onAddingChange: (open: boolean) => void;
}) {
	const { data, isLoading } = useMembersQuery(graph);
	const { add, setRoles, remove } = useMemberMutations(graph);
	const { user } = useAuth();
	const [editing, setEditing] = useState<GraphMember | null>(null);
	const [removing, setRemoving] = useState<GraphMember | null>(null);

	const columns = useMemo<ColumnDef<GraphMember>[]>(
		() => [
			{
				accessorKey: "username",
				header: "member",
				cell: ({ row }) => (
					<span className="inline-flex items-center gap-1.5 font-medium">
						{row.original.username}
						{row.original.username === user?.username ? (
							<Badge variant="outline" size="xs">
								you
							</Badge>
						) : null}
					</span>
				),
			},
			{
				id: "roles",
				header: "roles",
				cell: ({ row }) => (
					<span className="inline-flex flex-wrap gap-1">
						{ranked(row.original.roles).map((r) => (
							<Badge key={r} variant="secondary" size="xs">
								{r}
							</Badge>
						))}
					</span>
				),
			},
			{
				accessorKey: "added_at",
				header: "since",
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{since(row.original.added_at)}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				meta: { align: "right" },
				cell: ({ row }) => (
					<span className="inline-flex gap-1">
						<ActButton
							area="settings"
							variant="ghost"
							size="xs"
							aria-label={`Edit ${row.original.username}`}
							onClick={() => {
								setRoles.reset();
								setEditing(row.original);
							}}
						>
							Edit
						</ActButton>
						<ActButton
							area="settings"
							variant="ghost"
							size="xs"
							aria-label={`Remove ${row.original.username}`}
							onClick={() => {
								remove.reset();
								setRemoving(row.original);
							}}
						>
							Remove
						</ActButton>
					</span>
				),
			},
		],
		[user?.username, setRoles.reset, remove.reset],
	);

	// A fresh dialog never shows the last attempt's refusal.
	useEffect(() => {
		if (adding) add.reset();
	}, [adding, add.reset]);

	const roleRows = useMemo(
		() => GRAPH_ROLES.map((role) => ({ role, may: ROLE_MAY[role] })),
		[],
	);
	const roleColumns = useMemo<ColumnDef<(typeof roleRows)[number]>[]>(
		() => [
			{
				accessorKey: "role",
				header: "role",
				cell: ({ row }) => (
					<Badge variant="secondary" size="xs">
						{row.original.role}
					</Badge>
				),
			},
			{
				accessorKey: "may",
				header: "may",
				cell: ({ row }) => (
					<span className="text-muted-foreground">{row.original.may}</span>
				),
			},
		],
		[],
	);

	return (
		<div className="grid items-start gap-3 lg:grid-cols-[3fr_2fr]">
			<Card>
				<SectionHeader bare title="Members" count={data?.total} />
				<FormError error={remove.error} className="mx-3 mb-3" />
				{isLoading ? (
					<div className="space-y-2 p-3">
						<Skeleton className="h-7 w-full" />
						<Skeleton className="h-7 w-full" />
					</div>
				) : (
					<DataTable
						columns={columns}
						data={data?.items ?? []}
						enableSorting={false}
					/>
				)}
			</Card>

			<Card>
				<SectionHeader bare title="Roles" count={GRAPH_ROLES.length} />
				<DataTable
					columns={roleColumns}
					data={roleRows}
					enableSorting={false}
				/>
			</Card>

			<AddMemberDialog
				open={adding}
				pending={add.isPending}
				error={add.error}
				onOpenChange={onAddingChange}
				onAdd={(u, roles) =>
					add.mutate(
						{ user: u, roles },
						{ onSuccess: () => onAddingChange(false) },
					)
				}
			/>
			<EditRolesDialog
				username={editing?.username ?? null}
				roles={editing?.roles ?? []}
				pending={setRoles.isPending}
				error={setRoles.error}
				onOpenChange={(open) => !open && setEditing(null)}
				onSave={(roles) =>
					editing &&
					setRoles.mutate(
						{ username: editing.username, roles },
						{ onSuccess: () => setEditing(null) },
					)
				}
			/>
			<ConfirmDialog
				open={removing !== null}
				title={`Remove ${removing?.username ?? ""} from this graph?`}
				description="They lose every role here and can no longer open the graph. Their past work stays."
				confirmLabel="Remove"
				destructive
				onOpenChange={(open) => !open && setRemoving(null)}
				onConfirm={() => {
					if (removing) remove.mutate(removing.username);
					setRemoving(null);
				}}
			/>
		</div>
	);
}
