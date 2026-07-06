// Capture a downscaled PNG screenshot of the live Explorer canvas for a session's
// banner (RFC-045). Reaches the PixiJS renderer under @invana/canvas
// (`renderer.extract.base64`), then downscales to a thumbnail on an offscreen
// <canvas> so we persist a small image, not a full-resolution frame.

import type { GraphCanvas } from "@invana/graph";

/** Longest-edge size (px) of the stored banner thumbnail. */
const MAX_EDGE = 600;

/**
 * Extract the rendered graph as a PNG data URL, downscaled to ~{@link MAX_EDGE}px.
 * Returns null when the renderer isn't ready or the canvas is empty/too small.
 */
export async function captureBanner(
	canvas: GraphCanvas | null,
): Promise<string | null> {
	const renderer = canvas?.application?.renderer;
	if (!renderer || !canvas) return null;
	try {
		// Full-resolution frame of the whole stage as a PNG data URL.
		const full = await renderer.extract.base64({
			target: canvas.stage,
			format: "png",
		});
		return await downscale(full, MAX_EDGE);
	} catch {
		return null;
	}
}

/** Draw a data-URL image onto an offscreen canvas scaled to fit `maxEdge`. */
function downscale(dataUrl: string, maxEdge: number): Promise<string | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const { width, height } = img;
			if (!width || !height) return resolve(null);
			const scale = Math.min(1, maxEdge / Math.max(width, height));
			const w = Math.max(1, Math.round(width * scale));
			const h = Math.max(1, Math.round(height * scale));
			const off = document.createElement("canvas");
			off.width = w;
			off.height = h;
			const ctx = off.getContext("2d");
			if (!ctx) return resolve(null);
			ctx.drawImage(img, 0, 0, w, h);
			resolve(off.toDataURL("image/png"));
		};
		img.onerror = () => resolve(null);
		img.src = dataUrl;
	});
}
