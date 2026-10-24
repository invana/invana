/**
 * A function › **Calls** — the run steps in this Graph that called it, newest
 * first, eval replays left out. A row opens the run the step ran in.
 *
 * The engine filters by status and counts; the browser never narrows a row
 * and never sums one. The tab shows the newest page and says how many there
 * are in all.
 */

import {
	EmptyState,
	SegmentedControl,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { formatGrouped, formatShortDateTime } from "@invana-studio/core";
import { humanStatus, PanelSection, stepTone } from "@invana-studio/ui";
import { useState } from "react";
import { FleetReadState, ms, tokens } from "../../overview/fleetParts";
import { useFunctionCallsQuery } from "../queries";

const SHOWING = [
	{ value: "all", label: "All", statuses: [] },
	{ value: "succeeded", label: "Succeeded", statuses: ["succeeded"] },
	{ value: "failed", label: "Failed", statuses: ["failed"] },
	{ value: "live", label: "Live", statuses: ["queued", "running"] },
] as const;

type Showing = (typeof SHOWING)[number]["value"];

/** The newest calls a page shows. */
const LIMIT = 50;

export function CallsTab({
	username,
	graphSlug,
	stepKey,
	onOpenRun,
}: {
	username: string;
	graphSlug: string;
	stepKey: string;
	onOpenRun?: (runId: string) => void;
}) {
	const [showing, setShowing] = useState<Showing>("all");
	const statuses = SHOWING.find((s) => s.value === showing)?.statuses ?? [];
	const calls = useFunctionCallsQuery(username, graphSlug, stepKey, {
		filters: statuses.length ? { status: [...statuses] } : {},
		limit: LIMIT,
	});
	const page = calls.data;
	const rows = page?.items ?? [];

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-center gap-2">
				<SegmentedControl
					size="sm"
					aria-label="Showing"
					value={showing}
					onValueChange={(v) => setShowing(v as Showing)}
					options={SHOWING.map(({ value, label }) => ({ value, label }))}
				/>
				{page ? (
					<span className="ml-auto text-sm text-muted-foreground">
						{page.total > rows.length
							? `newest ${formatGrouped(rows.length)} of ${formatGrouped(page.total)}`
							: `${formatGrouped(page.total)} call${page.total === 1 ? "" : "s"}`}
					</span>
				) : null}
			</div>
			{calls.isLoading || calls.error ? (
				<FleetReadState
					loading={calls.isLoading}
					error={calls.error}
					what="its calls"
				/>
			) : rows.length === 0 ? (
				<EmptyState
					title="No calls here"
					description={
						showing === "all"
							? "No run in this Graph has called it yet."
							: "None of its calls matches this tab."
					}
				/>
			) : (
				<PanelSection card title="Calls — newest first">
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead className="w-full">Run</TableHead>
								<TableHead>Queued</TableHead>
								<TableHead>Tokens</TableHead>
								<TableHead>Time</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((c) => (
								<TableRow
									key={c.id}
									className={onOpenRun ? "cursor-pointer" : undefined}
									onClick={onOpenRun ? () => onOpenRun(c.run_id) : undefined}
								>
									<TableCell className="max-w-0 truncate">{c.title}</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground">
										{formatShortDateTime(new Date(c.queued_at))}
									</TableCell>
									<TableCell className="font-mono">
										{c.tokens ? tokens(c.tokens) : "—"}
									</TableCell>
									<TableCell className="font-mono">
										{ms(c.duration_ms)}
									</TableCell>
									<TableCell className="whitespace-nowrap">
										<span className="inline-flex items-center gap-1.5">
											<StatusDot tone={stepTone(c.status)} />
											{humanStatus(c.status)}
										</span>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</PanelSection>
			)}
		</div>
	);
}
