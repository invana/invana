/**
 * *New alert*, and an alert rule opened from its row: what ledger rows it
 * matches and whom it tells in the inbox.
 *
 * | Part | What it sets |
 * |---|---|
 * | When | the rule's name, as the table's *When* reads it |
 * | Act · Touched | `*` patterns — `graph.write.*`, `graph/Fare`; empty matches any |
 * | Verdicts · Refused by | which outcomes match; none ticked matches any |
 * | Threshold | optionally, only past `count` matches in a window |
 * | Notifies | members, by name — sent as their ids |
 *
 * An existing rule can be deleted, after a second click. A write the engine
 * refuses shows its reason inline.
 */

import {
	Checkbox,
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	Label,
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
import { useMembersQuery } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { useAlertRuleMutations } from "./queries";
import type { AlertRule, AlertRuleCreate } from "./types";

const VERDICTS = ["allowed", "refused", "approval", "held"];
const REFUSED_BY = ["grant", "lens", "ceiling", "robots", "policy"];

/** Toggles one value in a list, keeping the list's order. */
const toggled = (list: string[], value: string) =>
	list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function Checks({
	label,
	values,
	picked,
	onPick,
	idPrefix,
}: {
	label: string;
	values: { value: string; label: string }[];
	picked: string[];
	onPick: (next: string[]) => void;
	idPrefix: string;
}) {
	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<div className="flex flex-wrap gap-x-4 gap-y-1.5">
				{values.map((v) => (
					<span key={v.value} className="inline-flex items-center gap-1.5">
						<Checkbox
							id={`${idPrefix}-${v.value}`}
							checked={picked.includes(v.value)}
							onCheckedChange={() => onPick(toggled(picked, v.value))}
						/>
						<Label htmlFor={`${idPrefix}-${v.value}`}>{v.label}</Label>
					</span>
				))}
			</div>
		</Field>
	);
}

export function AlertRuleDialog({
	username,
	graphSlug,
	rule,
	onClose,
}: {
	username: string;
	graphSlug: string;
	/** The rule to edit; absent for *New alert*. */
	rule?: AlertRule;
	onClose: () => void;
}) {
	const { create, update, remove } = useAlertRuleMutations({
		username,
		graphSlug,
	});
	const members = useMembersQuery({ username, graphSlug }).data?.items ?? [];
	const m = rule?.match;
	const [name, setName] = useState(rule?.name ?? "");
	const [act, setAct] = useState(m?.act ?? "");
	const [touched, setTouched] = useState(m?.touched ?? "");
	const [verdicts, setVerdicts] = useState<string[]>(m?.verdict ?? []);
	const [refusedBy, setRefusedBy] = useState<string[]>(m?.refused_by ?? []);
	const [count, setCount] = useState(
		m?.threshold ? String(m.threshold.count) : "",
	);
	const [minutes, setMinutes] = useState(
		m?.threshold ? String(Math.round(m.threshold.window_s / 60)) : "60",
	);
	const [notify, setNotify] = useState<string[]>(rule?.notify_user_ids ?? []);
	const [confirming, setConfirming] = useState(false);

	const busy = create.isPending || update.isPending || remove.isPending;
	const error = create.error ?? update.error ?? remove.error;
	const threshold = Number(count) > 0;
	const valid =
		!!name.trim() && notify.length > 0 && (!threshold || Number(minutes) >= 1);

	const save = () => {
		const data: AlertRuleCreate = {
			name: name.trim(),
			match: {
				act: act.trim(),
				touched: touched.trim(),
				verdict: verdicts,
				refused_by: refusedBy,
				threshold: threshold
					? { count: Number(count), window_s: Number(minutes) * 60 }
					: null,
			},
			notify_user_ids: notify,
		};
		if (rule) update.mutate({ id: rule.id, data }, { onSuccess: onClose });
		else create.mutate(data, { onSuccess: onClose });
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{rule ? rule.name : "New alert"}</DialogTitle>
					<DialogDescription>
						When a ledger row matches, tell these members in their inbox.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="alert-name">When</FieldLabel>
						<Input
							id="alert-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="An agent writes to Fare"
						/>
					</Field>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="alert-act">Act</FieldLabel>
							<Input
								id="alert-act"
								className="font-mono"
								value={act}
								onChange={(e) => setAct(e.target.value)}
								placeholder="graph.write.*"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="alert-touched">Touched</FieldLabel>
							<Input
								id="alert-touched"
								className="font-mono"
								value={touched}
								onChange={(e) => setTouched(e.target.value)}
								placeholder="graph/Fare"
							/>
						</Field>
					</div>
					<Checks
						label="Verdicts"
						idPrefix="alert-verdict"
						values={VERDICTS.map((v) => ({ value: v, label: v }))}
						picked={verdicts}
						onPick={setVerdicts}
					/>
					<Checks
						label="Refused by"
						idPrefix="alert-refused"
						values={REFUSED_BY.map((v) => ({ value: v, label: v }))}
						picked={refusedBy}
						onPick={setRefusedBy}
					/>
					<Field>
						<FieldLabel>Threshold</FieldLabel>
						<div className="flex items-center gap-2">
							<Input
								aria-label="Matches"
								type="number"
								min={1}
								className="w-24"
								value={count}
								onChange={(e) => setCount(e.target.value)}
								placeholder="any"
							/>
							<span className="text-muted-foreground">matches in</span>
							<Input
								aria-label="Minutes"
								type="number"
								min={1}
								className="w-24"
								value={minutes}
								disabled={!threshold}
								onChange={(e) => setMinutes(e.target.value)}
							/>
							<span className="text-muted-foreground">minutes</span>
						</div>
						<FieldDescription>
							Empty fires on every matching row.
						</FieldDescription>
					</Field>
					<Checks
						label="Notifies"
						idPrefix="alert-notify"
						values={members.map((mb) => ({
							value: mb.user_id,
							label: mb.username,
						}))}
						picked={notify}
						onPick={setNotify}
					/>
					<FormError error={error} />
				</div>
				<DialogFooter>
					{rule && (
						<Button
							variant={confirming ? "destructive" : "ghost"}
							className="mr-auto"
							disabled={busy}
							onClick={() =>
								confirming
									? remove.mutate(rule.id, { onSuccess: onClose })
									: setConfirming(true)
							}
						>
							{confirming ? "Delete this alert" : "Delete"}
						</Button>
					)}
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={!valid || busy} onClick={save}>
						{rule ? "Save" : "Create alert"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
