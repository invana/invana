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
 * ([SR53](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md#decisions)).
 *
 * **Grouped by layer, not by verdict.** The drawing is one `LayerSection` per
 * layer with a `ParticipantRow` inside it — so *the llm layer was fully spent
 * and the graph layer was not* is read off the shape, which a list sorted into
 * three verdict buckets cannot say. Both components are the kit's, and so is
 * the `lens` panel that draws them; this file only maps the ledger onto them.
 *
 * **`allowed` is the lens the run froze**, not the lens as it stands now
 * ([GR3](../../../../../docs/for-developers/modules/govern/features/guardrails.md)):
 * a guardrail tightened since must not rewrite what a past answer was allowed
 * to rest on. That is the server's doing; this file's part is to pass it
 * through unedited.
 *
 * **The layer is the address's first segment**, which is the engine's own
 * grammar for it (`runtime/governing.py` projects a touch's layer the same
 * way) — so a participant that was allowed and never touched, and therefore has
 * no ledger row to read a layer off, still lands in the right band.
 */

import { BANDS } from "@/pages/graphs-detail/features/govern/runLayers";
import type { Touch, TouchesResponse } from "@/types/govern";
import { LAYER_PALETTE } from "@/ui/layerPalette";
import type {
	LensOptions,
	LensSectionSpec,
	ParticipantSpec,
} from "@invana/dashboard";
import type { Layer } from "@invana/ui";

/** `graph_data/model/Routes@v4` → `graph_data`. The engine's own split (GV20). */
function layerOf(address: string): Layer {
	return address.split("/", 1)[0] as Layer;
}

/** `1,284 rows · 3 calls · step 7` — what came back, in the ledger's numbers. */
function noteOfTouched(rows: Touch[]): string {
	const parts: string[] = [];
	const records = rows.reduce((n, t) => n + (t.volume.rows ?? 0), 0);
	if (records) parts.push(`${records.toLocaleString()} rows`);
	const tokens = rows.reduce(
		(n, t) => n + (t.volume.tokens_in ?? 0) + (t.volume.tokens_out ?? 0),
		0,
	);
	if (tokens) parts.push(`${tokens.toLocaleString()} tokens`);
	if (rows.length > 1) parts.push(`${rows.length} calls`);
	const step = rows.find((t) => t.step_key)?.step_key;
	if (step) parts.push(step);
	// Never empty: *touched* with nothing beside it reads as a record that
	// failed to load rather than as a call that returned nothing measurable.
	return parts.length ? parts.join(" · ") : "engaged, nothing measured";
}

/**
 * One participant's verdict and note, from its rows of the ledger.
 *
 * `miss` is the cache's own word for a lookup that found nothing — a distinct
 * fact from *never touched*, which is a participant nothing asked for at all.
 */
function participant(address: string, rows: Touch[]): ParticipantSpec {
	const refused = rows.find((t) => t.direction === "refused");
	if (refused) {
		return {
			address,
			verdict: "refused",
			note:
				refused.why ??
				(refused.rule_matched
					? `denied by ${refused.rule_matched}`
					: "outside this world — widen to answer"),
		};
	}
	const engaged = rows.filter((t) => t.direction !== "skipped");
	if (engaged.length) {
		return { address, verdict: "touched", note: noteOfTouched(engaged) };
	}
	if (rows.length) {
		return {
			address,
			verdict: "miss",
			note: rows[0].why ?? "nothing was reused",
		};
	}
	return {
		address,
		verdict: "never touched",
		note: "allowed, and nothing asked for it",
	};
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

	const rowsByAddress = new Map<string, Touch[]>();
	for (const touch of ledger) {
		const rows = rowsByAddress.get(touch.address) ?? [];
		rows.push(touch);
		rowsByAddress.set(touch.address, rows);
	}

	const addresses = [
		...new Set([...(touches?.allowed ?? []), ...rowsByAddress.keys()]),
	].sort();

	const byLayer = new Map<Layer, ParticipantSpec[]>();
	for (const address of addresses) {
		const layer = layerOf(address);
		const list = byLayer.get(layer) ?? [];
		list.push(participant(address, rowsByAddress.get(address) ?? []));
		byLayer.set(layer, list);
	}

	// Every band, in the order the strip reads them — a layer the world allowed
	// nothing on is dim rather than dropped, because *nothing was permitted
	// here* is a fact about the world and not an absence of one (D22).
	const sections: LensSectionSpec[] = BANDS.filter(
		(layer) => layer !== "agent",
	).map((layer) => {
		const participants = byLayer.get(layer) ?? [];
		const touched = participants.filter((p) => p.verdict === "touched").length;
		return {
			layer,
			count: participants.length,
			summary: participants.length
				? `${participants.length} allowed · ${touched} touched`
				: "nothing allowed here",
			dim: participants.length === 0,
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
	const allowed = touches?.allowed?.length ?? 0;
	const touched = touches?.touched?.length ?? 0;
	const never = touches?.never_touched?.length ?? 0;
	const refused = touches?.refused?.length ?? 0;
	return [
		{
			label: "Allowed",
			value: String(allowed),
			caption: "participants, by the world",
		},
		{
			label: "Touched",
			value: String(touched),
			caption: allowed ? `of the ${allowed}` : "nothing was bounded",
			tone: touched ? ("success" as const) : undefined,
			meter: allowed ? touched / allowed : undefined,
		},
		{
			label: "Never touched",
			value: String(never),
			caption: never ? "narrow it?" : "everything allowed was spent",
		},
		{
			label: "Refused",
			value: String(refused),
			caption: refused
				? "widen it, or accept no answer"
				: "nothing was blocked",
			tone: refused ? ("warning" as const) : undefined,
		},
	];
}
