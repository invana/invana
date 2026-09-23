/**
 * The two pieces every rule surface is made of — the row and the form.
 *
 * A rule reads the same wherever it is offered from: the Graph's `Rules`
 * drawer and a Project's **Working rules** section both draw *the statement is
 * the row*, with kind, scope and citation count underneath
 * ([RulesPanel · RulesProject](docs/for-developers/modules/skills/features/rules.md)).
 * Two copies of that would be two chances to disagree about what a rule looks
 * like, so both surfaces compose these.
 *
 * Neither piece knows which scope it is drawing. The form takes an
 * `onSubmit` rather than a mutation, because *which list a new rule joins* is
 * the caller's fact — a Graph's invariants or one Project's working rules
 * ([RU2](docs/for-developers/modules/skills/features/rules.md#decisions)) — and
 * the row takes `readOnly` for the same reason: an inherited invariant is not
 * editable from the project that inherits it ([RU8](docs/for-developers/modules/skills/features/rules.md#decisions)).
 */

import type { Rule } from "@/types/skills";
import { Textarea } from "@invana/forms";
import { Badge, Button } from "@invana/ui";
import { useState } from "react";

/** Past which length a statement reads as two rules (RU1). Nudged, never refused. */
const LONG = 160;

/** The statement is the row; everything else is underneath it. */
export function RuleStatementRow({
	rule,
	onClick,
	readOnly,
	trailing,
}: {
	rule: Rule;
	onClick?: () => void;
	/** Drawn as inherited: dimmed, and not a control (RU8). */
	readOnly?: boolean;
	trailing?: React.ReactNode;
}) {
	const body = (
		<>
			<p
				className={`text-base ${
					rule.active
						? "text-foreground"
						: "text-muted-foreground line-through decoration-muted-foreground/40"
				}`}
			>
				{rule.statement}
			</p>
			<div className="mt-0.5 flex items-center gap-1.5 text-base text-muted-foreground">
				<Badge variant="secondary">{rule.kind}</Badge>
				<span>{rule.scope}</span>
				<span>·</span>
				<span>
					{rule.citations} {rule.citations === 1 ? "citation" : "citations"}
				</span>
				{rule.active ? null : <span className="ml-auto">not offered</span>}
			</div>
		</>
	);

	if (readOnly)
		return (
			<div className="border-b px-3 py-2 opacity-60 last:border-b-0">
				{body}
			</div>
		);

	if (!onClick)
		return (
			<div className="border-b px-3 py-2 last:border-b-0">
				{body}
				{trailing}
			</div>
		);

	return (
		<button
			type="button"
			onClick={onClick}
			className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
		>
			{body}
		</button>
	);
}

/** One statement. If it needs a paragraph it is two rules (RU1). */
export function RuleStatementForm({
	existing,
	pending,
	onSubmit,
	onCancel,
}: {
	existing?: Rule;
	pending: boolean;
	onSubmit: (statement: string, done: () => void) => void;
	onCancel: () => void;
}) {
	const [statement, setStatement] = useState(existing?.statement ?? "");
	const long = statement.trim().length > LONG;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const value = statement.trim();
				if (!value) return;
				onSubmit(value, () => setStatement(""));
			}}
			className="space-y-1.5 px-3 py-2"
		>
			<Textarea
				value={statement}
				onChange={(e) => setStatement(e.target.value)}
				rows={2}
				placeholder="Prices are in rupees."
				className="resize-y text-base"
			/>
			{long ? (
				// Accepted, with a nudge — the seam the feature file names.
				<p className="text-base text-muted-foreground">
					That reads like more than one rule. A rule is one statement; two
					statements are two rules, each cited on its own.
				</p>
			) : null}
			<div className="flex items-center gap-1.5">
				<Button
					type="submit"
					size="sm"
					className="h-6 text-base"
					disabled={pending || !statement.trim()}
				>
					{pending ? "Saving…" : existing ? "Publish" : "Create"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					className="h-6 text-base"
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
