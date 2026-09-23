/**
 * What every declared board agrees on, whichever module owns it.
 *
 * Four surfaces compose a `DashboardSpec` now — a run and a task run
 * ([Operate](../features/operate/dashboards)), and a skill, its usage and a
 * rule ([Skills](../features/skills/dashboards)) — and these five helpers were
 * the part of the vocabulary that has nothing to do with runs. Two modules
 * needing the same domain-free helper is the signal that it belongs in
 * `shared/` ([code-shape §4.1](../../../../../docs/for-developers/building-studio/code-shape.md)),
 * and a second copy of `omit` is how the two would drift on what *absent* means.
 *
 * Anything that knows what a run, a skill or a citation **is** stays in the
 * module that owns that record.
 */

import type { PanelSpec } from "@invana/dashboard";

/**
 * Drop the entries that have nothing behind them.
 *
 * A composer builds every optional tile, panel and row as `x ?? null` and
 * passes the list through here, so **a band with no record is absent, not
 * zero** ([SR34](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md))
 * is one filter rather than a condition spelled out at each of fifty call
 * sites.
 */
export function omit<T>(items: Array<T | null | undefined | false>): T[] {
	return items.filter((item): item is T => Boolean(item));
}

/** `1,204` — counts are read, not computed, so they carry their separators. */
export function count(n: number): string {
	return n.toLocaleString();
}

/** The `Dashboard ¦ spec.json` switch every declared board carries ([SR37](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)). */
export const VIEW_ACTION = "view";
export const VIEW_DASHBOARD = "Dashboard";
export const VIEW_SPEC = "spec.json";

/**
 * The one panel `spec.json` renders — the very document being looked at.
 *
 * It is what makes *a dashboard is data* checkable rather than merely claimed:
 * the page can show you the JSON it is, and a panel that could not be
 * serialised would show up here as the hole it is.
 */
export function specPanel(spec: unknown): PanelSpec {
	return {
		kind: "code",
		title: "spec.json",
		aside: "the document this page renders",
		flush: true,
		options: {
			language: "json",
			showLineNumbers: true,
			value: JSON.stringify(spec, null, 2),
		},
	};
}
