/**
 * How the Explorer keeps a dense result readable: the rules the canvas draws
 * by and the footer reports, kept in one place so the two never disagree.
 *
 * - **Fade.** Edges draw fainter as their count grows — fully opaque up to
 *   {@link FADE_FROM} relationships, then `√(FADE_FROM / n)`, never below
 *   {@link MIN_EDGE_ALPHA}. Thousands of solid lines into one hub fill its fan
 *   with colour; faint ones leave the nodes readable. Hovered, selected and
 *   highlighted edges stay opaque.
 * - **Thin.** With at least {@link THIN_FROM} relationships and the camera
 *   below {@link THIN_BELOW_ZOOM}, about {@link THIN_KEEP} of them are drawn —
 *   an even sample, so every hub keeps its share. Zooming in draws them all.
 *   The footer says so whenever it is happening.
 */

/** Relationship count up to which edges draw fully opaque. */
export const FADE_FROM = 200;
/** The faintest an edge is drawn. */
export const MIN_EDGE_ALPHA = 0.15;

/** Relationship count from which edges thin when zoomed out. */
export const THIN_FROM = 500;
/** Camera zoom below which edges thin. */
export const THIN_BELOW_ZOOM = 0.5;
/** Fraction of relationships drawn while thinned. */
export const THIN_KEEP = 0.1;

/** Edge opacity for a result with `relationships` edges. */
export function edgeAlpha(relationships: number): number {
	if (relationships <= FADE_FROM) return 1;
	return Math.max(MIN_EDGE_ALPHA, Math.sqrt(FADE_FROM / relationships));
}

/** Whether a result this size thins its edges at all. */
export function thinsEdges(relationships: number): boolean {
	return relationships >= THIN_FROM;
}

/** Whether edges are thinned right now, at this size and zoom. */
export function edgesThinned(relationships: number, zoom: number): boolean {
	return thinsEdges(relationships) && zoom < THIN_BELOW_ZOOM;
}
