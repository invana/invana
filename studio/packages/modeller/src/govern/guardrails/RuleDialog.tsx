/**
 * The rule dialog — *New guardrail rule*, and *Edit rule* on one.
 *
 * Three fields and nothing else, because a Graph's guardrail is one property
 * rule:
 *
 * | Field | Control |
 * |---|---|
 * | When a run touches | a pick over every `Type.property` the published versions declare, plus the `*` forms |
 * | It may | Read · Read in counts only · Never read |
 * | And the result | May leave · Stays in the Graph |
 *
 * **Impact before saving.** The engine counts what the rule would cost — the
 * worlds that read the property today and the schedules that run in them —
 * as the fields move; the line reads *Counting…* meanwhile and *Save rule*
 * waits for it. A save the server refuses (a rule that narrows nothing, a
 * target already guarded, a target nothing declares) is shown here in the
 * server's words.
 *
 * Editing keeps the target: a guardrail is named by its rule, so a new target
 * is a new guardrail.
 */

import {
	Label,
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
import { ApiError } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	useCreateGuardrailMutation,
	useGuardrailImpactQuery,
	useGuardrailTargetsQuery,
	useUpdateGuardrailMutation,
} from "../queries";
import type { Guardrail, GuardrailAccess, GuardrailRule } from "../types";
import { ACCESS_LABEL } from "./ruleText";

export interface RuleDialogProps {
	username: string;
	graphSlug: string;
	open: boolean;
	/** The guardrail edited; null authors a new one. */
	guardrail: Guardrail | null;
	onClose: () => void;
	/** The guardrail the save made or changed. */
	onSaved: (id: string) => void;
}

const ACCESSES: GuardrailAccess[] = ["read", "counts", "never"];
const LEAVES = "leaves";
const STAYS = "stays";

const message = (err: unknown, fallback: string) =>
	err instanceof ApiError || err instanceof Error ? err.message : fallback;

export function RuleDialog({
	username,
	graphSlug,
	open,
	guardrail,
	onClose,
	onSaved,
}: RuleDialogProps) {
	const [target, setTarget] = useState("");
	const [access, setAccess] = useState<GuardrailAccess>("never");
	const [leaves, setLeaves] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Each opening starts from the guardrail it opens on, or a blank rule.
	useEffect(() => {
		if (!open) return;
		setTarget(guardrail?.target ?? "");
		setAccess(guardrail?.access ?? "never");
		setLeaves(guardrail?.leaves ?? false);
		setError(null);
	}, [open, guardrail]);

	const targets = useGuardrailTargetsQuery(username, graphSlug, open);
	const options = useMemo(() => {
		const list = targets.data ?? [];
		const props = [...new Set(list.map((t) => t.property))].sort();
		const types = [...new Set(list.map((t) => t.type))].sort();
		return [
			...list.map((t) => ({ value: t.target, hint: t.model })),
			...props.map((p) => ({ value: `*.${p}`, hint: "any type" })),
			...types.map((t) => ({ value: `${t}.*`, hint: "any property" })),
		];
	}, [targets.data]);

	const rule = useMemo<GuardrailRule | null>(
		() => (open && target ? { target, access, leaves } : null),
		[open, target, access, leaves],
	);
	const impact = useGuardrailImpactQuery(username, graphSlug, rule);
	const create = useCreateGuardrailMutation(username, graphSlug);
	const update = useUpdateGuardrailMutation(username, graphSlug);
	const saving = create.isPending || update.isPending;
	const counting = !!rule && impact.isFetching;

	const save = () => {
		if (!rule) return;
		setError(null);
		const write = guardrail
			? update.mutateAsync({ id: guardrail.id, data: { access, leaves } })
			: create.mutateAsync(rule);
		write
			.then((saved) => {
				toast.success(guardrail ? "Rule saved" : "Guardrail added");
				onClose();
				onSaved(saved.id);
			})
			.catch((err: unknown) => setError(message(err, "The rule was refused.")));
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{guardrail ? `Edit ${guardrail.name}` : "New guardrail rule"}
					</DialogTitle>
					<DialogDescription>
						In force on every run in this Graph, whatever world a question is
						asked under.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="ruleTarget">When a run touches</Label>
						<Select
							value={target}
							onValueChange={setTarget}
							disabled={!!guardrail}
						>
							<SelectTrigger id="ruleTarget" className="font-mono">
								<SelectValue
									placeholder={
										targets.isLoading ? "Reading the models…" : "Type.property"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{guardrail &&
								!options.some((o) => o.value === guardrail.target) ? (
									<SelectItem value={guardrail.target}>
										{guardrail.target}
									</SelectItem>
								) : null}
								{options.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										<span className="font-mono">{o.value}</span>
										<span className="pl-2 text-muted-foreground">{o.hint}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{!targets.isLoading && !options.length && !guardrail ? (
							<p className="text-sm text-muted-foreground">
								No published model declares a property yet.
							</p>
						) : null}
					</div>

					<div className="flex flex-col gap-1.5">
						<Label>It may</Label>
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							className="justify-start"
							value={access}
							onValueChange={(v) => v && setAccess(v as GuardrailAccess)}
						>
							{ACCESSES.map((a) => (
								<ToggleGroupItem key={a} value={a}>
									{ACCESS_LABEL[a]}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label>And the result</Label>
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							className="justify-start"
							value={leaves ? LEAVES : STAYS}
							onValueChange={(v) => v && setLeaves(v === LEAVES)}
						>
							<ToggleGroupItem value={LEAVES}>May leave</ToggleGroupItem>
							<ToggleGroupItem value={STAYS}>
								Stays in the Graph
							</ToggleGroupItem>
						</ToggleGroup>
					</div>

					{rule ? (
						<Alert tone={impact.isError ? "destructive" : "warning"}>
							<TriangleAlert className="size-4" />
							<AlertDescription>
								<span className="font-semibold">Impact before saving: </span>
								{counting
									? "Counting…"
									: impact.isError
										? message(impact.error, "The impact could not be counted.")
										: (impact.data?.sentence ?? "Counting…")}
							</AlertDescription>
						</Alert>
					) : null}

					<FormError error={error} />
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!rule || counting || saving}
						onClick={save}
						title={counting ? "Waiting for the impact" : undefined}
					>
						{saving ? "Saving…" : "Save rule"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
