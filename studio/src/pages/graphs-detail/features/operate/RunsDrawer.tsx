// **Runs** — the first drawer of the Tasks stack (see-what-ran.md SR12).
//
// One journal of every TaskRun in the Graph, newest first. Imports is this
// list with `kind in (import, bulk)` preselected, not a panel and not an icon
// (SR7) — which is why the drawer's body is the journal that used to be the
// Imports panel, unchanged apart from losing its own chrome.
//
// The drawer draws the title, the count, the search and the filter; a drill-in
// replaces this body and turns the header into `‹ RUNS / orders.csv`, leaving
// Plans and Catalogue where they were (G32 · G33).

import { useRunsJournalQuery } from "@/hooks/queries/useRuns";
import {
	IMPORT_STATUSES,
	ImportsJournalBody,
} from "@/pages/graphs-detail/features/bring-data-in/ImportsPanel";
import { RunDetailDrawer } from "@/pages/graphs-detail/features/operate/RunDetailDrawer";
import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import {
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	type PanelStackSection,
} from "@invana/ui";
import { ListChecks } from "lucide-react";

export interface RunsDrawerProps {
	username: string;
	graphSlug: string;
	ui: TaskDrawerUi;
	/** `&run=` — the run whose detail replaces this drawer's body. */
	runId: string | null;
	onOpenRun: (id: string | null) => void;
	/** `More` on a drilled-in run — opens its dashboard as a page (SR13). */
	onOpenDashboard?: (runId: string) => void;
	/** The dataset the inspector's provenance line asked for. */
	status: string | null;
	onStatus: (s: string | null) => void;
	/** Height while this is the focused drawer. */
	defaultSize?: number | string;
	defaultCollapsed?: boolean;
}

export function runsDrawerSection({
	username,
	graphSlug,
	ui,
	runId,
	onOpenRun,
	onOpenDashboard,
	status,
	onStatus,
	defaultSize,
	defaultCollapsed,
}: RunsDrawerProps): PanelStackSection {
	return taskDrawerSection(
		{
			id: "runs",
			label: "Runs",
			icon: ListChecks,
			count: <RunsCount username={username} graphSlug={graphSlug} />,
			trail: runId ? (
				<RunTrail username={username} graphSlug={graphSlug} runId={runId} />
			) : undefined,
			onBack: () => onOpenRun(null),
			searchable: false,
			filtered: Boolean(status),
			filterMenu: (
				<DropdownMenuRadioGroup
					value={status ?? "all"}
					onValueChange={(v) => onStatus(v === "all" ? null : v)}
				>
					<DropdownMenuRadioItem value="all">
						all statuses
					</DropdownMenuRadioItem>
					{IMPORT_STATUSES.map((s) => (
						<DropdownMenuRadioItem key={s} value={s}>
							{s}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			),
			defaultSize,
			defaultCollapsed,
			// A drill-in replaces this drawer's body with the run, read end to
			// end — Stats · Performance · Log (SR12 · §3b version C).
			children: () =>
				runId ? (
					<RunDetailDrawer
						username={username}
						graphSlug={graphSlug}
						runId={runId}
						onOpenDashboard={onOpenDashboard}
					/>
				) : (
					<ImportsJournalBody
						username={username}
						graphSlug={graphSlug}
						runId={runId}
						onOpenRun={onOpenRun}
						status={status}
					/>
				),
		},
		ui,
	);
}

/** `24 · 2 running` — the count the drawer header carries beside its label. */
function RunsCount({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const journal = useRunsJournalQuery(username, graphSlug);
	const n = journal.rows.length;
	if (n === 0) return null;
	return <>{journal.live ? `${n} · ${journal.live} running` : `${n}`}</>;
}

/**
 * The drilled-in run's own name, for `‹ RUNS / orders.csv`. A run is named by
 * what it acted on, not by its id — an id in a breadcrumb says only that
 * something is open.
 */
function RunTrail({
	username,
	graphSlug,
	runId,
}: {
	username: string;
	graphSlug: string;
	runId: string;
}) {
	// A run is named by what it acted on — which for an ask is the plan that
	// answered, not the dataset it never touched.
	const journal = useRunsJournalQuery(username, graphSlug);
	return <>{journal.rows.find((r) => r.id === runId)?.title ?? "…"}</>;
}
