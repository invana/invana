/**
 * A property's constraint on one type — opened from a row's *Edit
 * constraint* on the type page's Constraints tab (property-constraints.md).
 *
 * | Part | What it sets |
 * |---|---|
 * | Range | `min` to `max` and a unit label; either bound may be empty |
 * | Or use a standard | one standard's term whose values the property takes |
 * | When a record breaks it | *Reject* or *Flag for review* |
 * | Today | how many records in the graph break the unsaved constraint — the engine counts |
 *
 * Picking a standard empties the range, and typing a bound sets the standard
 * back to none, so the body is always one kind. The count follows the form,
 * debounced; a body the engine refuses shows its reason in place of the count.
 * *Save constraint* replaces the property's constraint on the draft; *Remove
 * constraint* stages its removal.
 */

import {
	Field,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
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
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import { ApiError, suppressActionToast } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import type { ModelEditCtx } from "../model-editor/types";
import {
	useConstraintCheckQuery,
	useConstraintStandardsQuery,
	useDeletePropertyConstraintMutation,
	useSetPropertyConstraintMutation,
} from "../queries";
import type {
	ConstraintCheck,
	PropertyConstraintSet,
	ValidationRuleResponse,
} from "../types";

const NONE = "__none__";
const nf = new Intl.NumberFormat();

interface Props {
	open: boolean;
	ctx: ModelEditCtx;
	typeName: string;
	property: string;
	/** The property's range, enum or standard rule, when it has one. */
	rule?: ValidationRuleResponse;
	onClose: () => void;
}

/** `value` after it has held still for `ms`. */
function useSettled<T>(value: T, ms: number): T {
	const [settled, setSettled] = useState(value);
	useEffect(() => {
		const t = setTimeout(() => setSettled(value), ms);
		return () => clearTimeout(t);
	}, [value, ms]);
	return settled;
}

const choiceKey = (standard: string, term: string) => `${standard}::${term}`;

export function ConstraintDialog({
	open,
	ctx,
	typeName,
	property,
	rule,
	onClose,
}: Props) {
	const { username, graphSlug } = ctx;
	const standards = useConstraintStandardsQuery(username, graphSlug, open);
	const save = useSetPropertyConstraintMutation(username, graphSlug);
	const remove = useDeletePropertyConstraintMutation(username, graphSlug);

	const [min, setMin] = useState("");
	const [max, setMax] = useState("");
	const [unit, setUnit] = useState("");
	const [choice, setChoice] = useState(NONE);
	const [onBreak, setOnBreak] = useState<"reject" | "flag">("reject");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		const range = rule?.rule_type === "range" ? rule.params : {};
		setMin(range.min != null ? String(range.min) : "");
		setMax(range.max != null ? String(range.max) : "");
		setUnit(rule?.rule_type === "range" ? (rule.unit ?? "") : "");
		setChoice(
			rule?.rule_type === "standard" && rule.standard_ref && rule.term
				? choiceKey(rule.standard_ref.split("@")[0], rule.term)
				: NONE,
		);
		setOnBreak(rule?.on_break ?? "reject");
		setError(null);
	}, [open, rule]);

	const typeBound = (set: (v: string) => void) => (v: string) => {
		set(v);
		if (v) setChoice(NONE);
	};
	const pickStandard = (v: string) => {
		setChoice(v);
		if (v !== NONE) {
			setMin("");
			setMax("");
			setUnit("");
		}
	};

	const body: PropertyConstraintSet | null =
		choice !== NONE
			? {
					type: typeName,
					property,
					kind: "standard",
					standard: choice.split("::")[0],
					term: choice.split("::")[1],
					on_break: onBreak,
				}
			: min.trim() || max.trim()
				? {
						type: typeName,
						property,
						kind: "range",
						min: min.trim() ? Number(min) : null,
						max: max.trim() ? Number(max) : null,
						unit: unit.trim() || null,
						on_break: onBreak,
					}
				: null;

	// What breaks it does not depend on Reject or Flag, so the toggle never re-counts.
	const wanted =
		open && body ? JSON.stringify({ ...body, on_break: "reject" }) : "";
	const asked = useSettled(wanted, 300);
	const check = useConstraintCheckQuery(
		username,
		graphSlug,
		ctx,
		asked ? (JSON.parse(asked) as PropertyConstraintSet) : null,
	);

	const choices = standards.data ?? [];
	const busy = save.isPending || remove.isPending;

	async function run(act: () => Promise<unknown>, what: string) {
		setError(null);
		try {
			await suppressActionToast(act);
			onClose();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : `Failed to ${what}.`);
		}
	}

	const onSave = (e: React.FormEvent) => {
		e.preventDefault();
		if (!body) return;
		run(
			() =>
				save.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					data: body,
				}),
			"save the constraint",
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<form onSubmit={onSave}>
					<DialogHeader>
						<DialogTitle className="font-mono">{property}</DialogTitle>
						<DialogDescription>{typeName} · constraint</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 pt-4">
						<Field>
							<FieldLabel htmlFor="constraint-min">Range</FieldLabel>
							<div className="flex items-center gap-2">
								<Input
									id="constraint-min"
									aria-label="Lowest value"
									type="number"
									step="any"
									className="w-24"
									value={min}
									onChange={(e) => typeBound(setMin)(e.target.value)}
								/>
								<span className="text-muted-foreground">to</span>
								<Input
									aria-label="Highest value"
									type="number"
									step="any"
									className="w-24"
									value={max}
									onChange={(e) => typeBound(setMax)(e.target.value)}
								/>
								<Input
									aria-label="Unit"
									className="w-28"
									placeholder="unit"
									maxLength={32}
									value={unit}
									onChange={(e) => typeBound(setUnit)(e.target.value)}
								/>
							</div>
						</Field>
						<Field>
							<FieldLabel htmlFor="constraint-standard">
								Or use a standard
							</FieldLabel>
							<div className="flex items-center gap-2">
								<Select
									value={choice}
									onValueChange={pickStandard}
									disabled={standards.isSuccess && choices.length === 0}
								>
									<SelectTrigger id="constraint-standard" className="w-auto">
										<SelectValue
											placeholder={
												standards.isSuccess && choices.length === 0
													? "No standard has a term with values"
													: "none"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>
											{standards.isSuccess && choices.length === 0
												? "No standard has a term with values"
												: "none"}
										</SelectItem>
										{choices.map((c) => (
											<SelectItem
												key={choiceKey(c.standard, c.term)}
												value={choiceKey(c.standard, c.term)}
											>
												{c.title} · {c.term} ({nf.format(c.values)} values)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<span className="text-muted-foreground">
									a range many datasets share belongs in a standard
								</span>
							</div>
						</Field>
						<Field>
							<FieldLabel>When a record breaks it</FieldLabel>
							<ToggleGroup
								type="single"
								variant="outline"
								className="justify-start"
								value={onBreak}
								onValueChange={(v) => v && setOnBreak(v as "reject" | "flag")}
							>
								<ToggleGroupItem value="reject">Reject</ToggleGroupItem>
								<ToggleGroupItem value="flag">Flag for review</ToggleGroupItem>
							</ToggleGroup>
						</Field>
						{body ? (
							<Today
								check={check.data}
								pending={check.isFetching || asked !== wanted}
								refused={
									check.error instanceof ApiError ? check.error.message : null
								}
							/>
						) : null}
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter className="pt-4">
						{rule ? (
							<Button
								type="button"
								variant="ghost"
								className="mr-auto text-destructive"
								disabled={busy}
								onClick={() =>
									run(
										() =>
											remove.mutateAsync({
												modelId: ctx.modelId,
												versionId: ctx.versionId,
												ruleId: rule.id,
											}),
										"remove the constraint",
									)
								}
							>
								Remove constraint
							</Button>
						) : null}
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={busy || !body}>
							{save.isPending ? "Saving…" : "Save constraint"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** The *today* line: what the engine counted for the unsaved constraint. */
function Today({
	check,
	pending,
	refused,
}: {
	check: ConstraintCheck | undefined;
	pending: boolean;
	refused: string | null;
}) {
	if (refused)
		return (
			<Alert tone="destructive">
				<AlertDescription>{refused}</AlertDescription>
			</Alert>
		);
	return (
		<Alert tone="info">
			<AlertDescription>{todayLine(check, pending)}</AlertDescription>
		</Alert>
	);
}

function todayLine(check: ConstraintCheck | undefined, pending: boolean) {
	if (pending || !check) return "Counting the records that break it…";
	if (!check.counted || check.breaking == null)
		return check.reason ?? "This database cannot count them here.";
	if (check.breaking === 0) return "No record breaks it today.";
	const named = check.samples
		.map((s) => `${s.record} (${String(s.value)})`)
		.join(", ");
	const n = nf.format(check.breaking);
	return `Today ${n} ${check.breaking === 1 ? "record breaks" : "records break"} it${named ? `: ${named}` : ""}.`;
}
