/**
 * A policy's **Held by** — every person, group, agent and token holding it,
 * how (direct · via a group · for a run · as a role), who attached it and when
 * it ends. The kind tabs are the engine's counts (`kinds`, and the unfiltered
 * total for *All*); the filter is the page's own, so it never touches the
 * Policies list's `?f.kind=` behind it.
 *
 * *Attach to…* is a modal; *Detach* removes one attachment. A managed policy
 * held as a member's role has no attachment to detach — the member's role is
 * changed in Settings › Members. A boundary is never attached: it bounds the
 * whole Graph.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Badge, EmptyState, SegmentedControl } from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useHoldersQuery, usePolicyMutations } from "../queries";
import type { HolderRow, PolicyRead } from "../types";
import { AttachDialog } from "./AttachDialog";
import { byLine, ReadState } from "./policyParts";

const KINDS = [
	{ value: "person", label: "People" },
	{ value: "group", label: "Groups" },
	{ value: "agent", label: "Agents" },
	{ value: "token", label: "Tokens" },
];

const KIND_LABEL: Record<string, string> = {
	person: "Person",
	group: "Group",
	agent: "Agent",
	token: "Token",
};

export function PolicyHeldByTab({
	username,
	graphSlug,
	policy,
	attaching,
	onAttaching,
}: {
	username: string;
	graphSlug: string;
	policy: PolicyRead;
	/** *Attach to…* is open (`?dialog=attach`). */
	attaching: boolean;
	onAttaching: (open: boolean) => void;
}) {
	const [kind, setKind] = useState("");
	const query = useHoldersQuery(username, graphSlug, policy.name, {
		filters: kind ? { kind: [kind] } : undefined,
		limit: 200,
	});
	const { detach } = usePolicyMutations({ username, graphSlug });
	const columns = useMemo(
		() =>
			holderColumns((id) => detach.mutate({ name: policy.name, id }), {
				pending: detach.isPending,
			}),
		[detach, policy.name],
	);
	const page = query.data;
	const boundary = policy.kind === "boundary";
	const draft = policy.status === "draft";

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					size="sm"
					aria-label="Holder kind"
					value={kind || "all"}
					onValueChange={(v) => setKind(v === "all" ? "" : v)}
					options={[
						{
							value: "all",
							label: page ? `All ${page.unfiltered_total}` : "All",
						},
						...KINDS.filter(
							(k) => k.value !== "token" || page?.kinds.token,
						).map((k) => ({
							value: k.value,
							label: page ? `${k.label} ${page.kinds[k.value] ?? 0}` : k.label,
						})),
					]}
				/>
				<span className="ml-auto">
					<ActButton
						area="iam"
						size="sm"
						variant="outline"
						disabled={boundary || draft}
						title={
							boundary
								? "A boundary bounds the whole Graph without being attached."
								: draft
									? "A draft is held by nobody — save it first."
									: undefined
						}
						onClick={() => onAttaching(true)}
					>
						<Plus />
						Attach to…
					</ActButton>
				</span>
			</div>
			<FormError error={detach.error} />
			{!page ? (
				<ReadState
					loading={query.isLoading}
					error={query.error}
					what="who holds this policy"
					onRetry={() => void query.refetch()}
				/>
			) : page.items.length === 0 ? (
				<EmptyState
					title={
						boundary
							? "Bounds the whole Graph"
							: draft
								? "Not held by anyone yet"
								: "Nobody holds this policy"
					}
					description={
						boundary
							? "A boundary applies to every holder without being attached."
							: draft
								? "Save it, then attach it to a person, a group or an agent."
								: "Attach it to a person, a group or an agent."
					}
				/>
			) : (
				<DataTable
					columns={columns}
					data={page.items}
					enableSorting={false}
					getRowId={(row) =>
						`${row.kind}:${row.holder_id}:${row.id ?? row.how}`
					}
				/>
			)}
			<p className="text-muted-foreground">
				Attach a policy to a person, a group or an agent. A group passes it to
				every member; an agent built in Agents can be attached here or on its
				Access tab — one record.
			</p>
			{attaching ? (
				<AttachDialog
					username={username}
					graphSlug={graphSlug}
					name={policy.name}
					onClose={() => onAttaching(false)}
				/>
			) : null}
		</div>
	);
}

function holderColumns(
	onDetach: (id: string) => void,
	{ pending }: { pending: boolean },
): ColumnDef<HolderRow>[] {
	return [
		{
			id: "kind",
			header: "Kind",
			cell: ({ row }) => (
				<Badge variant="outline" tone="muted">
					{KIND_LABEL[row.original.kind] ?? row.original.kind}
				</Badge>
			),
		},
		{
			id: "holder",
			header: "Holder",
			cell: ({ row }) => (
				<span className="flex items-baseline gap-3">
					<span className="font-medium">{row.original.name}</span>
					<span className="text-muted-foreground">{row.original.line}</span>
				</span>
			),
		},
		{
			id: "how",
			header: "How",
			cell: ({ row }) => row.original.how,
		},
		{
			id: "attached_by",
			header: "Attached by",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{byLine(row.original.attached_by, row.original.attached_at)}
				</span>
			),
		},
		{
			id: "ends",
			header: "Ends",
			cell: ({ row }) => row.original.ends_line ?? "—",
		},
		{
			id: "detach",
			header: "",
			cell: ({ row }) => {
				const id = row.original.id;
				return id ? (
					<ActButton
						area="iam"
						size="sm"
						variant="ghost"
						disabled={pending}
						onClick={() => onDetach(id)}
						aria-label={`Detach ${row.original.name}`}
					>
						Detach
					</ActButton>
				) : null;
			},
		},
	];
}
