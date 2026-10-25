/**
 * *New policy* — a name, custom or boundary, and what it is for. The engine
 * writes it as a draft held by nobody; its page opens to add statements and
 * limits, and nothing changes until it is saved. A taken name or one outside
 * `[a-z0-9-]` is refused in place with the engine's words.
 */

import {
	Field,
	FieldDescription,
	FieldLabel,
	Input,
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
	SegmentedControl,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { usePolicyMutations } from "../queries";

/** Mounted only while it is open. */
export function NewPolicyDialog({
	username,
	graphSlug,
	onClose,
	onCreated,
}: {
	username: string;
	graphSlug: string;
	onClose: () => void;
	/** The draft is written: open its page. */
	onCreated: (name: string) => void;
}) {
	const { create } = usePolicyMutations({ username, graphSlug });
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"custom" | "boundary">("custom");
	const [description, setDescription] = useState("");
	const trimmed = name.trim();

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>New policy</DialogTitle>
					<DialogDescription>
						It starts as a draft, held by nobody — nothing changes until you
						save it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="policy-name">Name</FieldLabel>
						<Input
							id="policy-name"
							className="font-mono"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="fare-team-quota"
						/>
						<FieldDescription>Lower case, digits and -.</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Kind</FieldLabel>
						<SegmentedControl
							size="sm"
							aria-label="Kind"
							value={kind}
							onValueChange={(v) => setKind(v as "custom" | "boundary")}
							options={[
								{ value: "custom", label: "Custom" },
								{ value: "boundary", label: "Boundary" },
							]}
						/>
						<FieldDescription>
							{kind === "custom"
								? "Held by the people, groups and agents you attach it to."
								: "The most anyone in this Graph may do, whatever else they hold — it is never attached."}
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="policy-description">What it is for</FieldLabel>
						<Textarea
							id="policy-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Fares read, web read, limits for fare-team"
						/>
					</Field>
					<FormError error={create.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!trimmed || create.isPending}
						onClick={() =>
							create.mutate(
								{
									name: trimmed,
									kind,
									description: description.trim() || undefined,
								},
								{ onSuccess: (policy) => onCreated(policy.name) },
							)
						}
					>
						{create.isPending ? "Creating…" : "Create draft"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
