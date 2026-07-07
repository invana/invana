// Capture a downscaled PNG screenshot of the live Explorer canvas for a session's
// banner (RFC-045) / a canvas-state thumbnail (RFC-047). Uses the canvas engine's
// own image export (`GraphCanvas.exportDataURL`, @invana/canvas ≥ 0.0.11) — the
// blessed GPU export path, sized via `maxSize` — instead of a hand-rolled PixiJS
// extract + offscreen downscale.

import type { GraphCanvas } from "@invana/graph";

/** Longest-edge size (px) of the stored sessions-list banner thumbnail. */
const MAX_EDGE = 600;

/**
 * Longest-edge size (px) of a canvas *state* (version-history) thumbnail — much
 * smaller than the sessions-list banner, since timeline rows are tiny. Keeping
 * these small is the main lever on version-history storage (RFC-047).
 */
export const STATE_THUMB_MAX_EDGE = 288;

/**
 * Export the rendered graph as a PNG data URL, framed to the content bounds and
 * clamped to `maxEdge` px on its longest side. Synchronous (the engine's export
 * is a direct GPU readback). Returns null when the renderer isn't ready or the
 * canvas is empty (`exportDataURL` throws on an empty region).
 */
export function captureBanner(
	canvas: GraphCanvas | null,
	maxEdge: number = MAX_EDGE,
): string | null {
	if (!canvas) return null;
	try {
		return canvas.exportDataURL({
			format: "png",
			// Capture exactly what the user currently sees (their pan/zoom), not the
			// whole graph — the preview should mirror the visible viewport.
			area: "viewport",
			// Reproduce the canvas background rather than leaving it transparent.
			background: "canvas",
			// Clamp the longest output edge → this is our downscale.
			maxSize: maxEdge,
		});
	} catch {
		return null;
	}
}
