/**
 * IAM › Tokens › **New token** (board `iam.tokens.new`): one modal in two
 * states — the form, then the same form, held, with the secret it produced
 * under it.
 *
 * *As a person or an iam-admin, I want a token narrowed to what one job
 * needs, expiring, shown once — for me or for a service account — so that
 * software pushes data without a person's login, and a leaked key reaches
 * only that.*
 *
 * - **Holder** is yourself, or a service account of this Graph when the
 *   viewer holds iam-admin; without it the choice is yourself alone.
 * - **Narrow to** takes one statement a line, `<actions> on <resources>` —
 *   `data.version.draft on dataset/airways/airports`. Empty means all of the
 *   holder's. The engine refuses anything wider than the holder, naming it.
 * - **Expires** offers the deployment's choices, plus never.
 *
 * The secret lives in this component's state only, for as long as the modal
 * is open; closing it is the last time anyone sees it.
 */

import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { useAccess } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePeopleQuery, useTokenMutations } from "../queries";
import type { IamTokenCreated, StatementIn } from "../types";

const SELF = "self";
const NEVER = "never";
/** The expiry the form starts on, when the deployment offers it. */
const PREFERRED_DAYS = 90;

/** `in 90 days` · `never` — what the Expires select shows for a value. */
const expiryLabel = (value: string) =>
	value === NEVER ? "never" : `in ${value} days`;

/** 90 days when offered, else the first choice, else never. */
function defaultExpiry(choices: number[]): string {
	if (choices.includes(PREFERRED_DAYS)) return String(PREFERRED_DAYS);
	return choices.length ? String(choices[0]) : NEVER;
}

/** Service accounts a holder may be — every one this Graph has. */
const SERVICE_ACCOUNTS = { filters: { kind: ["service"] }, limit: 200 };

/**
 * `graph.read.* on graph/Route/*` → one statement. A line without ` on `
 * is refused here rather than guessed at.
 */
function parseNarrowing(text: string): {
	statements: StatementIn[];
	error: string | null;
} {
	const statements: StatementIn[] = [];
	const split = (s: string) => s.split(/[\s,]+/).filter(Boolean);
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		const at = line.indexOf(" on ");
		const actions = at < 0 ? [] : split(line.slice(0, at));
		const resources = at < 0 ? [] : split(line.slice(at + 4));
		if (!actions.length || !resources.length)
			return {
				statements: [],
				error: `“${line}” — write it as <actions> on <resources>.`,
			};
		statements.push({ effect: "allow", actions, resources });
	}
	return { statements, error: null };
}

export function NewTokenDialog({
	username,
	graphSlug,
	open,
	expiryChoices: choices,
	onClose,
}: {
	username: string;
	graphSlug: string;
	open: boolean;
	/** The deployment's offer, as the token list states it; never is always offered. */
	expiryChoices: number[];
	onClose: () => void;
}) {
	const { create } = useTokenMutations({ username, graphSlug });
	const iam = useAccess().gate("iam");
	const services = usePeopleQuery(
		iam.allowed && open ? username : undefined,
		graphSlug,
		SERVICE_ACCOUNTS,
	);

	const [name, setName] = useState("");
	const [holder, setHolder] = useState(SELF);
	const [narrow, setNarrow] = useState("");
	const [expiry, setExpiry] = useState<string | null>(null);
	const [minted, setMinted] = useState<IamTokenCreated | null>(null);
	const [copied, setCopied] = useState(false);

	// Derived until the person picks, so the default follows the choices
	// whenever they arrive.
	const expiresIn = expiry ?? defaultExpiry(choices);
	const parsed = parseNarrowing(narrow);

	function close() {
		setName("");
		setHolder(SELF);
		setNarrow("");
		setExpiry(null);
		setMinted(null);
		setCopied(false);
		create.reset();
		onClose();
	}

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (parsed.error) return;
		create.mutate(
			{
				name: name.trim(),
				holder_id: holder === SELF ? null : holder,
				statements: parsed.statements,
				expires_in_days: expiresIn === NEVER ? null : Number(expiresIn),
			},
			{ onSuccess: setMinted },
		);
	}

	async function copy() {
		if (!minted) return;
		try {
			await navigator.clipboard.writeText(minted.secret);
			setCopied(true);
		} catch {
			toast.error("Could not copy. Select the token and copy it by hand.");
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !next && close()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New token</DialogTitle>
					<DialogDescription>
						A key that acts as its holder, narrowed
					</DialogDescription>
				</DialogHeader>
				<form className="flex flex-col gap-4" onSubmit={submit}>
					<fieldset disabled={minted !== null} className="contents">
						<Field>
							<FieldLabel htmlFor="iam-token-name">Name</FieldLabel>
							<Input
								id="iam-token-name"
								required
								maxLength={64}
								placeholder="nightly-export"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="iam-token-holder">Holder</FieldLabel>
							<Select value={holder} onValueChange={setHolder}>
								<SelectTrigger id="iam-token-holder" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={SELF}>yourself</SelectItem>
									{(services.data?.items ?? []).map((p) => (
										<SelectItem key={p.user_id} value={p.user_id}>
											{p.username} (service account)
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{iam.allowed ? null : (
								<FieldDescription>
									A token for a service account needs the iam-admin role
									{iam.reason ? ` — ${iam.reason}` : ""}
								</FieldDescription>
							)}
						</Field>
						<Field data-invalid={parsed.error ? true : undefined}>
							<FieldLabel htmlFor="iam-token-narrow">Narrow to</FieldLabel>
							<Textarea
								id="iam-token-narrow"
								rows={1}
								className="font-mono"
								placeholder="graph.read.* on graph/Route/*"
								aria-invalid={parsed.error ? true : undefined}
								value={narrow}
								onChange={(e) => setNarrow(e.target.value)}
							/>
							{parsed.error ? (
								<FieldError>{parsed.error}</FieldError>
							) : (
								<FieldDescription>
									Never wider than the holder — anything else is refused when
									saved. One statement a line; empty is all of the holder's.
								</FieldDescription>
							)}
						</Field>
						<Field>
							<FieldLabel htmlFor="iam-token-expiry">Expires</FieldLabel>
							<Select value={expiresIn} onValueChange={setExpiry}>
								<SelectTrigger id="iam-token-expiry" className="w-full">
									<SelectValue>{expiryLabel(expiresIn)}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{choices.map((days) => (
										<SelectItem key={days} value={String(days)}>
											{expiryLabel(String(days))}
										</SelectItem>
									))}
									<SelectItem value={NEVER}>never</SelectItem>
								</SelectContent>
							</Select>
						</Field>
					</fieldset>
					{minted ? (
						<>
							<Alert tone="success">
								<KeyRound className="size-4" />
								<AlertDescription className="flex items-center gap-2">
									<span className="flex-1">
										<code className="break-all font-mono">{minted.secret}</code>{" "}
										— copy it now. It is shown once and never stored readable.
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void copy()}
									>
										{copied ? (
											<Check className="size-4" />
										) : (
											<Copy className="size-4" />
										)}
										{copied ? "Copied" : "Copy"}
									</Button>
								</AlertDescription>
							</Alert>
							<DialogFooter>
								<Button type="button" onClick={close}>
									<Check className="size-4" />
									Done
								</Button>
							</DialogFooter>
						</>
					) : (
						<>
							<FormError error={create.error} />
							<DialogFooter>
								<Button type="button" variant="ghost" onClick={close}>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={
										!name.trim() || Boolean(parsed.error) || create.isPending
									}
								>
									{create.isPending ? "Creating…" : "Create token"}
								</Button>
							</DialogFooter>
						</>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}
