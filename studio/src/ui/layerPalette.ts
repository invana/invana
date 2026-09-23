/**
 * What each layer is painted with, across every surface that draws one.
 *
 * **The kit ships no hues.** `LayerChip`, `LayerSection` and `LayerStrip` take
 * a `palette` prop and fall back to the neutral, because which colour means
 * `llm` is a product's decision and not a component's — so this file is where
 * Invana decides, once. It is passed *as a prop* at every call site rather than
 * installed on a provider: a chip painted from somewhere up the tree is a chip
 * whose colour you cannot find by reading its call site.
 *
 * The slots are the ones the kit used to hard-code, kept so nothing re-coloured
 * when the decision moved out here:
 *
 * | Layer | Slot | Why |
 * |---|---|---|
 * | `graph_data` | `data-1` | blue — the first series slot |
 * | `llm` | `data-7` | violet — the same slot `BoundChip` gives the `llm` **bound**; same concept, same hue |
 * | `third_party` | `data-8` | red — a crossing out of the Graph |
 * | `cache` | `data-3` | aqua |
 * | `human` | `data-6` | green |
 * | `agent` | `muted-foreground` | the **spine**: never governed, so never a hue that reads as a participant |
 *
 * Four of them are the data-palette slots `BoundChip` leaves free, so a layer
 * and a bound can sit in one row without sharing a hue between two vocabularies.
 *
 * The three keys are three different jobs: `swatch` is the solid mark (a dot, a
 * bar's rail), `tint` is the wash a bar sits in — faint, because it goes
 * *behind* text — and `text` is the hue as type, for an address that should
 * read as its layer. Tailwind sees each class named literally here, which is
 * what makes it emit them; nothing about this palette lives in a precompiled
 * stylesheet any more.
 */

import type { LayerPalette } from "@invana/ui";

export const LAYER_PALETTE: LayerPalette = {
	graph_data: {
		swatch: "bg-data-1",
		tint: "border-data-1/35 bg-data-1/10",
		text: "text-data-1",
	},
	llm: {
		swatch: "bg-data-7",
		tint: "border-data-7/35 bg-data-7/10",
		text: "text-data-7",
	},
	third_party: {
		swatch: "bg-data-8",
		tint: "border-data-8/35 bg-data-8/10",
		text: "text-data-8",
	},
	cache: {
		swatch: "bg-data-3",
		tint: "border-data-3/35 bg-data-3/10",
		text: "text-data-3",
	},
	human: {
		swatch: "bg-data-6",
		tint: "border-data-6/35 bg-data-6/10",
		text: "text-data-6",
	},
	// The spine is drawn and never governed, so it wears the neutral rather than
	// a sixth hue — a colour here would say *this is a participant like the
	// others*, which is the one thing it is not.
	agent: {
		swatch: "bg-muted-foreground",
		tint: "border-border",
		text: "text-foreground",
	},
};

/**
 * The reader's spelling of a layer, as the API sends it, back to the address
 * segment the kit's components take.
 *
 * The engine sends `graph data` because that is what a person reads; `Layer` is
 * `graph_data` because that is what a rule matches on. One substitution, not a
 * second hand-written table that can drift from the first.
 */
export const layerSlug = (label: string): string => label.replace(/ /g, "_");
