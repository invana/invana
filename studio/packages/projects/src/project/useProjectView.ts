/**
 * Where the project page is — its tab, and the branch or finding drilled into.
 *
 * | Param | Means |
 * |---|---|
 * | `view` | `overview` (absent) · `branches` · `decisions` · `lineage` · `report` |
 * | `branch` | a branch number — the branch's own page |
 * | `finding` | a finding number — the finding's own page, over the branch |
 * | `decision` | the decision the Lineage tab traces |
 *
 * They ride in the query string beside `?page=project:<key>`, so a tab and a
 * drill-in survive a reload and a shared link opens on them. A drill-in is
 * read before the tab: a finding over a branch over whichever tab was open,
 * so *Back* from a branch lands on the tab it was opened from.
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type ProjectTab =
	| "overview"
	| "branches"
	| "decisions"
	| "lineage"
	| "report";

const TABS: readonly ProjectTab[] = [
	"overview",
	"branches",
	"decisions",
	"lineage",
	"report",
];

const num = (raw: string | null) => {
	const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
	return Number.isFinite(n) && n > 0 ? n : null;
};

export function useProjectView() {
	const [params, setParams] = useSearchParams();
	const raw = params.get("view");
	const tab: ProjectTab = TABS.includes(raw as ProjectTab)
		? (raw as ProjectTab)
		: "overview";
	const branch = num(params.get("branch"));
	const finding = num(params.get("finding"));
	const decision = num(params.get("decision"));

	const write = useCallback(
		(patch: Record<string, string | null>) =>
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					for (const [k, v] of Object.entries(patch)) {
						if (v === null) next.delete(k);
						else next.set(k, v);
					}
					return next;
				},
				{ replace: false },
			),
		[setParams],
	);

	return useMemo(
		() => ({
			tab,
			branch,
			finding,
			decision,
			setTab: (t: ProjectTab) =>
				write({
					view: t === "overview" ? null : t,
					branch: null,
					finding: null,
				}),
			openBranch: (n: number | null) =>
				write({ branch: n ? String(n) : null, finding: null }),
			openFinding: (n: number | null) =>
				write({ finding: n ? String(n) : null }),
			/** A finding over its branch, in one write. */
			openFindingOn: (branchNumber: number, n: number) =>
				write({ branch: String(branchNumber), finding: String(n) }),
			traceDecision: (n: number) =>
				write({
					view: "lineage",
					decision: String(n),
					branch: null,
					finding: null,
				}),
		}),
		[tab, branch, finding, decision, write],
	);
}
