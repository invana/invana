/**
 * Everything a project page reads about its records, in one place: the
 * branches, each branch's detail, the project's findings (each once, however
 * many branches link it), its decisions, and the dataset versions its
 * findings cite.
 *
 * The datasets a project uses are the dataset versions its findings cite —
 * there is no second list to keep in step.
 */

import { useMemo } from "react";
import type { Cite, Finding } from "../types";
import {
	type ProjectRef,
	useBranchDetails,
	useBranchesQuery,
	useProjectDecisionsQuery,
} from "./queries";

/** `publisher/name@v` → its parts; null for a ref that is not a dataset address. */
export function parseDatasetRef(ref: string) {
	const m = ref.match(/^([^/@]+)\/([^/@]+)(?:@v?(\d+))?$/);
	return m
		? { publisher: m[1], name: m[2], version: m[3] ? Number(m[3]) : null }
		: null;
}

export interface CitedDataset {
	/** `publisher/name`. */
	address: string;
	versions: Set<number>;
	/** The findings citing it. */
	findings: number[];
}

function citedDatasets(findings: Finding[]): CitedDataset[] {
	const out = new Map<string, CitedDataset>();
	for (const f of findings)
		for (const c of f.cites as Cite[]) {
			if (c.kind !== "dataset") continue;
			const ref = parseDatasetRef(c.ref);
			if (!ref) continue;
			const address = `${ref.publisher}/${ref.name}`;
			const entry = out.get(address) ?? {
				address,
				versions: new Set<number>(),
				findings: [],
			};
			if (ref.version !== null) entry.versions.add(ref.version);
			if (!entry.findings.includes(f.number)) entry.findings.push(f.number);
			out.set(address, entry);
		}
	return [...out.values()];
}

export function useProjectRecords(p: ProjectRef) {
	const branches = useBranchesQuery(p);
	const numbers = useMemo(
		() => (branches.data?.items ?? []).map((b) => b.number),
		[branches.data],
	);
	const { details, isLoading } = useBranchDetails(p, numbers);
	const decisions = useProjectDecisionsQuery(p);

	const findings = useMemo(() => {
		const byNumber = new Map<number, Finding>();
		for (const d of details)
			for (const f of d.findings)
				if (!byNumber.has(f.number) || f.via === "own")
					byNumber.set(f.number, f);
		return [...byNumber.values()].sort((a, b) => a.number - b.number);
	}, [details]);

	return {
		branches: branches.data?.items ?? [],
		branchesLoading: branches.isLoading,
		branchesError: branches.error,
		details,
		detailsLoading: isLoading,
		findings,
		decisions: decisions.data?.items ?? [],
		datasets: useMemo(() => citedDatasets(findings), [findings]),
		proposals: details.flatMap((d) => d.proposals),
	};
}
