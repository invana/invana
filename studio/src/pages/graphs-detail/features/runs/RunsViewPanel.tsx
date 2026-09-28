/**
 * **Runs** — one icon, one panel, **one list** (graph-detail-page.md G33 · G41 ·
 * SR1).
 *
 * The journal of every TaskRun in the Graph, newest first, children nested.
 * Imports is this list with `kind in (import, bulk)` preselected, not a panel
 * and not an icon (SR7) — which is why the body, `RunsList`, is the journal that used to be
 * the Imports panel.
 *
 * **It is a list, not a stack.** The definitions a run is composed from — plans,
 * the catalogue, templates — are **Library** (G41), so there is no second list
 * here for `?section=` to choose between, and the panel keeps the one-header
 * `ListPanelChrome` grammar every other list uses. A drill-in replaces the
 * panel body and turns the header into `‹ RUNS / orders.csv`; `More` opens the
 * run's dashboard as a page (SR13 · SR36).
 *
 * The step that crosses into Library is *run → the plan it ran*, and
 * `mainSection` carries it: `keepMounted` keeps the run open beside the plan,
 * which is the property SR12 was protecting when it asked for section adjacency.
 */

import { useAgentsQuery } from "@/pages/graphs-detail/features/agents";
import { useRunTouchesQuery } from "@/pages/graphs-detail/features/lenses";
import {
	RunDetail,
	runAddress,
} from "@/pages/graphs-detail/features/runs/RunDetail";
import { RunsFilterBar } from "@/pages/graphs-detail/features/runs/RunsFilterBar";
import { RunsList } from "@/pages/graphs-detail/features/runs/RunsList";
import { useRunListQuery } from "@/pages/graphs-detail/features/runs/queries";
import { useRunsFilters } from "@/pages/graphs-detail/features/runs/useRunsFilters";
import {
	stackSection,
	useStackSectionUi,
} from "@/pages/graphs-detail/shared/StackSection";
import { useLensesViewPanel } from "@/pages/graphs-detail/shell/useLensesViewPanel";
import { useRunsViewPanel } from "@/pages/graphs-detail/shell/useRunsViewPanel";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import { PanelStack } from "@invana/ui";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, RefreshCw } from "lucide-react";

export interface RunsViewPanelProps {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	/**
	 * `Open the answer` on a drilled-in run — opens its page (SR13); with a
	 * step, that task inside it (SR72).
	 */
	onOpenRunDashboard?: (runId: string, stepId?: string) => void;
	/** `Dashboard` on the header — the journal drawn wide, as a page (SR70). */
	onOpenRunsBoard?: () => void;
	/** `Compare with the plan` — draws the plan a run ran in `mainSection`. */
	onOpenPlan?: (workflowKey: string) => void;
}

export function RunsViewPanel({
	username,
	graphSlug,
	onOpenRunDashboard,
	onOpenRunsBoard,
	onOpenPlan,
}: RunsViewPanelProps) {
	const { runId, openRun } = useRunsViewPanel();
	// A run's lens opens where it is edited: Govern, drilled into that record.
	const { reveal } = useLensesViewPanel();
	const ui = useStackSectionUi();
	// Shared with the Runs page, so the two read one journal (SR70).
	const { filters, patch } = useRunsFilters();
	const runList = useRunListQuery(username, graphSlug, filters);
	const agents = (useAgentsQuery(username, graphSlug).data?.items ?? []).map(
		(a) => ({ id: a.id, name: a.name }),
	);

	// Search narrows here, beside the chips, so the status bar's `shown` counts
	// what is actually on screen.
	const sectionUi = ui.get("runs");
	const needle = sectionUi.searchOpen
		? sectionUi.search.trim().toLowerCase()
		: "";
	const rows = needle
		? runList.rows.filter((r) =>
				[r.title, r.id, r.plan].some((v) => v.toLowerCase().includes(needle)),
			)
		: runList.rows;

	const filtered = Object.values(filters).some(Boolean);
	const count = runList.total
		? runList.live
			? `${runList.total} · ${runList.live} running`
			: `${runList.total}`
		: undefined;

	// A drilled-in run is addressed, not titled: `RUNS / run:7d3184f1` (SR54).
	const runTitle = runId ? runAddress(runId) : undefined;
	// Drilled in, the bar counts the run's ledger rather than the journal:
	// `9 events · 1 refusal` (SR67). Shares the section's query, so no second read.
	const touchesQuery = useRunTouchesQuery(
		username,
		graphSlug,
		runId ?? undefined,
	);
	const touches = touchesQuery.data;
	// Drilled in, `Refresh` reads the run again — its trace and its ledger,
	// the two things the section is drawn from.
	const qc = useQueryClient();
	const traceKey = ["runs", username, graphSlug, runId, "trace"];
	const traceFetching = useIsFetching({ queryKey: traceKey }) > 0;
	const refreshRun = () => {
		void qc.invalidateQueries({ queryKey: traceKey });
		void touchesQuery.refetch();
	};
	const refusals = touches?.refused.length ?? 0;
	const runRight = touches
		? `${touches.total} event${touches.total === 1 ? "" : "s"}${
				refusals ? ` · ${refusals} refusal${refusals === 1 ? "" : "s"}` : ""
			}`
		: undefined;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack
					className="h-full"
					headerHeight={30}
					sections={[
						stackSection(
							{
								id: "runs",
								label: "Runs",
								count,
								trail: runTitle,
								onBack: () => openRun(null),
								headerActions: [
									{
										key: "refresh",
										name: "Refresh",
										icon: RefreshCw,
										iconClassName: runList.isFetching
											? "animate-spin"
											: undefined,
										onClick: () => void runList.refetch(),
									},
									...(onOpenRunsBoard
										? [
												{
													key: "dashboard",
													name: "Dashboard",
													icon: LayoutDashboard,
													onClick: onOpenRunsBoard,
												},
											]
										: []),
								],
								detailActions: [
									{
										key: "refresh",
										name: "Refresh",
										icon: RefreshCw,
										iconClassName:
											touchesQuery.isFetching || traceFetching
												? "animate-spin"
												: undefined,
										onClick: refreshRun,
									},
								],
								searchable: true,
								searchPlaceholder: "Search runs",
								filtered,
								filterBar: (
									<RunsFilterBar
										filters={filters}
										onChange={patch}
										agents={agents}
									/>
								),
								children: () =>
									runId ? (
										// A drill-in replaces the section body with the run's five
										// sections and its two ways out (SR67).
										<RunDetail
											username={username}
											graphSlug={graphSlug}
											runId={runId}
											onOpenDashboard={onOpenRunDashboard}
											onOpenPlan={onOpenPlan}
											onOpenLens={(lens) => reveal(lens.kind, lens.id)}
										/>
									) : (
										<RunsList
											rows={rows}
											isLoading={runList.isLoading}
											runId={runId}
											onOpenRun={openRun}
											narrowed={filtered || Boolean(needle)}
										/>
									),
							},
							ui,
						),
					]}
				/>
			</div>
			<PanelStatusBar
				left={
					<>
						<StatusCrumb active={!runId}>Runs</StatusCrumb>
						{runTitle ? <StatusCrumb active>{runTitle}</StatusCrumb> : null}
					</>
				}
				middle={
					runList.live
						? [
								<StatusCount key="live" tone="running">
									{runList.live} running
								</StatusCount>,
							]
						: []
				}
				right={
					runId
						? runRight
						: runList.total
							? `${rows.length} of ${runList.total} shown`
							: undefined
				}
			/>
		</div>
	);
}
