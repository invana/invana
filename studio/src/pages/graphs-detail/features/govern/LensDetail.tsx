/**
 * W2 · one lens, read as one object — which is what an auditor is handed — and
 * R4 · the cast it would actually get.
 *
 * *As someone who has to answer for a run, I want to read what a world allowed
 * in one place, so that "what was this run allowed to see" is a document rather
 * than a composition I compute.*
 *
 * Five layer bands, the cast, and the transaction time — the record in its own
 * order ([WO8](../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 * The same shape whether it is a world or a guardrail, because they **are** one
 * record separated by `kind` (GV1); a second layout would be the second
 * enforcement path this module exists not to have.
 *
 * **The body renders from the row the list already holds; the resolved cast
 * arrives after.** *Innermost wins, then the address is checked against the
 * effective rules* (GV6) is a composition against the guardrails, and only the
 * server can do it — so it is a second read, and the drill-in does not wait on
 * it. A `CastTable` with `resolved` absent still reads correctly: it says what
 * this lens **casts**, rather than what a run would **get**.
 */

import { useLensQuery } from "@/hooks/queries/useGovern";
import {
	GOVERNED_LAYERS,
	layerSummary,
	rulesInLayer,
} from "@/pages/graphs-detail/features/govern/narrowing";
import type { GovernRule, Lens } from "@/types/govern";
import {
	CannotAnswerCard,
	type CastResolution,
	type CastRole,
	CastTable,
	Eyebrow,
	LayerSection,
	RuleRow,
} from "@invana/ui";

import { LAYER_PALETTE } from "@/ui/layerPalette";

function ruleKey(rule: GovernRule, i: number): string {
	return `${rule.match}-${rule.allow ? "a" : "d"}-${i}`;
}

export interface LensDetailProps {
	lens: Lens;
	username?: string;
	graphSlug?: string;
	/** Actions, the ladder and the editor — whatever the drawer hangs below it. */
	children?: React.ReactNode;
}

export function LensDetail({
	lens,
	username,
	graphSlug,
	children,
}: LensDetailProps) {
	const hasCast = Object.keys(lens.cast ?? {}).length > 0;
	// The second read is for the resolution alone — the rules above are already
	// on screen and never flicker while it lands.
	const detail = useLensQuery(username, graphSlug, lens.id);
	const rows = detail.data?.cast_resolved ?? undefined;
	// `source` is dropped on the way into the table. The kit's vocabulary is
	// `todo · plan · agent · shipped` — *which contributor won* — and a lens read
	// on its own has exactly one contributor, so answering it here would be
	// inventing a fact. The run dashboard is where that column has a real value.
	const resolved: CastResolution[] | undefined = rows?.map((row) => ({
		role: row.role,
		address: row.address,
		allowed: row.allowed,
		ruleMatched: row.rule_matched,
		source: row.source === "shipped" ? "shipped" : undefined,
	}));
	const denied = (rows ?? []).filter((r) => r.address && !r.allowed);

	return (
		<div className="flex min-w-0 flex-col gap-4">
			{/* **Titled `Rules`, not with the lens's name.** This body only ever
			    renders drilled into a drawer, whose header already reads
			    `‹ WORLDS / EU · H1 2026` — repeating the name directly under it
			    spends the first line of a 420px column saying what the line above
			    it said. */}
			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow
					aside={
						lens.as_of
							? `as of ${lens.as_of}`
							: // Null is *now*, and saying so is the point: a reader must not
								// wonder whether a blank means "no time set" or "not loaded".
								"as of now"
					}
				>
					Rules
				</Eyebrow>
				<div className="flex min-w-0 flex-col gap-4 pt-1">
					{GOVERNED_LAYERS.map((layer) => {
						const rules = rulesInLayer(lens, layer);
						return (
							<LayerSection
								key={layer}
								layer={layer}
								summary={layerSummary(lens, layer)}
								palette={LAYER_PALETTE}
							>
								{rules.map((rule, i) => (
									<RuleRow
										key={ruleKey(rule, i)}
										match={rule.match}
										allow={rule.allow}
										properties={rule.properties}
										select={rule.select}
										egress={
											rule.egress?.may_send
												? { may_send: rule.egress.may_send }
												: undefined
										}
										readOnly
									/>
								))}
							</LayerSection>
						);
					})}
				</div>
			</section>

			<section className="flex min-w-0 flex-col gap-1">
				<Eyebrow
					aside={
						hasCast
							? resolved
								? "resolved, then checked"
								: undefined
							: "nothing cast — every role falls through"
					}
				>
					Cast
				</Eyebrow>
				<div className="flex min-w-0 flex-col gap-2 pt-1">
					<CastTable
						bordered={false}
						cast={lens.cast as Partial<Record<CastRole, string>>}
						resolved={resolved}
						readOnly
					/>
					{/* R4's seam: the cast resolves to a model the bound above it
					    denies, so the run does not open. It is named here rather than
					    at run time, because the person reading the world is the person
					    who can fix it. */}
					{denied.map((row) => (
						<CannotAnswerCard
							key={row.role}
							label="this run cannot open"
							remedy={
								row.rule_matched ? (
									<span className="font-mono">{row.rule_matched}</span>
								) : undefined
							}
						>
							{row.refusal}
						</CannotAnswerCard>
					))}
				</div>
			</section>

			{lens.kind === "guardrail" ? (
				<Eyebrow>
					In force on every run — a guardrail is not a world you pick
				</Eyebrow>
			) : null}

			{children}
		</div>
	);
}
