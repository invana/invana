/**
 * IAM › **Tokens** (board `iam.tokens`) — every token that reaches this
 * Graph: the ones minted here, bound to it and perhaps narrowed, and every
 * profile token of a member.
 *
 * *As a person or an iam-admin, I want every token that acts in this Graph on
 * one page — whose it is, what it is narrowed to, when it was last used — so
 * that a key nobody uses, or one wider than its job, is seen and revoked.*
 *
 * - **New token** opens a modal (`NewTokenDialog`) from the head's button or
 *   from `?new=1`, so the assistant and a link can open it too. Closing it
 *   drops the param. It is disabled, saying why, when the caller already
 *   holds the deployment's ceiling and every row is on screen.
 * - **Revoke** confirms by name — the row is the only thing anyone can still
 *   identify the token by. Your own token is yours to revoke; another
 *   holder's needs iam-admin, and the button says who holds it.
 * - An expired token stays listed, marked, so what stopped a script is
 *   visible rather than missing. A revoked one leaves the list.
 *
 * Every count is the engine's `total`; dates are the engine's stamps,
 * formatted.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	Spinner,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@invana/ui";
import {
	formatShortDate,
	useAuth,
	useUpdateSearchParams,
} from "@invana-studio/core";
import { ActButton, useAccess } from "@invana-studio/shell";
import { FormError, SectionBody } from "@invana-studio/ui";
import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useIamTokensQuery, useTokenMutations } from "../queries";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import type { IamTokenRow } from "../types";
import { NewTokenDialog } from "./NewTokenDialog";

const PAGE = { limit: 200 };

const date = (iso: string | null) =>
	iso ? formatShortDate(new Date(iso)) : null;

export function TokensPage({ username, graphSlug }: SectionPageProps) {
	const query = useIamTokensQuery(username, graphSlug, PAGE);
	const [search] = useSearchParams();
	const updateSearch = useUpdateSearchParams();
	const [creating, setCreating] = useState(false);
	const [revoking, setRevoking] = useState<IamTokenRow | null>(null);
	const me = useAuth().user?.id;
	const iam = useAccess().gate("iam");

	const open = creating || search.get("new") === "1";
	const close = () => {
		setCreating(false);
		if (search.has("new"))
			updateSearch((prev) => {
				prev.delete("new");
				return prev;
			});
	};

	const columns = useMemo<ColumnDef<IamTokenRow>[]>(
		() => [
			{
				id: "token",
				header: "Token",
				cell: ({ row }) => (
					<span className="inline-flex items-center gap-2">
						<span className="font-mono">{row.original.name}</span>
						<span className="font-mono text-muted-foreground">
							…{row.original.last_four}
						</span>
						{row.original.expired ? (
							<Badge variant="soft" tone="warning" size="xs">
								Expired
							</Badge>
						) : null}
					</span>
				),
			},
			{
				id: "holder",
				header: "Holder",
				cell: ({ row }) =>
					row.original.holder.kind === "service"
						? `${row.original.holder.username} (service)`
						: row.original.holder.username,
			},
			{
				id: "narrowed",
				header: "Narrowed to",
				cell: ({ row }) => (
					<span
						className="block max-w-80 truncate text-muted-foreground"
						title={row.original.narrowed_to}
					>
						{row.original.narrowed_to}
					</span>
				),
			},
			{
				id: "graph",
				header: "Graph",
				cell: ({ row }) =>
					row.original.graph_bound ? (
						"this Graph"
					) : (
						<span className="text-muted-foreground">
							every Graph of {row.original.holder.username}'s
						</span>
					),
			},
			{
				id: "expires",
				header: "Expires",
				cell: ({ row }) =>
					date(row.original.expires_at) ?? (
						<span className="text-muted-foreground">never</span>
					),
			},
			{
				id: "used",
				header: "Last used",
				cell: ({ row }) =>
					date(row.original.last_used_at) ?? (
						<span className="text-muted-foreground">never used</span>
					),
			},
			{
				id: "created",
				header: "Created",
				cell: ({ row }) => date(row.original.created_at),
			},
			{
				id: "created_by",
				header: "Created by",
				cell: ({ row }) =>
					row.original.created_by ?? (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				id: "actions",
				header: "",
				meta: { align: "right" },
				cell: ({ row }) =>
					row.original.holder.user_id === me ? (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setRevoking(row.original)}
						>
							Revoke
						</Button>
					) : (
						<ActButton
							area="iam"
							variant="ghost"
							size="sm"
							onClick={() => setRevoking(row.original)}
						>
							Revoke
						</ActButton>
					),
			},
		],
		[me],
	);

	const page = query.data;
	// The caller's own tokens, counted only when every row is on screen; past
	// a page the engine's refusal at the ceiling is the word.
	const atCeiling =
		!!page &&
		page.total <= page.items.length &&
		page.items.filter((t) => t.holder.user_id === me).length >= page.max_tokens;
	const newToken = (
		<NewTokenButton
			atCeiling={atCeiling}
			max={page?.max_tokens}
			onClick={() => setCreating(true)}
		/>
	);

	return (
		<SectionPage
			section="tokens"
			chips={
				page ? (
					<Badge variant="outline" tone="muted" size="xs">
						{page.total} tokens
					</Badge>
				) : null
			}
			actions={newToken}
		>
			<SectionBody>
				{query.isLoading ? (
					<Spinner />
				) : query.error ? (
					<EmptyState
						title="Could not read the tokens"
						description={query.error.message}
						actions={
							<Button
								size="sm"
								variant="outline"
								onClick={() => void query.refetch()}
							>
								Try again
							</Button>
						}
					/>
				) : (
					<DataTable
						columns={columns}
						data={page?.items ?? []}
						enableSorting={false}
						getRowId={(row) => row.id}
						emptyState={
							<EmptyState
								icon={<KeyRound className="size-6" />}
								title="No tokens reach this Graph yet"
								description={
									iam.allowed
										? "Mint one for a script, CI or Claude Code — for yourself, or for a service account. The secret is shown once."
										: "Mint one for a script, CI or Claude Code. The secret is shown once."
								}
								actions={newToken}
							/>
						}
					/>
				)}
			</SectionBody>
			<NewTokenDialog
				username={username}
				graphSlug={graphSlug}
				open={open}
				expiryChoices={page?.expiry_day_choices ?? []}
				onClose={close}
			/>
			<RevokeTokenDialog
				username={username}
				graphSlug={graphSlug}
				token={revoking}
				onClose={() => setRevoking(null)}
			/>
		</SectionPage>
	);
}

/** *New token* — disabled, saying why, once the caller holds the ceiling. */
function NewTokenButton({
	atCeiling,
	max,
	onClick,
}: {
	atCeiling: boolean;
	max: number | undefined;
	onClick: () => void;
}) {
	const reason = `You hold the maximum of ${max} tokens. Revoke one to mint another.`;
	const button = (
		<Button
			size="sm"
			disabled={atCeiling}
			aria-description={atCeiling ? reason : undefined}
			onClick={onClick}
		>
			<Plus className="size-4" />
			New token
		</Button>
	);
	if (!atCeiling) return button;
	return (
		<TooltipProvider>
			<Tooltip delayDuration={0}>
				<TooltipTrigger asChild>
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button cannot take focus, so its wrapper carries the reason to keyboard users */}
					<span tabIndex={0} className="inline-flex">
						{button}
					</span>
				</TooltipTrigger>
				<TooltipContent>{reason}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/** Confirms by name; on success the row leaves the list. */
function RevokeTokenDialog({
	username,
	graphSlug,
	token,
	onClose,
}: {
	username: string;
	graphSlug: string;
	token: IamTokenRow | null;
	onClose: () => void;
}) {
	const { revoke } = useTokenMutations({ username, graphSlug });
	const close = () => {
		revoke.reset();
		onClose();
	};
	return (
		<Dialog open={token !== null} onOpenChange={(next) => !next && close()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Revoke '{token?.name}'?</DialogTitle>
					<DialogDescription>
						Anything still using it is refused from the next call. A new token
						is a new secret.
					</DialogDescription>
				</DialogHeader>
				<FormError error={revoke.error} />
				<DialogFooter>
					<Button variant="ghost" onClick={close}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={revoke.isPending}
						onClick={() =>
							token &&
							revoke.mutate(token.id, {
								onSuccess: () => {
									toast.success(`'${token.name}' revoked.`);
									close();
								},
							})
						}
					>
						{revoke.isPending ? "Revoking…" : "Revoke token"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
