/**
 * **Runs** — one icon, one panel, **one list** (graph-detail-page.md G33 · G41 ·
 * SR1).
 *
 * The journal of every TaskRun in the Graph, newest first, children nested.
 * Imports is this list with `kind in (import, bulk)` preselected, not a panel
 * and not an icon (SR7) — which is why the body is the journal that used to be
 * the Imports panel.
 *
 * **It is a list, not a stack.** The definitions a run is composed from — plans,
 * the catalogue, templates — are **Library** (G41), so there is no second list
 * here for `?drawer=` to choose between, and the panel keeps the one-header
 * `ListPanelChrome` grammar every other list uses. A drill-in replaces the
 * panel body and turns the header into `‹ RUNS / orders.csv`; `More` opens the
 * run's dashboard as a page (SR13 · SR36).
 *
 * The step that crosses into Library is *run → the plan it ran*, and
 * `mainSection` carries it: `keepMounted` keeps the run open beside the plan,
 * which is the property SR12 was protecting when it asked for drawer adjacency.
 */

import { useRunTouchesQuery } from "@/hooks/queries/useGovern";
import { type RunsFilters, useRunsJournalQuery } from "@/hooks/queries/useRuns";
import { useAgentsQuery } from "@/hooks/queries/useWork";
import { ImportsJournalBody } from "@/pages/graphs-detail/features/bring-data-in/ImportsPanel";
import {
	RunDetailDrawer,
	runAddress,
} from "@/pages/graphs-detail/features/operate/RunDetailDrawer";
import { RunsFilterBar } from "@/pages/graphs-detail/features/operate/RunsFilterBar";
import {
	taskDrawerSection,
	useTaskDrawerUi,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import { useGovernPanel } from "@/pages/graphs-detail/shell/useGovernPanel";
import { useRunsPanel } from "@/pages/graphs-detail/shell/useRunsPanel";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import { PanelStack } from "@invana/ui";
import { useState } from "react";

export interface RunsPanelProps {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	/** `More` on a drilled-in run — opens its dashboard as a page (SR13). */
	onOpenRunDashboard?: (runId: string) => void;
	/** `Compare with the plan` — draws the plan a run ran in `mainSection`. */
	onOpenPlan?: (workflowKey: string) => void;
}

const NO_FILTERS: RunsFilters = {};

export function RunsPanel({
	username,
	graphSlug,
	onOpenRunDashboard,
	onOpenPlan,
}: RunsPanelProps) {
	const { runId, openRun } = useRunsPanel();
	// A run's lens opens where it is edited: Govern, drilled into that record.
	const { reveal } = useGovernPanel();
	const ui = useTaskDrawerUi();
	// A filter narrows a list, and a narrowed list is not a place — so it is
	// in-memory, not a URL key (G31).
	const [filters, setFilters] = useState<RunsFilters>(NO_FILTERS);
	const patch = (p: Partial<RunsFilters>) =>
		setFilters((prev) => ({ ...prev, ...p }));
	const journal = useRunsJournalQuery(username, graphSlug, filters);
	const agents = (useAgentsQuery(username, graphSlug).data?.items ?? []).map(
		(a) => ({ id: a.id, name: a.name }),
	);

	// Search narrows here, beside the chips, so the status bar's `shown` counts
	// what is actually on screen.
	const drawerUi = ui.get("runs");
	const needle = drawerUi.searchOpen
		? drawerUi.search.trim().toLowerCase()
		: "";
	const rows = needle
		? journal.rows.filter((r) =>
				[r.title, r.id, r.plan].some((v) => v.toLowerCase().includes(needle)),
			)
		: journal.rows;

	const filtered = Object.values(filters).some(Boolean);
	const count = journal.total
		? journal.live
			? `${journal.total} · ${journal.live} running`
			: `${journal.total}`
		: undefined;

	// A drilled-in run is addressed, not titled: `RUNS / run:7d3184f1` (SR54).
	const runTitle = runId ? runAddress(runId) : undefined;
	// Drilled in, the bar counts the run's ledger rather than the journal:
	// `9 events · 1 refusal` (SR67). Shares the drawer's query, so no second read.
	const touches = useRunTouchesQuery(
		username,
		graphSlug,
		runId ?? undefined,
	).data;
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
						taskDrawerSection(
							{
								id: "runs",
								label: "Runs",
								count,
								trail: runTitle,
								onBack: () => openRun(null),
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
										// A drill-in replaces the drawer body with the run's five
										// sections and its two ways out (SR67).
										<RunDetailDrawer
											username={username}
											graphSlug={graphSlug}
											runId={runId}
											onOpenDashboard={onOpenRunDashboard}
											onOpenPlan={onOpenPlan}
											onOpenLens={(lens) => reveal(lens.kind, lens.id)}
										/>
									) : (
										<ImportsJournalBody
											rows={rows}
											isLoading={journal.isLoading}
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
					journal.live
						? [
								<StatusCount key="live" tone="running">
									{journal.live} running
								</StatusCount>,
							]
						: []
				}
				right={
					runId
						? runRight
						: journal.total
							? `${rows.length} of ${journal.total} shown`
							: undefined
				}
			/>
		</div>
	);
}
