/**
 * W3 · authoring a world, and G2 · authoring a guardrail — **one editor**.
 *
 * *As someone deciding what a question may rest on, I want to say it by picking
 * from what this Graph declares and be told what a save would be refused for
 * while I am still looking at the form, so that I am choosing a bound rather
 * than discovering one at run time.*
 *
 * A guardrail and a world are one record separated by `kind`
 * ([GV1](../../../../../docs/for-developers/modules/govern/spec.md)), so they
 * are one form. `kind` changes four things and nothing else: the word on the
 * header, whether the name field publishes, whether the save asks for the
 * impact first, and whether the `cast` section is drawn.
 *
 * **Validation is the design, not a nicety.** A world is checked against the
 * guardrails **at save**, not at run
 * ([WO3](../../../../../docs/for-developers/modules/govern/features/worlds.md))
 * — a world that cannot legally run is a world nobody should be able to save
 * and then wonder about. This form asks the same question on every edit, so the
 * two refusals the design draws land on the rule that caused them:
 *
 * | Refusal | Reads |
 * |---|---|
 * | `widens_guardrail` | names the guardrail's rule, with the pattern as recourse |
 * | `undeclared_axis` | names the model **and** the axis, and sends you to the model editor |
 *
 * **The refusal wording is the CLI's wording.** A person reading a refusal in a
 * terminal and the same refusal in this form must not get two sentences, so
 * every string below the fold is the server's — this file adds the recourse
 * button and nothing else.
 */

import {
	useParticipantsQuery,
	useValidateLensMutation,
} from "@/hooks/queries/useGovern";
import {
	RuleBuilder,
	blankRule,
} from "@/pages/graphs-detail/features/govern/RuleBuilder";
import {
	GOVERNED_LAYERS,
	layerSummary,
} from "@/pages/graphs-detail/features/govern/narrowing";
import type {
	CastRole,
	GovernLayer,
	GovernRule,
	Lens,
	LensCreate,
	Participant,
	Refusal,
} from "@/types/govern";
import { LAYER_PALETTE } from "@/ui/layerPalette";
import { Checkbox, Input, Label } from "@invana/forms";
import {
	Button,
	CAST_ROLES,
	CannotAnswerCard,
	Eyebrow,
	LayerChip,
	LayerSection,
	RichSelect,
	RuleRow,
	Spinner,
} from "@invana/ui";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface LensDraft {
	name: string;
	rules: GovernRule[];
	cast: Partial<Record<CastRole, string>>;
	closed_layers: GovernLayer[];
	as_of: string | null;
}

export function draftOf(lens?: Lens | null): LensDraft {
	return {
		name: lens?.name ?? "",
		rules: lens?.rules ? structuredClone(lens.rules) : [],
		cast: { ...(lens?.cast ?? {}) },
		closed_layers: [...(lens?.closed_layers ?? [])],
		as_of: lens?.as_of ?? null,
	};
}

export interface LensEditorProps {
	username?: string;
	graphSlug?: string;
	kind: "world" | "guardrail";
	/** Absent on a new one. Present, the form opens on what it already says. */
	lens?: Lens | null;
	onSave: (payload: LensCreate) => void;
	onCancel: () => void;
	isSaving?: boolean;
	/** What the server refused the **save** for, when it did. */
	saveRefusals?: Refusal[];
}

export function LensEditor({
	username,
	graphSlug,
	kind,
	lens,
	onSave,
	onCancel,
	isSaving,
	saveRefusals,
}: LensEditorProps) {
	const [draft, setDraft] = useState<LensDraft>(() => draftOf(lens));
	// Which rule the builder is open on. `-1` is *a new one*; `null` is closed.
	const [editing, setEditing] = useState<number | null>(null);
	const [rule, setRule] = useState<GovernRule>(blankRule());

	const catalogue = useParticipantsQuery(username, graphSlug);
	// A cast resolves to an **llm** address and to nothing else, so the picker
	// offers that layer of the catalogue and no other (WO7).
	const models = useMemo(
		() => (catalogue.data?.items ?? []).filter((p) => p.layer === "llm"),
		[catalogue.data],
	);
	const validate = useValidateLensMutation(username, graphSlug);

	// The same check the save performs, offered before it. Debounced, because
	// the answer is worth a request per pause and not one per keystroke.
	//
	// `mutate` is depended on rather than the mutation object: TanStack keeps it
	// stable for the life of the hook, while the object is new on every render
	// — including the renders this effect's own result causes, which would make
	// it re-fire forever.
	const { rules, cast, closed_layers } = draft;
	const { mutate: check } = validate;
	useEffect(() => {
		const t = setTimeout(() => check({ rules, cast, closed_layers }), 250);
		return () => clearTimeout(t);
	}, [rules, cast, closed_layers, check]);

	const refusals = saveRefusals ?? validate.data?.refusals ?? [];
	const warnings = validate.data?.warnings ?? [];
	const byRule = useMemo(() => {
		const map = new Map<string, Refusal[]>();
		for (const r of refusals) map.set(r.rule, [...(map.get(r.rule) ?? []), r]);
		return map;
	}, [refusals]);

	const isNamed = Boolean(lens?.is_named);
	// A guardrail is never unnamed — it is the object an auditor is handed, and
	// an anonymous one is not (GR1).
	const nameRequired = kind === "guardrail";
	const canSave =
		!isSaving && refusals.length === 0 && (!nameRequired || draft.name.trim());

	const commitRule = () => {
		setDraft((d) => ({
			...d,
			rules:
				editing === -1 || editing === null
					? [...d.rules, rule]
					: d.rules.map((r, i) => (i === editing ? rule : r)),
		}));
		setEditing(null);
	};

	return (
		<div className="flex min-w-0 flex-col gap-4">
			{/* ── naming ────────────────────────────────────────────────────── */}
			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow>{kind === "world" ? "Name" : "What it is called"}</Eyebrow>
				<div className="flex min-w-0 flex-col gap-1 pt-1">
					<Input
						inputSize="sm"
						aria-label="Name"
						value={draft.name}
						placeholder={kind === "world" ? "EU · H1 2026" : "Graph guardrails"}
						onChange={(e) => setDraft({ ...draft, name: e.target.value })}
					/>
					{/* The field says what it does (WO2). Somebody labelling a past run
					    for their own memory must not publish it without being told. */}
					<p className="text-sm text-muted-foreground">
						{kind === "guardrail"
							? "In force on every run in this Graph, whatever world a question is asked under."
							: isNamed
								? "It is already in the Worlds list, so a rename is a rename — only the first naming publishes."
								: "Name it to add it to Worlds. Left blank it stays attached to your run and private to you."}
					</p>
				</div>
			</section>

			{/* ── the rules, grouped by the layer each one governs ──────────── */}
			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow
					aside={
						<Button
							variant="ghost"
							size="sm"
							className="h-auto p-0 text-sm"
							onClick={() => {
								setRule(blankRule());
								setEditing(-1);
							}}
						>
							<Plus className="size-3" /> Add
						</Button>
					}
				>
					Rules
				</Eyebrow>
				<div className="flex min-w-0 flex-col gap-4 pt-1">
					{GOVERNED_LAYERS.map((layer) => {
						const indices = draft.rules
							.map((r, i) => [r, i] as const)
							.filter(([r]) => (r.match.split("/")[0] ?? "") === layer);
						return (
							<LayerSection
								key={layer}
								layer={layer}
								summary={layerSummary(
									{
										rules: draft.rules,
										closed_layers: draft.closed_layers,
									} as Lens,
									layer,
								)}
							>
								{indices.map(([r, i]) => (
									<div
										key={`${r.match}-${i}`}
										className="flex min-w-0 flex-col gap-1"
									>
										<div className="flex min-w-0 items-start gap-1">
											<button
												type="button"
												className="min-w-0 flex-1 text-left"
												onClick={() => {
													setRule(structuredClone(r));
													setEditing(i);
												}}
											>
												<RuleRow
													match={r.match}
													allow={r.allow}
													properties={r.properties}
													select={r.select}
													egress={
														r.egress?.may_send
															? { may_send: r.egress.may_send }
															: undefined
													}
												/>
											</button>
											<Button
												variant="ghost"
												size="icon-xs"
												aria-label={`Remove ${r.match}`}
												onClick={() =>
													setDraft((d) => ({
														...d,
														rules: d.rules.filter((_, j) => j !== i),
													}))
												}
											>
												<Trash2 className="size-3" />
											</Button>
										</div>
										{/* A refusal lands **on the rule that caused it**, not in a
										    list at the bottom: a form with six rules and one
										    refusal at the foot makes the reader find it. */}
										{(byRule.get(r.match) ?? []).map((refusal) => (
											<RefusalCard key={refusal.code} refusal={refusal} />
										))}
										{editing === i ? (
											<RuleBuilder
												value={rule}
												onChange={setRule}
												onCommit={commitRule}
												onCancel={() => setEditing(null)}
												catalogue={catalogue.data}
												isLoading={catalogue.isLoading}
												commitLabel="Save rule"
											/>
										) : null}
									</div>
								))}
							</LayerSection>
						);
					})}

					{editing === -1 ? (
						<RuleBuilder
							value={rule}
							onChange={setRule}
							onCommit={commitRule}
							onCancel={() => setEditing(null)}
							catalogue={catalogue.data}
							isLoading={catalogue.isLoading}
						/>
					) : null}
				</div>
			</section>

			{/* ── closing a layer is a stated field, never inferred (GV23) ──── */}
			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow aside="what is not named is out">Closed layers</Eyebrow>
				<div className="flex flex-col gap-1.5 pt-1">
					<p className="text-sm text-muted-foreground">
						A layer ticked here admits only what its rules allow. One left
						unticked is permitted whole — stated rather than inferred, because
						an implicit allow-list is a bound an auditor cannot see.
					</p>
					<div className="flex flex-wrap gap-x-3 gap-y-1.5">
						{GOVERNED_LAYERS.map((layer) => (
							<span key={layer} className="flex items-center gap-1.5">
								<Checkbox
									id={`closed-${layer}`}
									checked={draft.closed_layers.includes(layer)}
									onCheckedChange={(checked) =>
										setDraft((d) => ({
											...d,
											closed_layers: checked
												? [...d.closed_layers, layer]
												: d.closed_layers.filter((l) => l !== layer),
										}))
									}
								/>
								<Label htmlFor={`closed-${layer}`}>
									<LayerChip layer={layer} palette={LAYER_PALETTE} />
								</Label>
							</span>
						))}
					</div>
				</div>
			</section>

			{/* ── the cast ──────────────────────────────────────────────────── */}
			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow aside="role → model. Innermost wins, then it is checked">
					Cast
				</Eyebrow>
				<div className="flex min-w-0 flex-col gap-1.5 pt-1">
					{CAST_ROLES.map((role) => (
						<CastPicker
							key={role}
							role={role}
							address={draft.cast[role]}
							models={models}
							onChange={(address) =>
								setDraft((d) => {
									const next = { ...d.cast };
									if (address) next[role] = address;
									else delete next[role];
									return { ...d, cast: next };
								})
							}
						/>
					))}
					{models.length ? null : (
						<p className="text-sm text-muted-foreground">
							No models are configured, so there is nothing to cast to. A role
							left uncast falls through to whatever the plan or the agent says.
						</p>
					)}
				</div>
			</section>

			{/* ── transaction time (C12 · WO9) ──────────────────────────────── */}
			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow aside={draft.as_of ? undefined : "now"}>As of</Eyebrow>
				<div className="flex min-w-0 flex-col gap-1 pt-1">
					<Input
						inputSize="sm"
						type="date"
						aria-label="As of"
						value={draft.as_of?.slice(0, 10) ?? ""}
						onChange={(e) =>
							setDraft({ ...draft, as_of: e.target.value || null })
						}
					/>
					<p className="text-sm text-muted-foreground">
						Which model versions and stitches are in view — transaction time. It
						composes with a rule's own time slice, which is valid time.
					</p>
				</div>
			</section>

			{/* ── what a save would be refused for, and what it would only warn
			    about. Refusals already sit on their rule above; these are the ones
			    naming no rule of this draft. ──────────────────────────────── */}
			{refusals
				.filter((r) => !draft.rules.some((rule) => rule.match === r.rule))
				.map((refusal) => (
					<RefusalCard
						key={`${refusal.code}-${refusal.rule}`}
						refusal={refusal}
					/>
				))}
			{/* A warning is a sentence, not an eyebrow: `Eyebrow` uppercases, and a
			    whole sentence in caps reads as an alarm rather than as the note it
			    is — *this rule matches nothing right now* is worth saying and is
			    not a refusal. */}
			{warnings.map((warning) => (
				<p
					key={`${warning.code}-${warning.rule}`}
					className="text-sm text-warning"
				>
					{warning.message}
				</p>
			))}

			<div className="flex items-center gap-2">
				{validate.isPending ? (
					<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Spinner className="size-3" /> checking against the guardrails
					</span>
				) : refusals.length ? (
					<span className="text-sm text-destructive">
						{refusals.length} refusal{refusals.length > 1 ? "s" : ""} — nothing
						is saved while one stands
					</span>
				) : (
					<span className="text-sm text-muted-foreground">
						Validated against this Graph's guardrails
					</span>
				)}
				<Button
					variant="ghost"
					size="sm"
					className="ml-auto"
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button
					size="sm"
					disabled={!canSave}
					onClick={() =>
						onSave({
							name: draft.name.trim() || null,
							kind,
							rules: draft.rules,
							cast: draft.cast,
							closed_layers: draft.closed_layers,
							as_of: draft.as_of,
						})
					}
				>
					{isSaving
						? "Saving…"
						: kind === "world"
							? "Save world"
							: "Save guardrail"}
				</Button>
			</div>
		</div>
	);
}

/**
 * One refusal, in the server's own words, with its recourse as the way out.
 *
 * `CannotAnswerCard` is the shape — *the bound named, plus what would change
 * the answer* — and a refusal with no next step is a dead end that leaves the
 * reader unable to tell *never* from *not yet*
 * ([GR4](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 */
function RefusalCard({ refusal }: { refusal: Refusal }) {
	return (
		<CannotAnswerCard
			label="refused"
			remedy={
				refusal.recourse ? (
					<span className="font-mono">{refusal.recourse}</span>
				) : undefined
			}
		>
			{refusal.message}
		</CannotAnswerCard>
	);
}

/**
 * One role, bound to a model — by picking from the configured providers.
 *
 * A plan names a **role** and the cast resolves it
 * ([GV10](../../../../../docs/for-developers/modules/govern/spec.md)): `decide`
 * says *how much this matters*, which stays true when the model line-up moves.
 * That is why this offers the role's meaning beside the model and not a bare
 * dropdown of ids.
 */
function CastPicker({
	role,
	address,
	models,
	onChange,
}: {
	role: CastRole;
	address?: string;
	models: Participant[];
	onChange: (address: string | undefined) => void;
}) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<Label className="w-14 shrink-0">{role}</Label>
			<RichSelect
				className="min-w-0 flex-1"
				label={`Cast ${role}`}
				placeholder="falls through"
				value={address ?? ""}
				onChange={(v) => onChange((v as string) || undefined)}
				options={[
					{
						value: "",
						label: "falls through",
						description: "whatever the plan or the agent casts",
					},
					...models.map((m) => ({
						value: m.address,
						label: m.name,
						description: m.label,
					})),
				]}
			/>
		</div>
	);
}
