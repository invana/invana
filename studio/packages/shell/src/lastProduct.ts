/**
 * The graph product a person last had open, so the Graph's own URL can take
 * them back to it.
 *
 * A per-browser convenience, not state anyone else reads: it lives in
 * `localStorage`, and when storage is blocked or empty the Graph's URL falls
 * back to Explorer. Every read and write is guarded, because a private window
 * may throw on either.
 */
import type { ProductId } from "@invana-studio/core";

const KEY = "invana.studio.lastProduct";

/** Records the graph product that is open now. */
export function rememberProduct(id: ProductId): void {
	try {
		localStorage.setItem(KEY, id);
	} catch {
		// Storage blocked — the Graph's URL opens Explorer instead.
	}
}

/** The graph product last open in this browser, if any was recorded. */
export function lastProduct(): string | null {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}
