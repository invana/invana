/**
 * *This run's lens* — **every participant the world allowed, and what the run
 * did with each one**.
 *
 * *As someone reading a run I am not satisfied with, I want to see what the
 * world let in against what the run actually used, so that narrowing or
 * widening is a reading I make rather than a guess.*
 *
 * **The gap between declared and did is the whole panel.** A participant that
 * was allowed and never touched, run after run, is not carrying the answer —
 * narrow. The same one refused repeatedly is *widen, or accept cannot answer
 * deliberately*. Neither reading exists if the surface shows only what
 * happened, which is why a refusal is struck in place rather than hidden
 * ([see-what-ran.md](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md#decisions)).
 *
 * **Grouped by layer, not by verdict.** The drawing is one `LayerSection` per
 * layer with a `ParticipantRow` inside it — so *the llm layer was fully spent
 * and the graph layer was not* is read off the shape, which a list sorted into
 * three verdict buckets cannot say. Both components are the kit's, and so is
 * the `lens` panel that draws them; this file only maps the ledger onto them.
 *
 * **`allowed` is the lens the run froze**, not the lens as it stands now
 * ([guardrails.md](../../../../../docs/for-developers/modules/govern/features/guardrails.md)):
 * a guardrail tightened since must not rewrite what a past answer was allowed
 * to rest on. That is the server's doing; this file's part is to pass it
 * through unedited.
 *
 * **The layer is the address's first segment**, which is the engine's own
 * grammar for it (`runtime/governing.py` projects a touch's layer the same
 * way) — so a participant that was allowed and never touched, and therefore has
 * no ledger row to read a layer off, still lands in the right band.
 */

import type {
	LensOptions,
	LensSectionSpec,
	ParticipantSpec,
} from "@invana/boards";
import type {
	ParticipantReading,
	Touch,
	TouchesResponse,
} from "@invana-studio/core";
import { LAYER_PALETTE } from "@invana-studio/ui";
import { BANDS } from "./runLayers";

/** `graph_data/model/Routes@v4` → `graph_data`. The engine's own split. */
/** `1,284 rows · 3 calls · step 7` — what came back, in the ledger's numbers. */
function noteOfTouched(
	p: ParticipantReading,
	step: string | undefined,
): string {
	const parts: string[] = [];
	if (p.rows) parts.push(`${p.rows.toLocaleString()} rows`);
	if (p.tokens) parts.push(`${p.tokens.toLocaleString()} tokens`);
	if (p.calls > 1) parts.push(`${p.calls} calls`);
	if (step) parts.push(step);
	// Never empty: *touched* with nothing beside it reads as a record that
	// failed to load rather than as a call that returned nothing measurable.
	return parts.length ? parts.join(" · ") : "engaged, nothing measured";
}

/**
 * One participant, as the engine classified it — refused, touched, a cache
 * miss, or allowed and never asked for. Studio only words it.
 */
function participant(p: ParticipantReading, ledger: Touch[]): ParticipantSpec {
	switch (p.verdict) {
		case "refused":
			return {
				address: p.address,
				verdict: "refused",
				note: p.why ?? "outside this world — widen to answer",
			};
		case "touched":
			return {
				address: p.address,
				verdict: "touched",
				note: noteOfTouched(
					p,
					ledger.find((t) => t.address === p.address && t.step_key)?.step_key ??
						undefined,
				),
			};
		case "miss":
			return {
				address: p.address,
				verdict: "miss",
				note: p.why ?? "nothing was reused",
			};
		default:
			return {
				address: p.address,
				verdict: "never touched",
				note: "allowed, and nothing asked for it",
			};
	}
}

/**
 * The lens panel's options — one section per layer, participants inside it.
 *
 * Every address the frozen world allowed is drawn, plus any the run engaged
 * that the allow-list does not name: a refusal recorded against a participant
 * nobody declared is exactly the row a reader needs, and dropping it because it
 * is not in `allowed` would hide the one thing that went wrong.
 */
export function runLensOptions(
	touches: TouchesResponse | undefined,
	opts: { selectAction?: string } = {},
): LensOptions {
	const ledger = [...(touches?.items ?? [])].sort((a, b) => a.seq - b.seq);
	const tallies = new Map((touches?.layers ?? []).map((l) => [l.layer, l]));

	// Every band, in the order the strip reads them — a layer the world allowed
	// nothing on is dim rather than dropped, because *nothing was permitted
	// here* is a fact about the world and not an absence of one.
	const sections: LensSectionSpec[] = BANDS.filter(
		(layer) => layer !== "agent",
	).map((layer) => {
		const participants = (touches?.participants ?? [])
			.filter((p) => p.layer === layer)
			.map((p) => participant(p, ledger));
		const allowed = tallies.get(layer)?.allowed ?? 0;
		const touched = tallies.get(layer)?.touched ?? 0;
		return {
			layer,
			count: allowed,
			summary: allowed
				? `${allowed} allowed · ${touched} touched`
				: "nothing allowed here",
			dim: allowed === 0,
			participants,
		};
	});

	return {
		sections,
		palette: LAYER_PALETTE,
		selectAction: opts.selectAction,
	};
}

/** The four counts above the sections — the retune's evidence, as tiles. */
export function lensSummary(touches: TouchesResponse | undefined) {
	const allowed = touches?.tallies?.allowed ?? 0;
	const touched = touches?.tallies?.touched ?? 0;
	const never = touches?.tallies?.never_touched ?? 0;
	const refused = touches?.tallies?.refused ?? 0;
	return [
		{
			label: "Allowed",
			value: String(allowed),
			delta: "participants, by the world",
		},
		{
			label: "Touched",
			value: String(touched),
			delta: allowed ? `of the ${allowed}` : "nothing was bounded",
			tone: touched ? ("good" as const) : undefined,
			gauge: allowed ? { value: touched, max: allowed } : undefined,
		},
		{
			label: "Never touched",
			value: String(never),
			delta: never ? "narrow it?" : "everything allowed was spent",
		},
		{
			label: "Refused",
			value: String(refused),
			delta: refused ? "widen it, or accept no answer" : "nothing was blocked",
			tone: refused ? ("warn" as const) : undefined,
		},
	];
}
