/**
 * *Edit* — a policy's description, statements and limits, in the grammar the
 * policy files use. A draft's edit is kept as the draft (*Save draft*); a saved
 * policy's edit is a new version, so it goes through its impact first
 * (*Review impact*) and carries a *why* for History.
 *
 * The engine checks the grammar: an unknown layer, an empty action or a
 * condition other than fields · depth · until is refused in place.
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
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import type { Limits, PolicyRead, StatementIn } from "../types";
import { statementIn } from "./policyParts";

/** What an edit hands back — the change, ready to review or keep. */
export interface PolicyEdit {
	description: string;
	statements: StatementIn[];
	limits: Partial<Limits>;
	why: string;
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

/** Mounted only while it is open. */
export function EditPolicyDialog({
	policy,
	pending,
	error,
	onCancel,
	onDone,
}: {
	policy: PolicyRead;
	/** The draft's update is in flight. */
	pending: boolean;
	error: Error | null;
	onCancel: () => void;
	/** A draft: keep it. A saved policy: review its impact. */
	onDone: (edit: PolicyEdit) => void;
}) {
	const draft = policy.status === "draft";
	const [description, setDescription] = useState(policy.description);
	const [statements, setStatements] = useState(
		pretty(policy.statements.map(statementIn)),
	);
	const [limits, setLimits] = useState(pretty(policy.limits));
	const [why, setWhy] = useState("");
	const [parseError, setParseError] = useState<Error | null>(null);

	const submit = () => {
		try {
			const parsedStatements = JSON.parse(statements) as StatementIn[];
			const parsedLimits = JSON.parse(limits) as Partial<Limits>;
			if (!Array.isArray(parsedStatements))
				throw new Error("Statements are a list — [ … ].");
			setParseError(null);
			onDone({
				description: description.trim(),
				statements: parsedStatements,
				limits: parsedLimits,
				why: why.trim(),
			});
		} catch (e) {
			setParseError(
				e instanceof SyntaxError
					? new Error(`Not valid JSON — ${e.message}`)
					: (e as Error),
			);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onCancel()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit {policy.name}</DialogTitle>
					<DialogDescription>
						{draft
							? "A draft — nothing changes until it is saved."
							: "Saving is a new version — it takes effect on the next check, once you have read its impact."}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="edit-description">What it is for</FieldLabel>
						<Input
							id="edit-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="edit-statements">Statements</FieldLabel>
						<Textarea
							id="edit-statements"
							className="min-h-48 font-mono"
							value={statements}
							onChange={(e) => setStatements(e.target.value)}
						/>
						<FieldDescription>
							Each allows actions on resources — `layer/…` globs — with
							conditions on fields, depth or until.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="edit-limits">Limits</FieldLabel>
						<Textarea
							id="edit-limits"
							className="min-h-32 font-mono"
							value={limits}
							onChange={(e) => setLimits(e.target.value)}
						/>
						<FieldDescription>
							Tokens a month and a run, live agents, agents a run, depth,
							worker-seconds an hour, pools, may ask for more. Null is no
							ceiling.
						</FieldDescription>
					</Field>
					{draft ? null : (
						<Field>
							<FieldLabel htmlFor="edit-why">Why</FieldLabel>
							<Input
								id="edit-why"
								value={why}
								onChange={(e) => setWhy(e.target.value)}
								placeholder="What this change is for — kept in History"
							/>
						</Field>
					)}
					<FormError error={parseError ?? error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button disabled={pending} onClick={submit}>
						{draft ? (pending ? "Saving…" : "Save draft") : "Review impact"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
