/**
 * The header's trail for a project's page — `Projects › the project › H2 ›
 * the finding` (or `› Simulation s1`) (shell.md › Breadcrumbs: Graph › section › item › drill-in).
 *
 * The project page carries no trail of its own; its drill-ins are levels of
 * the shell's breadcrumb, each linking to the page one level up. A level is
 * named for what it is — the project's name, the branch's short name and
 * title, the finding's statement — never its key. Every read is one the page
 * has already made, so the trail costs no request of its own.
 */

import { useLocation } from "react-router-dom";
import { useProjectQuery } from "../queries";
import {
	useBranchQuery,
	useFindingQuery,
	useSimulationQuery,
} from "../records/queries";
import { branchLabel, evidenceWord } from "../records/words";
import { useProjectView } from "./useProjectView";

interface TrailLevel {
	label: string;
	to?: string;
	title?: string;
}

/** The trail while `project:<key>` is the focused page; empty otherwise. */
export function useProjectTrail(
	username: string | undefined,
	graphSlug: string | undefined,
	projectKey: string | null,
): TrailLevel[] {
	const { pathname, search } = useLocation();
	const view = useProjectView();
	const ref = {
		username: username ?? "",
		graphSlug: graphSlug ?? "",
		key: projectKey ?? "",
	};
	const project = useProjectQuery(
		username,
		graphSlug,
		projectKey ?? undefined,
	).data;
	const findingNumber = projectKey ? view.finding : null;
	const simulationNumber = projectKey ? view.simulation : null;
	const simulation = useSimulationQuery(ref, simulationNumber).data;
	const branchNumber = projectKey
		? (view.branch ?? simulation?.branch ?? null)
		: null;
	const branch = useBranchQuery(ref, branchNumber).data?.branch;
	const finding = useFindingQuery(ref, findingNumber).data;

	if (!projectKey || !username || !graphSlug) return [];

	/** This page with the drill-ins from `drop` on cleared. */
	const up = (drop: string[]) => {
		const params = new URLSearchParams(search);
		for (const k of drop) params.delete(k);
		return `${pathname}?${params}`;
	};

	const levels: TrailLevel[] = [
		{ label: "Projects", to: `/u/${username}/${graphSlug}/projects` },
		{
			label: project?.name ?? projectKey,
			to: up(["branch", "finding", "simulation"]),
		},
	];
	if (project && branchNumber !== null) {
		const label = branchLabel(project, branchNumber);
		levels.push({
			label: branch ? `${label} · ${branch.title}` : label,
			to: up(["finding", "simulation"]),
		});
	}
	if (project && simulationNumber !== null && findingNumber === null)
		levels.push({ label: `Simulation s${simulationNumber}` });
	if (project && findingNumber !== null)
		levels.push({
			label: finding?.statement ?? `${evidenceWord(project)} ${findingNumber}`,
		});
	return levels;
}
