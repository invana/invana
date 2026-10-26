/**
 * A report, opened — `kind:{subjectId}@{versionId}`
 * ([ · § 6.4](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * **One body for every declared kind**, because a frozen reading has no kind to
 * branch on: the stored blob *is* the document, so there is nothing left for a
 * composer to do. The subject is never read — that is what makes it a report,
 * and what lets it outlive a pruned `result.json`.
 *
 * Nothing is re-merged against today's builder either. Re-merging would give
 * panels the data has nothing for, and data for panels that no longer exist,
 * so the blob renders through the same `<Board>` as it was written.
 */

import { Board, type BoardSpec } from "@invana/boards";
import {
	Alert,
	AlertDescription,
	Button,
	EmptyState,
	Spinner,
} from "@invana/ui";
import { useMembersQuery } from "@invana-studio/core";
import {
	boardReportsApi,
	DeclaredBoardContext,
	useBoardReportsQuery,
} from "@invana-studio/shell";
import { BOARD_ICONS } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useContext } from "react";
import { DECLARED_WIDGETS } from "@/host/boards/boardWidgets";

/** The one act a report's head carries: every reading kept of this board. */
const OPEN_REPORTS = "open-reports";

/** `9 Oct` — the day a reading was kept. */
const keptOn = (at: Date) =>
	at.toLocaleDateString(undefined, { day: "numeric", month: "short" });

export interface FrozenBoardPageProps {
	username: string;
	graphSlug: string;
	kind: string;
	subjectId: string;
	versionId: string;
	/** Back to the board this is a reading of — the same page, live. */
	onOpenLive: () => void;
}

/**
 * The read of one report. Frozen, so it is fetched once and never refetched:
 * a poll here would be the live read the page exists not to make. The header's
 * trail reads the same key, so naming the page costs no second request.
 */
export function boardReportQuery(
	username: string,
	graphSlug: string,
	kind: string,
	subjectId: string,
	versionId: string,
) {
	return {
		queryKey: ["board-report", username, graphSlug, kind, subjectId, versionId],
		queryFn: () =>
			boardReportsApi.get(username, graphSlug, kind, subjectId, versionId),
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
	};
}

export function FrozenBoardPage({
	username,
	graphSlug,
	kind,
	subjectId,
	versionId,
	onOpenLive,
}: FrozenBoardPageProps) {
	const report = useQuery(
		boardReportQuery(username, graphSlug, kind, subjectId, versionId),
	);
	const board = useContext(DeclaredBoardContext);
	const reports = useBoardReportsQuery(username, graphSlug, kind, subjectId);
	const members = useMembersQuery({ username, graphSlug });

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

	const kept = report.data.snapshot as unknown as BoardSpec;
	const keeper = members.data?.items.find(
		(m) => m.user_id === report.data.createdById,
	)?.username;
	// The head keeps the reading's crumbs and chips; its one act finds the
	// other readings kept of this board, counted by the engine.
	const spec: BoardSpec = kept.header
		? {
				...kept,
				header: {
					...kept.header,
					actions: [
						{
							id: OPEN_REPORTS,
							label:
								reports.data != null
									? `Reports · ${reports.data.total}`
									: "Reports",
							variant: "outline",
						},
					],
				},
			}
		: kept;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Which reading you are looking at. A frozen page that did not say so
			    would be a live board that had quietly stopped updating. */}
			<Alert
				tone="info"
				className="flex shrink-0 items-center justify-between gap-2 rounded-none border-x-0 border-t-0 px-3 py-1.5"
			>
				<AlertDescription className="flex items-center gap-2">
					<Save className="size-4 shrink-0 text-info" />
					<span>
						Saved report · <strong>{report.data.label}</strong> · kept
						{keeper ? ` by ${keeper}` : ""} on {keptOn(report.data.createdAt)} ·
						it will not change
					</span>
				</AlertDescription>
				<Button variant="outline" size="sm" onClick={onOpenLive}>
					Back to live
				</Button>
			</Alert>
			<div className="min-h-0 flex-1">
				<Board
					className="h-full min-h-0"
					spec={spec}
					// Every registered kind, not this page's — a report has no
					// composer to tell it which it needs. All of them are
					// pure, so nothing here re-reads the subject.
					registry={DECLARED_WIDGETS}
					icons={BOARD_ICONS}
					onAction={(id) => {
						if (id === OPEN_REPORTS) board?.openReports();
					}}
				/>
			</div>
		</div>
	);
}
