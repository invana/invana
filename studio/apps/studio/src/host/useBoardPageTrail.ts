import { parseBoardPageId, runAddress } from "@invana-studio/shell";
import { useQuery } from "@tanstack/react-query";
import { boardReportQuery } from "@/host/boards";

interface TrailLevel {
	label: string;
	to?: string;
	title?: string;
}

/**
 * The header's levels for a focused page that opens on a Graph's root path,
 * `?page=` alone — so no route names where it is.
 *
 * | Page | Trail |
 * |---|---|
 * | A run's frozen report, `run:<id>@<v>` — a shared snapshot | `Sessions › <question>` |
 * | Two runs compared, `compare:<a>:<b>` | `Activity › Runs › run:<a> · run:<b>` |
 *
 * The question is the report's own title, read through the same query the
 * page runs, so naming it adds no request. Any other page has no trail here.
 */
export function useBoardPageTrail(
	username: string | undefined,
	graphSlug: string | undefined,
	pageId: string | null | undefined,
): TrailLevel[] {
	const page = pageId ? parseBoardPageId(pageId) : null;
	const snapshot =
		page?.kind === "run" && page.versionId && username && graphSlug
			? page
			: null;
	const report = useQuery({
		...boardReportQuery(
			username ?? "",
			graphSlug ?? "",
			"run",
			snapshot?.id ?? "",
			snapshot?.versionId ?? "",
		),
		enabled: snapshot !== null,
	});
	if (!page || !username || !graphSlug) return [];
	const graphPath = `/u/${username}/${graphSlug}`;

	if (snapshot) {
		const title = (report.data?.snapshot as { title?: unknown } | undefined)
			?.title;
		return [
			{ label: "Sessions", to: `${graphPath}/explorer` },
			{
				label: typeof title === "string" ? title : runAddress(snapshot.id),
				title: snapshot.id,
			},
		];
	}
	if (page.kind === "compare") {
		const [a, b] = page.id.split(":");
		if (!a || !b) return [];
		return [
			{ label: "Activity", to: `${graphPath}/activity` },
			{ label: "Runs", to: `${graphPath}/activity/runs` },
			{ label: `${runAddress(a)} · ${runAddress(b)}`, title: page.id },
		];
	}
	return [];
}
