/**
 * The hand-edit — the correction the prose cannot make
 * ([SK7](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * A drawn plan is usually corrected by rewriting the sentence and drawing
 * again. This is for the two cases where that cannot work: the prose is right
 * and the reading is not, and the dead end the planner names — *no entry
 * matches this* is not rewritable, so hand-authoring is what is offered
 * instead (Seams).
 *
 * ## Row-level, and deliberately not a flow editor
 *
 * A person says **which step**, what it is called, and whether a person does it
 * instead. Nothing here draws edges: the engine materialises them from each
 * node's `${steps.X.y}` bindings and the catalogue's `requires`, so an order
 * nobody reviewed is never written down. Authoring a reusable plan is Library ›
 * Plans' surface, and keeping them apart is what stops this growing into a
 * second plan editor ([SK18](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * ## What bounds it
 *
 * The **catalogue**, not an agent's envelope — the choices come from the draft
 * read, because a list of step keys written in TypeScript would be a second
 * copy of a closed set Studio cannot see. *May **this** agent call **this**
 * step* is checked where the agent is known: at bind time
 * ([SK28](docs/for-developers/modules/skills/features/authoring-a-skill.md) ·
 * [BN5](docs/for-developers/modules/skills/features/bindings.md)).
 *
 * ## Inlining a library plan
 *
 * A row may name a **plan** instead of a step: its rows are copied in when the
 * edit is saved, flat, each carrying the plan version it came from
 * ([SK32 · SK33](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 * Reading one back, the consecutive rows sharing a `source_plan_key` collapse
 * into that single row again — otherwise editing a skill that inlined five
 * steps would quietly turn them into five steps somebody wrote, and the plan
 * would stop knowing what it composed. The arguments the plan declares are
 * tuned here, because picking and tuning are one act
 * ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
 */

import type {
	InlinablePlan,
	SkillDraftTaskWrite,
	SkillPlanRead,
	SkillStepChoice,
} from "@/types/skills";
import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Badge, Button } from "@invana/ui";
import { Plus, X } from "lucide-react";
import { useState } from "react";

/** The value the picker uses for *a person does this*. A form, not a step. */
const HUMAN = "__human__";
/** Prefix that marks a picker value as a plan to inline rather than a step. */
const USES = "uses:";

/** One editable row, before it is a `SkillDraftTaskWrite`. */
interface Row {
	/** Stable only for React — the engine mints the sibling key it writes. */
	uid: string;
	step: string;
	title: string;
	sourceSpan: string | null;
	/** Kept verbatim: the editor does not author args, so it must not drop them. */
	args: Record<string, unknown>;
	/** `nl-single@1` on an inlined row — the whole plan, as one line. */
	uses?: string;
	/** What this composition tunes, over the plan's declared defaults. */
	usesArgs?: Record<string, unknown>;
	/** How many rows it will write. Shown, because one line is not one step. */
	steps?: number;
}

let seq = 0;
function uid(): string {
	seq += 1;
	return `row-${seq}`;
}

function rowsOf(plan: SkillPlanRead): Row[] {
	const tuned = new Map<string, Record<string, unknown>>(
		plan.uses.map((u) => [`${u.key}@${u.version}`, u.args]),
	);
	const rows: Row[] = [];
	for (const node of plan.nodes) {
		const ref = node.source_plan_key;
		if (ref) {
			// Consecutive rows from one plan are the one act that wrote them.
			const last = rows.at(-1);
			if (last?.uses === ref) {
				last.steps = (last.steps ?? 0) + 1;
				continue;
			}
			rows.push({
				uid: uid(),
				step: `${USES}${ref}`,
				title: ref,
				sourceSpan: node.source_span,
				args: {},
				uses: ref,
				usesArgs: { ...(tuned.get(ref) ?? {}) },
				steps: 1,
			});
			continue;
		}
		rows.push({
			uid: uid(),
			step: node.form === "human" ? HUMAN : node.task,
			title: node.label,
			sourceSpan: node.source_span,
			args: node.args ?? {},
		});
	}
	return rows;
}

function asWrite(row: Row): SkillDraftTaskWrite {
	if (row.uses) {
		return {
			form: "uses",
			uses: row.uses,
			uses_args: row.usesArgs ?? {},
			source_span: row.sourceSpan,
		};
	}
	return row.step === HUMAN
		? {
				form: "human",
				title: row.title,
				source_span: row.sourceSpan,
			}
		: {
				form: "callable",
				step_key: row.step,
				title: row.title,
				// Args are carried through untouched — this surface tunes steps, not
				// bindings, and silently dropping one would change what runs.
				args: row.args,
				source_span: row.sourceSpan,
			};
}

export function SkillPlanEditor({
	plan,
	vocabulary,
	inlinable,
	saving,
	error,
	onSave,
	onCancel,
}: {
	plan: SkillPlanRead;
	vocabulary: SkillStepChoice[];
	inlinable: InlinablePlan[];
	saving: boolean;
	error: string | null;
	onSave: (tasks: SkillDraftTaskWrite[]) => void;
	onCancel: () => void;
}) {
	const [rows, setRows] = useState<Row[]>(() => rowsOf(plan));

	const set = (uidOf: string, patch: Partial<Row>) =>
		setRows((current) =>
			current.map((row) => (row.uid === uidOf ? { ...row, ...patch } : row)),
		);

	return (
		<div className="space-y-1.5">
			{rows.map((row, index) => {
				const choice = vocabulary.find((v) => v.step_key === row.step);
				const inlined = row.uses
					? inlinable.find((p) => p.ref === row.uses)
					: undefined;
				return (
					<div key={row.uid}>
						<div className="flex items-center gap-1.5">
							<span className="w-4 shrink-0 text-right font-mono text-base text-muted-foreground">
								{index + 1}
							</span>
							<Select
								value={row.step}
								onValueChange={(value) => {
									if (value.startsWith(USES)) {
										const ref = value.slice(USES.length);
										const picked = inlinable.find((p) => p.ref === ref);
										set(row.uid, {
											step: value,
											uses: ref,
											// Declared defaults are the engine's to apply, so an
											// untouched argument is an absent one rather than a copy
											// of a default that could move.
											usesArgs: {},
											steps: picked?.step_count ?? 0,
											title: picked?.name ?? ref,
											args: {},
										});
										return;
									}
									const picked = vocabulary.find((v) => v.step_key === value);
									set(row.uid, {
										step: value,
										uses: undefined,
										usesArgs: undefined,
										steps: undefined,
										// A title the person has not touched follows the step, so
										// picking a different one does not leave the old name on it.
										title:
											row.title === choice?.label || row.title === ""
												? (picked?.label ?? row.title)
												: row.title,
									});
								}}
							>
								<SelectTrigger className="w-52 shrink-0">
									<SelectValue placeholder="Pick a step" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={HUMAN}>a person does this</SelectItem>
									{vocabulary.map((step) => (
										<SelectItem key={step.step_key} value={step.step_key}>
											{step.step_key}
										</SelectItem>
									))}
									{inlinable.map((p) => (
										<SelectItem key={p.ref} value={`${USES}${p.ref}`}>
											{p.ref} — the whole plan
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{row.uses ? (
								<span className="flex min-w-0 flex-1 items-center gap-1.5 text-base">
									<span className="truncate text-muted-foreground">
										{inlined?.description || inlined?.name || row.uses}
									</span>
									<Badge variant="outline" className="shrink-0">
										{row.steps ?? inlined?.step_count ?? 0} steps
									</Badge>
								</span>
							) : (
								<Input
									value={row.title}
									onChange={(e) => set(row.uid, { title: e.target.value })}
									placeholder="What this step's row says"
									className="min-w-0 flex-1"
								/>
							)}
							{choice ? (
								<Badge variant="secondary" className="shrink-0">
									{choice.layer}
								</Badge>
							) : null}
							<Button
								size="sm"
								variant="ghost"
								className="h-6 shrink-0 px-1"
								aria-label={`Remove step ${index + 1}`}
								onClick={() =>
									setRows((current) => current.filter((r) => r.uid !== row.uid))
								}
							>
								<X className="size-3" />
							</Button>
						</div>
						{inlined && Object.keys(inlined.args_schema).length > 0 ? (
							<PlanArgs
								plan={inlined}
								tuned={row.usesArgs ?? {}}
								onTune={(next) => set(row.uid, { usesArgs: next })}
							/>
						) : null}
					</div>
				);
			})}

			<Button
				size="sm"
				variant="ghost"
				className="h-6 text-base"
				onClick={() =>
					setRows((current) => [
						...current,
						{ uid: uid(), step: HUMAN, title: "", sourceSpan: null, args: {} },
					])
				}
			>
				<Plus className="size-3" />
				Add a step
			</Button>

			{error ? <p className="text-base text-destructive">{error}</p> : null}

			<div className="flex items-center gap-1.5 pt-1">
				<Button
					size="sm"
					className="h-7 text-base"
					disabled={saving}
					onClick={() => onSave(rows.map(asWrite))}
				>
					{saving ? "Saving…" : "Save the plan"}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="h-7 text-base"
					disabled={saving}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<span className="ml-auto text-base text-muted-foreground">
					saving makes this plan yours — a redraw would then ask first
				</span>
			</div>
		</div>
	);
}

/**
 * The arguments an inlined plan declares, and what this skill makes of them.
 *
 * Tuning is a property of the **call** — two skills may inline one plan with
 * different values and neither is a fork, and neither edits the plan
 * ([LB19](docs/for-developers/modules/workflows/features/the-library.md)). An
 * argument left alone is left *absent* rather than written as a copy of the
 * default: the default belongs to the plan, and copying it here would freeze a
 * value the plan could later change for everyone.
 */
function PlanArgs({
	plan,
	tuned,
	onTune,
}: {
	plan: InlinablePlan;
	tuned: Record<string, unknown>;
	onTune: (next: Record<string, unknown>) => void;
}) {
	const put = (name: string, value: unknown) => {
		const next = { ...tuned };
		if (value === undefined) delete next[name];
		else next[name] = value;
		onTune(next);
	};

	return (
		<div className="mt-1 ml-6 space-y-1 border-l pl-2.5">
			{Object.entries(plan.args_schema).map(([name, spec]) => {
				const held = tuned[name];
				const showing = held === undefined ? spec.default : held;
				return (
					<div key={name} className="flex items-center gap-1.5 text-base">
						<span className="w-40 shrink-0 truncate text-muted-foreground">
							{spec.label || name}
						</span>
						{spec.type === "bool" ? (
							<Select
								value={String(showing ?? false)}
								onValueChange={(v) => put(name, v === "true")}
							>
								<SelectTrigger className="w-28 shrink-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="true">yes</SelectItem>
									<SelectItem value="false">no</SelectItem>
								</SelectContent>
							</Select>
						) : (
							<Input
								value={String(showing ?? "")}
								inputMode={spec.type === "int" ? "numeric" : "text"}
								onChange={(e) => {
									const raw = e.target.value;
									if (raw === "") return put(name, undefined);
									put(name, spec.type === "int" ? Number(raw) : raw);
								}}
								className="w-40 shrink-0"
							/>
						)}
						{held === undefined ? (
							<span className="text-muted-foreground">
								what the plan declares
							</span>
						) : (
							<button
								type="button"
								className="text-muted-foreground underline"
								onClick={() => put(name, undefined)}
							>
								use what the plan declares
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}
