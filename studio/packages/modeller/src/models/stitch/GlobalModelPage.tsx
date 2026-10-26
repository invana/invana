/**
 * The global model — `global_model:<graph>` in `Workbook` (modeller.md ›
 * The global model page).
 *
 * Every published model on one full-bleed canvas, stitches dashed, with the
 * union list — or the stitch inspector, while `?stitch=` names one — in the
 * page's own right column.
 */

import type { CanvasBackend } from "@invana-studio/canvases";

export interface GlobalModelPageProps {
	username: string;
	graphSlug: string;
	backend?: CanvasBackend;
}

export function GlobalModelPage(_props: GlobalModelPageProps) {
	return null;
}
