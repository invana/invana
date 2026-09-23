/**
 * The wrapper every declared page is mounted inside — the two acts a board
 * carries, and the card one of them opens
 * ([B20 · B21](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * Which board a page is — its `kind` and its `subject_id` — is the host's
 * knowledge, so it is put here once rather than threaded through six
 * components that have no other use for it. A page gains both acts by calling
 * `useReport(spec)`: `Save report` keeps this reading, `Reports` finds a kept
 * one. They are a pair and they sit together, on the dashboard's **own**
 * header — a canvas' History is a strip control only because a canvas has no
 * header to put one on (B21).
 *
 * A hook cannot draw, and a composer that drew its own card would stop being
 * the pure function of one read that § 5.5 requires — so the card is rendered
 * here, over whatever page is open, and the hook only opens it.
 */

import { useBoardReportsQuery } from "@/hooks/queries/useBoardVersions";
import { BoardHistoryCard } from "@/pages/graphs-detail/features/boards/BoardHistoryCard";
import { DeclaredBoardContext } from "@/pages/graphs-detail/features/boards/useReport";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

export interface DeclaredBoardProps {
	username: string;
	graphSlug: string;
	kind: string;
	subjectId: string;
	/**
	 * Show this board's frozen reading — `kind:{subjectId}@{versionId}`. It is
	 * one callback, because saving a report and opening one from the list are
	 * the same move: the page becomes that reading (B12 · B22).
	 */
	onOpenVersion: (versionId: string) => void;
	children: ReactNode;
}

export function DeclaredBoard({
	username,
	graphSlug,
	kind,
	subjectId,
	onOpenVersion,
	children,
}: DeclaredBoardProps) {
	const [reportsOpen, setReportsOpen] = useState(false);
	const openReports = useCallback(() => setReportsOpen(true), []);

	const value = useMemo(
		() => ({
			username,
			graphSlug,
			kind,
			subjectId,
			onSaved: onOpenVersion,
			openReports,
		}),
		[username, graphSlug, kind, subjectId, onOpenVersion, openReports],
	);

	// Only while the card is open: a dashboard nobody asked the question of
	// should not be fetching a list nobody is reading.
	const reports = useBoardReportsQuery(
		username,
		graphSlug,
		kind,
		subjectId,
		reportsOpen,
	);

	return (
		<DeclaredBoardContext.Provider value={value}>
			<div className="relative h-full min-h-0">
				{children}
				{reportsOpen ? (
					<BoardHistoryCard
						title="Reports"
						onClose={() => setReportsOpen(false)}
						isLoading={reports.isLoading}
						versions={reports.data?.items ?? []}
						fallbackLabel="Report"
						empty="No reports of this board yet. A live dashboard re-reads its subject every time it opens — Save report keeps the numbers as they are right now."
						// A report **opens**; it does not restore. There is nothing to
						// fork into, because the live board is always there (B22).
						action={(report) => ({
							label: "Open this report",
							onClick: () => {
								setReportsOpen(false);
								onOpenVersion(report.id);
							},
						})}
					/>
				) : null}
			</div>
		</DeclaredBoardContext.Provider>
	);
}
