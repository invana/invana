/**
 * Workers › Join tokens — per pool, maker, expiry and workers joined. Revoke
 * stops new joins (a worker already joined keeps its own credential; Drain
 * stops it); the confirmation is built into the page.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	TypographyInlineCode,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { FleetReadState } from "../overview/fleetParts";
import { AdminButton, DASH, whenOf } from "./parts";
import { useRevokeTokenMutation, useTokensQuery } from "./queries";
import type { JoinTokenRow } from "./types";

const joined = (t: JoinTokenRow) =>
	t.cap != null ? `${t.joins} of ${t.cap}` : String(t.joins);

/** `in 23 h` inside two days, else the date. */
function expiresOf(iso: string): string {
	const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000;
	return hours > 0 && hours < 48 ? `in ${Math.round(hours)} h` : whenOf(iso);
}

/** Every join token, or one pool's (`pool` is its id) on the pool's page. */
export function TokensTab({
	onAdd,
	pool,
}: {
	onAdd: () => void;
	pool?: string;
}) {
	const tokens = useTokensQuery(pool);
	const revoke = useRevokeTokenMutation();
	const [confirming, setConfirming] = useState<JoinTokenRow | null>(null);

	const columns = useMemo<ColumnDef<JoinTokenRow>[]>(
		() => [
			{
				id: "token",
				header: "Token",
				cell: ({ row }) => (
					<TypographyInlineCode>{row.original.display}</TypographyInlineCode>
				),
			},
			{ id: "pool", header: "Pool", cell: ({ row }) => row.original.pool },
			{
				id: "made_by",
				header: "Made by",
				cell: ({ row }) =>
					`${row.original.made_by ?? "install admin"} · ${whenOf(row.original.created_at)}`,
			},
			{
				id: "expires",
				header: "Expires",
				cell: ({ row }) =>
					row.original.expires_at
						? expiresOf(row.original.expires_at)
						: "never · in a cluster secret",
			},
			{
				id: "joined",
				header: "Joined",
				cell: ({ row }) => (
					<span className="font-mono">{joined(row.original)}</span>
				),
			},
			{
				id: "last_used",
				header: "Last used",
				cell: ({ row }) => whenOf(row.original.last_used_at) ?? DASH,
			},
			{
				id: "revoke",
				header: "",
				cell: ({ row }) =>
					row.original.revoked ? (
						<span className="text-muted-foreground">revoked</span>
					) : (
						<AdminButton
							variant="outline"
							onClick={(e) => {
								e.stopPropagation();
								setConfirming(row.original);
							}}
						>
							Revoke
						</AdminButton>
					),
			},
		],
		[],
	);

	if (!tokens.data)
		return (
			<FleetReadState
				loading={tokens.isLoading}
				error={tokens.error}
				what="the join tokens"
			/>
		);

	return (
		<>
			<div className="flex justify-end">
				<AdminButton variant="outline" onClick={onAdd}>
					<Plus />
					Add workers
				</AdminButton>
			</div>
			<DataTable
				columns={columns}
				data={tokens.data.items}
				enableSorting={false}
				getRowId={(row) => row.id}
				emptyState="No join tokens. Add workers makes one."
			/>
			<p className="text-sm text-muted-foreground">
				A token only joins workers to its pool. Each worker then holds its own
				credential, rotated hourly. Revoke stops new joins; Drain stops a
				worker.
			</p>
			<FormError error={revoke.error} />
			<AlertDialog
				open={confirming != null}
				onOpenChange={(o) => !o && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Revoke {confirming?.display}?</AlertDialogTitle>
						<AlertDialogDescription>
							No new worker can join {confirming?.pool} with it. Workers that
							already joined keep running.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (confirming) revoke.mutate(confirming.id);
								setConfirming(null);
							}}
						>
							Revoke
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
