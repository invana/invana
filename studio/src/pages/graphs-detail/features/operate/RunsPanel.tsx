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

import { useRunsJournalQuery } from "@/hooks/queries/useRuns";
import {
	IMPORT_STATUSES,
	ImportsJournalBody,
} from "@/pages/graphs-detail/features/bring-data-in/ImportsPanel";
import { RunDetailDrawer } from "@/pages/graphs-detail/features/operate/RunDetailDrawer";
import { ListPanelChrome } from "@/pages/graphs-detail/shared/ListPanel";
import { useRunsPanel } from "@/pages/graphs-detail/shell/useRunsPanel";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@invana/ui";
import { History } from "lucide-react";
import { useState } from "react";

export interface RunsPanelProps {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	/** `More` on a drilled-in run — opens its dashboard as a page (SR13). */
	onOpenRunDashboard?: (runId: string) => void;
}

export function RunsPanel({
	username,
	graphSlug,
	onClose,
	onOpenRunDashboard,
}: RunsPanelProps) {
	const { runId, openRun } = useRunsPanel();
	const journal = useRunsJournalQuery(username, graphSlug);
	// A filter narrows a list, and a narrowed list is not a place — so it is
	// in-memory, not a URL key (G31).
	const [status, setStatus] = useState<string | null>(null);

	const drilled = Boolean(runId);
	const count = journal.rows.length;
	const title = drilled ? (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					{/* The trail's first crumb is the way back — the drill-in replaced
					    the panel body, so the header is the only way out (G33). */}
					<button type="button" onClick={() => openRun(null)}>
						Runs
					</button>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbPage>
						{journal.rows.find((r) => r.id === runId)?.title ?? "…"}
					</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	) : count ? (
		`Runs (${journal.live ? `${count} · ${journal.live} running` : count})`
	) : (
		"Runs"
	);

	return (
		<ListPanelChrome
			title={title}
			icon={History}
			onRefresh={() => journal.refetch()}
			isRefreshing={journal.isFetching}
			onClose={onClose}
			// Search and filter apply to the list only, so a drilled-in panel —
			// showing one run — offers neither: narrowing a list that is not on
			// screen would be a control with no subject.
			listControls={!drilled}
			filterMenu={
				<>
					<DropdownMenuLabel>Status</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={status ?? "all"}
						onValueChange={(v) => setStatus(v === "all" ? null : v)}
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
				</>
			}
		>
			{() =>
				runId ? (
					// A drill-in replaces the panel body with the run, read end to end —
					// Stats · Performance · Log (SR12 · §3b version C).
					<RunDetailDrawer
						username={username}
						graphSlug={graphSlug}
						runId={runId}
						onOpenDashboard={onOpenRunDashboard}
					/>
				) : (
					<ImportsJournalBody
						username={username}
						graphSlug={graphSlug}
						runId={runId}
						onOpenRun={openRun}
						status={status}
					/>
				)
			}
		</ListPanelChrome>
	);
}
