/**
 * Profile › Access tokens
 * (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
 *
 * A token carries the person's identity, not a scope (PT1) — so this surface has
 * no permission picker, and never suggests one. The two things it must get right
 * are the secret being shown exactly once (PT2) and revocation being one click
 * away from the row that names it.
 *
 * The expiry choices and the ceiling come from the list response, not from a
 * constant here (C10): the deployment configures them.
 */

import { authApi } from "@/services/api/auth";
import { ApiError } from "@/services/api/client";
import type {
	PersonalAccessToken,
	PersonalAccessTokenList,
} from "@/types/auth";
import {
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { Check, Copy, KeySquare, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const NEVER = "never";

export function AccessTokensTab() {
	const [listing, setListing] = useState<PersonalAccessTokenList | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	// The secret, held only for as long as the dialog is open (PT2).
	const [minted, setMinted] = useState<{ name: string; secret: string } | null>(
		null,
	);
	const [revoking, setRevoking] = useState<PersonalAccessToken | null>(null);
	// The form lives in a dialog: the section is a list, not a form with a list
	// under it (PT10).
	const [creating, setCreating] = useState(false);

	const load = useCallback(async () => {
		try {
			setListing(await authApi.listTokens());
			setLoadError(null);
		} catch (err) {
			setLoadError(
				err instanceof ApiError ? err.message : "Could not load your tokens.",
			);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	if (loadError) {
		return (
			<div className="p-4">
				<EmptyState
					icon={<KeySquare className="size-6" />}
					title="Could not load your tokens"
					description={loadError}
					actions={
						<Button variant="outline" onClick={() => void load()}>
							Try again
						</Button>
					}
				/>
			</div>
		);
	}

	if (!listing) {
		return (
			<div className="space-y-3 p-4">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
			</div>
		);
	}

	const atCeiling = listing.tokens.length >= listing.max_tokens;

	return (
		<div className="space-y-6 p-4">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">Access tokens</h2>
					<p className="text-muted-foreground text-base">
						A token calls the API as you — every Graph you are a member of, with
						the same access you have. Give one to a script or a CI job instead
						of your password, and revoke it the moment it is no longer needed.
					</p>
				</div>
				<Button
					className="shrink-0"
					disabled={atCeiling}
					onClick={() => setCreating(true)}
				>
					<Plus className="size-4" />
					New token
				</Button>
			</div>

			{atCeiling ? (
				<p className="text-base text-muted-foreground">
					You hold the maximum of {listing.max_tokens} tokens. Revoke one to
					create another.
				</p>
			) : null}

			{listing.tokens.length === 0 ? (
				<EmptyState
					icon={<KeySquare className="size-6" />}
					title="No access tokens yet"
					description="Create one and it appears here. The secret is shown once, at that moment, and never again."
					actions={
						<Button disabled={atCeiling} onClick={() => setCreating(true)}>
							<Plus className="size-4" />
							New token
						</Button>
					}
				/>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Token</TableHead>
							<TableHead>Created</TableHead>
							<TableHead>Last used</TableHead>
							<TableHead>Expires</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{listing.tokens.map((token) => (
							<TableRow key={token.id}>
								<TableCell className="font-medium">
									{token.name}
									{token.expired ? (
										<Badge variant="outline" className="ml-2">
											Expired
										</Badge>
									) : null}
								</TableCell>
								<TableCell className="font-mono text-muted-foreground">
									invana_pat_…{token.last_four}
								</TableCell>
								<TableCell>{formatDate(token.created_at)}</TableCell>
								<TableCell>
									{token.last_used_at ? (
										formatDate(token.last_used_at)
									) : (
										<span className="text-muted-foreground">Never used</span>
									)}
								</TableCell>
								<TableCell>
									{token.expires_at ? (
										formatDate(token.expires_at)
									) : (
										<span className="text-muted-foreground">No expiry</span>
									)}
								</TableCell>
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setRevoking(token)}
									>
										Revoke
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<NewTokenDialog
				open={creating}
				expiryChoices={listing.expiry_day_choices}
				minted={minted}
				onMinted={async (name, secret) => {
					setMinted({ name, secret });
					await load();
				}}
				onClose={() => {
					setCreating(false);
					setMinted(null);
				}}
			/>
			<RevokeDialog
				token={revoking}
				onClose={() => setRevoking(null)}
				onRevoked={async () => {
					setRevoking(null);
					await load();
				}}
			/>
		</div>
	);
}

// ─── Minting ────────────────────────────────────────────────────────────────

/**
 * One dialog, two states: the form, then the secret it produced. Chaining two
 * dialogs would ask the person to dismiss a form they already submitted, and
 * the secret is the only reason they opened it.
 */
function NewTokenDialog({
	open,
	expiryChoices,
	minted,
	onMinted,
	onClose,
}: {
	open: boolean;
	expiryChoices: number[];
	minted: { name: string; secret: string } | null;
	onMinted: (name: string, secret: string) => Promise<void>;
	onClose: () => void;
}) {
	const [name, setName] = useState("");
	const [expiry, setExpiry] = useState<string>(
		expiryChoices.length > 0 ? String(expiryChoices[0]) : NEVER,
	);
	const [submitting, setSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);

	function reset() {
		setName("");
		setExpiry(expiryChoices.length > 0 ? String(expiryChoices[0]) : NEVER);
		setCopied(false);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const created = await authApi.createToken(
				name.trim(),
				expiry === NEVER ? null : Number(expiry),
			);
			await onMinted(created.token.name, created.secret);
		} catch (err) {
			// The engine names what it refused — a duplicate name, or the ceiling.
			toast.error(
				err instanceof ApiError ? err.message : "Could not create the token.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	async function copy() {
		if (!minted) return;
		try {
			await navigator.clipboard.writeText(minted.secret);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Could not copy. Select the token and copy it by hand.");
		}
	}

	function close() {
		reset();
		onClose();
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !next && close()}>
			<DialogContent>
				{minted ? (
					<>
						<DialogHeader>
							<DialogTitle>Copy your token now</DialogTitle>
							<DialogDescription>
								This is the only time <strong>{minted.name}</strong> is
								readable. Once you close this dialog it cannot be shown again —
								if you lose it, revoke it and create another.
							</DialogDescription>
						</DialogHeader>
						<div className="flex items-center gap-2 rounded-md border border-border bg-muted p-3">
							<code className="flex-1 break-all font-mono text-base">
								{minted.secret}
							</code>
							<Button variant="outline" size="sm" onClick={() => void copy()}>
								{copied ? (
									<Check className="size-4" />
								) : (
									<Copy className="size-4" />
								)}
								{copied ? "Copied" : "Copy"}
							</Button>
						</div>
						<DialogFooter>
							<Button onClick={close}>Done</Button>
						</DialogFooter>
					</>
				) : (
					<form onSubmit={onSubmit}>
						<DialogHeader>
							<DialogTitle>New access token</DialogTitle>
							<DialogDescription>
								It calls the API as you, for as long as you let it. Name it for
								the thing that will hold it.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="tokenName">Token name</Label>
								<Input
									id="tokenName"
									required
									maxLength={64}
									placeholder="nightly-load"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="tokenExpiry">Expires</Label>
								<Select value={expiry} onValueChange={setExpiry}>
									<SelectTrigger id="tokenExpiry" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{expiryChoices.map((days) => (
											<SelectItem key={days} value={String(days)}>
												{days} days
											</SelectItem>
										))}
										<SelectItem value={NEVER}>No expiry</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button type="button" variant="ghost" onClick={close}>
								Cancel
							</Button>
							<Button type="submit" disabled={!name.trim() || submitting}>
								{submitting ? "Creating…" : "Create token"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** Confirms by name — the row is the only thing the person can still identify
 *  the token by. */
function RevokeDialog({
	token,
	onClose,
	onRevoked,
}: {
	token: PersonalAccessToken | null;
	onClose: () => void;
	onRevoked: () => Promise<void>;
}) {
	const [submitting, setSubmitting] = useState(false);

	async function onConfirm() {
		if (!token) return;
		setSubmitting(true);
		try {
			await authApi.revokeToken(token.id);
			toast.success(`'${token.name}' revoked. Calls using it are refused now.`);
			await onRevoked();
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Could not revoke the token.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Revoke '{token?.name}'?</DialogTitle>
					<DialogDescription>
						Anything still using this token stops working immediately. This
						cannot be undone — a new token is a new secret.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={submitting}
						onClick={() => void onConfirm()}
					>
						{submitting ? "Revoking…" : "Revoke token"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString();
}
