/**
 * One rule, built by picking — the control set **W3 and G2 share**.
 *
 * *As someone narrowing what a run may engage, I want every part of a rule to
 * be a choice over what this Graph already declares, so that a rule I save is
 * one I can be sure bites something.*
 *
 * A world's rules and a guardrail's rules are **one grammar over five layers**
 * ([GR8](../../../../../docs/for-developers/modules/govern/features/guardrails.md)),
 * so they are one builder. Two would be two places for the grammar to drift,
 * and the two screens would start disagreeing about what `**` means.
 *
 * Three things here are the design, not the layout:
 *
 * - **Nothing is free text** ([WO7](../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 *   Layer, sublayer and name are three pickers over the live catalogue, and the
 *   wildcards are options inside them. A typo cannot become a rule that
 *   silently matches nothing, because there is no key to mistype.
 * - **The preview shows near-misses greyed rather than filtering them**
 *   ([GR9](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 *   A list of hits alone cannot distinguish *precise* from *wrong*: `Deals@1.0.0`
 *   and `Deals@*` both show one hit, and only the greyed second version says
 *   which of them survives the next publish.
 * - **`properties` and `select` are absent off `graph_data`**, not disabled
 *   (GR8). They are legal on that layer alone; a greyed control would promise a
 *   narrowing the save would refuse, naming the layer.
 */

import {
	ANY_SUBLAYER,
	type AddressParts,
	REST,
	buildMatch,
	matches,
	nameOptionsIn,
	splitMatch,
	sublayersIn,
} from "@/pages/graphs-detail/features/govern/addressing";
import { GOVERNED_LAYERS } from "@/pages/graphs-detail/features/govern/narrowing";
import type {
	CatalogueResponse,
	EgressClass,
	GovernLayer,
	GovernRule,
	Participant,
} from "@/types/govern";
import { LAYER_PALETTE } from "@/ui/layerPalette";
import {
	Checkbox,
	Input,
	Label,
	RadioGroup,
	RadioGroupItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Eyebrow,
	LayerChip,
	MatchPreview,
	SliceSummary,
	layerLabel,
} from "@invana/ui";
import { useMemo, useState } from "react";

/** What may accompany a call across the boundary. The closed set (GV11 · GV12). */
const EGRESS_CLASSES: { value: EgressClass; label: string }[] = [
	{ value: "type_names", label: "type names" },
	{ value: "property_names", label: "property names" },
	{ value: "the_question", label: "the question" },
	{ value: "property_values", label: "property values" },
	{ value: "record_ids", label: "record ids" },
	{ value: "aggregates", label: "aggregates" },
	{ value: "everything", label: "everything" },
];

export interface RuleBuilderProps {
	/** The rule being edited. A new one opens as *allow the whole layer*. */
	value: GovernRule;
	onChange: (rule: GovernRule) => void;
	onCommit: () => void;
	onCancel: () => void;
	/** The live catalogue — resolved, never stored (GV21). */
	catalogue?: CatalogueResponse;
	isLoading?: boolean;
	/** `Add rule` on a new one, `Save rule` on one being edited. */
	commitLabel?: string;
}

export function RuleBuilder({
	value,
	onChange,
	onCommit,
	onCancel,
	catalogue,
	isLoading,
	commitLabel = "Add rule",
}: RuleBuilderProps) {
	const parts = splitMatch(value.match);
	const participants = catalogue?.items ?? [];
	const layersPresent = catalogue?.layers_present ?? [];

	const setParts = (next: Partial<AddressParts>) =>
		onChange({ ...value, match: buildMatch({ ...parts, ...next }) });

	// A pattern is read against **its own layer**, because that is the set a
	// person is choosing within. Showing all five layers' participants would
	// bury three hits in forty greys and make the near-miss reading useless.
	const candidates = useMemo(
		() =>
			participants
				.filter((p) => p.layer === parts.layer)
				.map((p) => ({
					address: p.address,
					matched: matches(value.match, p.address),
				})),
		[participants, parts.layer, value.match],
	);

	const hit = useMemo(
		() => participants.find((p) => matches(value.match, p.address)),
		[participants, value.match],
	);

	const sublayers = sublayersIn(participants, parts.layer);
	const names = nameOptionsIn(participants, parts.layer, parts.sublayer);
	const isGraphData = parts.layer === "graph_data";

	return (
		<div className="flex min-w-0 flex-col gap-3 rounded-control border border-border p-2">
			{/* ── the address, as three picks ───────────────────────────────── */}
			<div className="flex min-w-0 flex-col gap-2">
				<Eyebrow>What it matches</Eyebrow>

				<Select
					value={parts.layer}
					onValueChange={(layer) =>
						// A layer change resets the two segments under it: a sublayer from
						// another layer names nothing, and a rule that carried one would
						// match nothing while looking deliberate.
						onChange({
							...value,
							match: buildMatch({
								layer: layer as GovernLayer,
								sublayer: ANY_SUBLAYER,
								name: REST,
							}),
							properties: undefined,
							select: undefined,
						})
					}
				>
					<SelectTrigger triggerSize="sm" aria-label="Layer">
						{/* Children override what Radix mirrors in. The menu row carries
						    the *nothing configured* hint; the trigger carries the pick,
						    because a 26px control cannot hold a label and a caveat and
						    stay one line. */}
						<SelectValue>
							<LayerChip layer={parts.layer} palette={LAYER_PALETTE} />
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{GOVERNED_LAYERS.map((layer) => (
							<SelectItem key={layer} value={layer}>
								<span className="flex items-center gap-2">
									<LayerChip layer={layer} palette={LAYER_PALETTE} />
									{/* *Nothing configured* and *nothing matched* are different
									    facts, and the picker is where the first one belongs. */}
									{layersPresent.includes(layer) ? null : (
										<span className="text-sm text-muted-foreground">
											nothing configured
										</span>
									)}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="flex min-w-0 gap-2">
					<Select
						value={parts.sublayer}
						onValueChange={(sublayer) => setParts({ sublayer, name: REST })}
					>
						<SelectTrigger
							triggerSize="sm"
							className="flex-1"
							aria-label="Sublayer"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ANY_SUBLAYER}>any sublayer</SelectItem>
							{sublayers.map((sublayer) => (
								<SelectItem key={sublayer} value={sublayer}>
									{sublayer}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={parts.name}
						onValueChange={(name) => setParts({ name })}
					>
						<SelectTrigger
							triggerSize="sm"
							className="flex-[2]"
							aria-label="Participant"
						>
							<SelectValue>
								<span className="truncate font-mono">{parts.name}</span>
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{names.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									<span className="flex min-w-0 flex-col">
										<span className="font-mono">{option.label}</span>
										{option.description ? (
											<span className="text-sm text-muted-foreground">
												{option.description}
											</span>
										) : null}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<MatchPreview
					pattern={value.match}
					matches={candidates}
					loading={isLoading}
				/>
			</div>

			{/* ── allow or deny ─────────────────────────────────────────────── */}
			<div className="flex min-w-0 flex-col gap-1.5">
				<Eyebrow>And then</Eyebrow>
				<RadioGroup
					className="flex gap-4"
					value={value.allow ? "allow" : "deny"}
					onValueChange={(v) => onChange({ ...value, allow: v === "allow" })}
				>
					<span className="flex items-center gap-1.5">
						<RadioGroupItem value="allow" id="rule-allow" />
						<Label htmlFor="rule-allow">allow</Label>
					</span>
					<span className="flex items-center gap-1.5">
						<RadioGroupItem value="deny" id="rule-deny" />
						<Label htmlFor="rule-deny">deny</Label>
					</span>
				</RadioGroup>
				{value.allow ? null : (
					// The one thing about this grammar that surprises people, said where
					// they are about to rely on it (GV5).
					<p className="text-sm text-muted-foreground">
						Deny wins at any specificity — nothing narrower can punch through
						it.
					</p>
				)}
			</div>

			{/* ── graph data alone carries a projection and a slice (GR8) ───── */}
			{isGraphData ? (
				<>
					<PropertyExcluder
						participant={hit}
						excluded={value.properties?.exclude ?? []}
						onChange={(exclude) =>
							onChange({
								...value,
								properties: exclude.length ? { exclude } : undefined,
							})
						}
					/>
					<SliceControls
						participant={hit}
						rule={value}
						onChange={(select) => onChange({ ...value, select })}
					/>
				</>
			) : (
				<Eyebrow>
					A slice and a property exclusion are {layerLabel("graph_data")} only —
					this layer is permitted or denied, and what may leave it is below
				</Eyebrow>
			)}

			{/* ── egress, per destination (GV12) ────────────────────────────── */}
			{value.allow ? (
				<EgressPicker
					may_send={value.egress?.may_send ?? []}
					onChange={(may_send) =>
						onChange({
							...value,
							egress: may_send.length ? { may_send } : undefined,
						})
					}
				/>
			) : null}

			<div className="flex justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
				<Button size="sm" onClick={onCommit}>
					{commitLabel}
				</Button>
			</div>
		</div>
	);
}

/**
 * *Decide without seeing price* — structural, not an instruction (C4).
 *
 * **Exclusion is the only form.** An allow-list would silently drop a property
 * somebody adds to the model tomorrow, which is a bound that stops applying
 * without anybody editing it.
 */
function PropertyExcluder({
	participant,
	excluded,
	onChange,
}: {
	participant?: Participant;
	excluded: string[];
	onChange: (exclude: string[]) => void;
}) {
	if (!participant?.properties.length) return null;

	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Eyebrow>Properties this world does not have</Eyebrow>
			<div className="flex flex-wrap gap-x-3 gap-y-1.5">
				{participant.properties.map((property) => (
					<span key={property} className="flex items-center gap-1.5">
						<Checkbox
							id={`exclude-${property}`}
							checked={excluded.includes(property)}
							onCheckedChange={(checked) =>
								onChange(
									checked
										? [...excluded, property]
										: excluded.filter((p) => p !== property),
								)
							}
						/>
						<Label htmlFor={`exclude-${property}`} className="font-mono">
							{property}
						</Label>
					</span>
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				Excluded here, the connector rewrites a whole-node return into what is
				left — never a filter applied after the rows came back.
			</p>
		</div>
	);
}

/**
 * A slice, along the axes the matched model **declared** (C3 · GV14).
 *
 * The axes come from the participant, so an axis the model never declared is
 * not offered — that refusal exists for a rule that arrived another way (the
 * CLI, a duplicate, a model that was republished without it), and `SliceSummary`
 * is what names it.
 */
function SliceControls({
	participant,
	rule,
	onChange,
}: {
	participant?: Participant;
	rule: GovernRule;
	onChange: (select: GovernRule["select"] | undefined) => void;
}) {
	const axes = participant?.axes;
	const select = rule.select;

	if (!participant) return null;
	if (!axes?.time && !axes?.geo && !axes?.dims?.length) {
		return (
			// Why it cannot be sliced, in place of the controls — the catalogue
			// carries the sentence so the form and the CLI say the same thing.
			<Eyebrow>
				{participant.note ||
					"This participant declares no axes, so it cannot be sliced."}
			</Eyebrow>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Eyebrow>Slice it</Eyebrow>
			{axes.time ? (
				<div className="flex min-w-0 items-center gap-2">
					<Label className="w-10 shrink-0">time</Label>
					<Input
						inputSize="sm"
						type="date"
						aria-label="Slice from"
						value={select?.time?.from ?? ""}
						onChange={(e) =>
							onChange({
								...select,
								time: {
									// The axis is the model's own declared property, never
									// picked — a slice names which clock it is on (SliceSummary).
									axis: axes.time?.property ?? "",
									...select?.time,
									from: e.target.value || undefined,
								},
							})
						}
					/>
					<Input
						inputSize="sm"
						type="date"
						aria-label="Slice to"
						value={select?.time?.to ?? ""}
						onChange={(e) =>
							onChange({
								...select,
								time: {
									axis: axes.time?.property ?? "",
									...select?.time,
									to: e.target.value || undefined,
								},
							})
						}
					/>
				</div>
			) : null}

			{axes.geo ? (
				<div className="flex min-w-0 items-center gap-2">
					<Label className="w-10 shrink-0">geo</Label>
					<Input
						inputSize="sm"
						aria-label="Regions, comma separated"
						placeholder={axes.geo.vocab ? `${axes.geo.vocab} codes` : "regions"}
						value={(select?.geo?.in ?? []).join(", ")}
						onChange={(e) =>
							onChange({
								...select,
								geo: {
									axis: axes.geo?.property ?? "",
									vocab: axes.geo?.vocab,
									in: e.target.value
										.split(",")
										.map((s) => s.trim())
										.filter(Boolean),
								},
							})
						}
					/>
				</div>
			) : null}

			{axes.dims?.map((dim) => (
				<div key={dim} className="flex min-w-0 items-center gap-2">
					<Label className="w-10 shrink-0 truncate">{dim}</Label>
					<Input
						inputSize="sm"
						aria-label={`${dim}, comma separated`}
						value={(select?.dims?.[dim] ?? []).join(", ")}
						onChange={(e) =>
							onChange({
								...select,
								dims: {
									...select?.dims,
									[dim]: e.target.value
										.split(",")
										.map((s) => s.trim())
										.filter(Boolean),
								},
							})
						}
					/>
				</div>
			))}

			{/* What the picks add up to, in the sentence the drawer and the CLI both
			    print — and marked when the model cannot support it. */}
			<SliceSummary
				select={select}
				declaredAxes={axes}
				modelLabel={participant.label}
				variant="block"
			/>
		</div>
	);
}

/**
 * What may accompany a call to **this** destination (GV12).
 *
 * Declared per rule rather than per run: a run-wide setting would have to be
 * the strictest of its destinations, which is the least useful one. Nothing
 * ticked is the default, and it means nothing may go.
 */
function EgressPicker({
	may_send,
	onChange,
}: {
	may_send: EgressClass[];
	onChange: (classes: EgressClass[]) => void;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Eyebrow>What may go with a call to it</Eyebrow>
			<div className="flex flex-wrap gap-x-3 gap-y-1.5">
				{EGRESS_CLASSES.map(({ value, label }) => (
					<span key={value} className="flex items-center gap-1.5">
						<Checkbox
							id={`egress-${value}`}
							checked={may_send.includes(value)}
							onCheckedChange={(checked) =>
								onChange(
									checked
										? [...may_send, value]
										: may_send.filter((c) => c !== value),
								)
							}
						/>
						<Label htmlFor={`egress-${value}`}>{label}</Label>
					</span>
				))}
			</div>
			{may_send.length ? null : (
				<p className="text-sm text-muted-foreground">
					Nothing ticked is the default, and it means nothing of the Graph's
					data may accompany the call.
				</p>
			)}
		</div>
	);
}

/** A new rule opens as *allow this whole layer* — the widest thing it can say. */
export function blankRule(layer: GovernLayer = "graph_data"): GovernRule {
	return { match: `${layer}/${REST}`, allow: true };
}

/** A rule builder's editing state, held by whichever screen opened it. */
export function useRuleDraft(initial?: GovernRule) {
	const [draft, setDraft] = useState<GovernRule>(initial ?? blankRule());
	return {
		draft,
		setDraft,
		reset: (r?: GovernRule) => setDraft(r ?? blankRule()),
	};
}
