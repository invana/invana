/**
 * A report, opened — `kind:{subjectId}@{versionId}`
 * ([B16 · § 6.4](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * **One body for every declared kind**, because a frozen reading has no kind to
 * branch on: the stored blob *is* the document, so there is nothing left for a
 * composer to do. The subject is never read — that is what makes it a report,
 * and what lets it outlive a pruned `result.json` (B13).
 *
 * Nothing is re-merged against today's builder either. Re-merging would give
 * panels the data has nothing for, and data for panels that no longer exist
 * (B16), so the blob renders through the same `<Dashboard>` as it was written.
 */

import { formatRelativeTime } from "@/lib/time";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { DECLARED_PANELS } from "@/pages/graphs-detail/shared/dashboardPanels";
import { boardReportsApi } from "@/services/api/boardReports";
import { Dashboard, type DashboardSpec } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useQuery } from "@tanstack/react-query";

export interface FrozenBoardPageProps {
	username: string;
	graphSlug: string;
	kind: string;
	subjectId: string;
	versionId: string;
	/** Back to the board this is a reading of — the same page, live. */
	onOpenLive: () => void;
}

export function FrozenBoardPage({
	username,
	graphSlug,
	kind,
	subjectId,
	versionId,
	onOpenLive,
}: FrozenBoardPageProps) {
	// A frozen reading never changes, so it is fetched once and never refetched:
	// a poll here would be the live read this page exists not to make.
	const report = useQuery({
		queryKey: ["board-report", username, graphSlug, kind, subjectId, versionId],
		queryFn: () =>
			boardReportsApi.get(username, graphSlug, kind, subjectId, versionId),
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
	});

	if (report.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (report.isError || !report.data) {
		return (
			<EmptyState
				className="h-full"
				title="This report is gone"
				description="A report is a version of a board. This one was removed with its board, or the link names a version that never existed."
			/>
		);
	}

	const spec = report.data.snapshot as unknown as DashboardSpec;
	const at = formatRelativeTime(report.data.createdAt);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Which reading you are looking at. A frozen page that did not say so
			    would be a live dashboard that had quietly stopped updating. */}
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-base text-muted-foreground">
				<span>
					A report — the numbers as they were {at}. Nothing here is being
					re-read.
				</span>
				<button
					type="button"
					onClick={onOpenLive}
					className="text-foreground hover:underline"
				>
					Open the live board
				</button>
			</div>
			<div className="min-h-0 flex-1">
				<Dashboard
					className="h-full min-h-0 overflow-y-auto p-3"
					spec={spec}
					// Every registered kind, not this page's — a report has no
					// composer to tell it which it needs (B19). All of them are
					// pure, so nothing here re-reads the subject.
					registry={DECLARED_PANELS}
					icons={DASHBOARD_ICONS}
				/>
			</div>
		</div>
	);
}
