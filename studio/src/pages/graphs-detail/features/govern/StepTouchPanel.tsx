/**
 * R2 · one step, participant by participant — **what was asked for, what was
 * executed, and what egress cut**.
 *
 * *As someone checking an answer, I want to see the query the model generated
 * beside the query that actually ran, so that "the lens was composed into it"
 * is something I can read rather than something I am told.*
 *
 * **The two query digests are the proof, not decoration.** The lens is enforced
 * by the connector *composing the predicate* and *rewriting a whole-node return
 * into the permitted projection* — never by filtering rows after they came
 * back. Generated and executed differing is what that composition looks like
 * from outside; generated and executed being identical on a sliced rule is a
 * bug, and this panel is where it shows.
 *
 * **`cut` is what makes an egress line an event rather than a rule.** A rule at
 * rest says what *may* go; a touch says what was withheld on a real crossing,
 * and `EgressList` reads the two differently because they are different claims.
 */

import type { Touch, TouchesResponse } from "@/types/govern";
import type { PanelRendererProps } from "@invana/dashboard";
import {
	AddressChip,
	type AddressTone,
	CannotAnswerCard,
	EgressList,
	PropertyList,
	PropertyRow,
	SliceSummary,
	layerItemLabel,
} from "@invana/ui";

const TONE: Record<Touch["direction"], AddressTone> = {
	out: "allowed",
	in: "allowed",
	refused: "refused",
	skipped: "untouched",
};

export interface StepTouchOptions {
	stepKey: string | null;
	touches: Touch[];
}

export type WithStepTouch = { stepTouch: StepTouchOptions };

export function StepTouchPanel({
	options,
}: PanelRendererProps<StepTouchOptions>) {
	const { touches } = options;

	if (!touches.length) {
		return (
			<p className="text-sm text-muted-foreground">
				This step engaged nothing outside the runtime — no model, no query, no
				call. That is an ordinary step, not a missing record.
			</p>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-3">
			{touches.map((touch) => (
				<div
					key={`${touch.seq}-${touch.address}`}
					className="flex min-w-0 flex-col gap-1.5"
				>
					<div className="flex min-w-0 items-baseline gap-2">
						<AddressChip address={touch.address} tone={TONE[touch.direction]} />
						<span className="ml-auto shrink-0 text-sm text-muted-foreground">
							{layerItemLabel(touch.direction)} · seq {touch.seq}
						</span>
					</div>

					{/* A refusal names its rule and what it cost — which is nothing,
					    because a third party is refused **before dispatch**. */}
					{touch.direction === "refused" ? (
						<CannotAnswerCard
							label="refused"
							remedy={
								touch.rule_matched ? (
									<span className="font-mono">{touch.rule_matched}</span>
								) : undefined
							}
						>
							{touch.why ??
								"This run was not allowed to engage it. Nothing was spent and nothing left."}
						</CannotAnswerCard>
					) : null}

					<PropertyList labelWidth={110}>
						{/* WO19 — `rows` is the only count. What the query would have
						    returned unsliced is knowable only by running it unsliced,
						    and that is a second execution on every governed read. What
						    narrowed this read is below, which is the actionable half. */}
						{touch.volume.rows != null ? (
							<PropertyRow label="rows">
								{String(touch.volume.rows)}
							</PropertyRow>
						) : null}
						{touch.volume.tokens_in != null ||
						touch.volume.tokens_out != null ? (
							<PropertyRow label="tokens">
								{`${(touch.volume.tokens_in ?? 0) + (touch.volume.tokens_out ?? 0)} · ${touch.volume.tokens_in ?? 0} in, ${touch.volume.tokens_out ?? 0} out`}
							</PropertyRow>
						) : null}
						{touch.duration_ms != null ? (
							<PropertyRow label="took">{`${touch.duration_ms} ms`}</PropertyRow>
						) : null}
						{/* `null` is *unknown*, not free — a model with no published
						    rate leaves the row off rather than printing `$0.00`. */}
						{touch.cost_usd != null ? (
							<PropertyRow label="cost">{`$${touch.cost_usd.toFixed(4)}`}</PropertyRow>
						) : null}
						{touch.query.generated_sha256 ? (
							<PropertyRow label="generated" mono>
								{touch.query.generated_sha256.slice(0, 12)}
							</PropertyRow>
						) : null}
						{touch.query.executed_sha256 ? (
							<PropertyRow label="executed" mono>
								{touch.query.executed_sha256.slice(0, 12)}
							</PropertyRow>
						) : null}
					</PropertyList>

					{/* The two digests differing **is** the composition. Saying so in
					    words means a reader does not have to know what a sha is. */}
					{touch.query.generated_sha256 &&
					touch.query.executed_sha256 &&
					touch.query.generated_sha256 !== touch.query.executed_sha256 ? (
						// A sentence, not an eyebrow: `Eyebrow` uppercases, and this is
						// the one line that explains what the two digests mean.
						<p className="text-sm text-muted-foreground">
							The executed query is not the generated one — the lens was
							composed into it before it ran.
						</p>
					) : null}

					{/* WO17 — the slice is keyed by type, because a world narrows per
					    type. One `SliceSummary` per type, each naming the type it
					    sliced: one summary over a merged select would say a narrowing
					    happened without saying what it narrowed. */}
					{Object.entries(touch.applied.select ?? {}).map(([type, select]) => (
						<SliceSummary
							key={type}
							select={select as never}
							modelLabel={type === "*" ? undefined : type}
							variant="line"
						/>
					))}

					{/* Keyed the same way, and for the same reason. */}
					{Object.entries(touch.applied.properties_excluded ?? {}).length ? (
						<PropertyList labelWidth={110}>
							{Object.entries(touch.applied.properties_excluded ?? {}).map(
								([type, properties]) => (
									<PropertyRow
										key={type}
										label={type === "*" ? "excluded" : type}
									>
										{`${properties.join(" · ")} — not in the projection`}
									</PropertyRow>
								),
							)}
						</PropertyList>
					) : null}

					{touch.sent.classes?.length || touch.sent.cut?.length ? (
						<EgressList
							to={touch.address}
							classes={touch.sent.classes}
							cut={touch.sent.cut}
						/>
					) : null}
				</div>
			))}
		</div>
	);
}

/**
 * Every touch one step made, in `seq` order.
 *
 * Keyed on `step_key` — the plan's own name for the step — rather than on a
 * `task_runs.id`, because a step that retried is several rows of one step and
 * what it engaged belongs to the step, not to the attempt.
 */
export function touchesOfStepKey(
	touches: TouchesResponse | undefined,
	stepKey: string | null,
): Touch[] {
	if (!stepKey) return [];
	return (touches?.items ?? [])
		.filter((t) => (t.step_key ?? `seq-${t.seq}`) === stepKey)
		.sort((a, b) => a.seq - b.seq);
}
