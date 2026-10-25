/**
 * Ledger › Rows: the tiles for the window (acts against the 7-day daily mean,
 * people, agents, refused by reason, approvals waiting), the preset chips with
 * the engine's counts, and {@link LedgerRowsTable} under them.
 *
 * The tiles read `/ledger/stats` for the Rows window (`f.since`, else today);
 * a preset is a toggle — one on at a time — that writes `?f.preset=`, and the
 * engine narrows the rows.
 *
 * The tiles and chips count rows across the whole Graph, so only an owner —
 * the one reader the engine shows every row — sees them. A member's tab is the
 * banner, the filters and the table.
 */

import { Button, MetricGrid, MetricTile, Toggle } from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { useAccess } from "@invana-studio/shell";
import { filterValue, setOne } from "../lists";
import { useAgentsOpen } from "../open";
import { LedgerRowsTable } from "./LedgerRowsTable";
import { byReason, n, sinceLabel } from "./ledgerParts";
import { useLedgerStatsQuery } from "./queries";

export function LedgerRowsTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const list = useListParams();
	const open = useAgentsOpen();
	const access = useAccess();
	const seesAll = !access.loading && access.gate("settings").allowed;
	// The tiles count a window; with *Any time* chosen they stay on today.
	const chosen = filterValue(list, "since") || "today";
	const since = chosen === "all" ? "today" : chosen;
	const stats = useLedgerStatsQuery(username, graphSlug, since).data;
	const preset = filterValue(list, "preset");
	const window = since === "today" ? "today" : sinceLabel(since).toLowerCase();

	return (
		<div className="flex flex-col gap-3">
			{seesAll && stats && (
				<>
					<MetricGrid minTileWidth={160}>
						<MetricTile
							label={since === "today" ? "Acts today" : `Acts · ${window}`}
							value={n(stats.acts)}
							caption={
								stats.acts_change_pct == null
									? undefined
									: `${stats.acts_change_pct >= 0 ? "+" : ""}${Math.round(stats.acts_change_pct)}% vs 7-day`
							}
							captionTone="muted"
						/>
						<MetricTile
							label="People"
							value={n(stats.people)}
							caption={`${n(stats.people_acts)} acts`}
							captionTone="muted"
						/>
						<MetricTile
							label="Agents"
							value={n(stats.agents)}
							caption={`${n(stats.agent_acts)} acts · ${n(stats.spawned)} spawned`}
							captionTone="muted"
						/>
						<MetricTile
							label="Refused"
							value={n(stats.refused)}
							caption={byReason(stats.refused_by) || undefined}
							captionTone="muted"
						/>
						<MetricTile
							label="Waiting"
							value={n(stats.waiting_approvals)}
							caption={
								<Button
									variant="link"
									size="sm"
									className="h-auto p-0 text-warning"
									onClick={() => open.section("approvals")}
								>
									approvals
								</Button>
							}
							captionTone={stats.waiting_approvals > 0 ? "warning" : "muted"}
						/>
					</MetricGrid>
					{stats.presets.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{stats.presets.map((p) => (
								<Toggle
									key={p.key}
									variant="outline"
									size="sm"
									pressed={preset === p.key}
									onPressedChange={(on) =>
										setOne(list, "preset", on ? p.key : "")
									}
								>
									{p.label} · {n(p.count)}
								</Toggle>
							))}
						</div>
					)}
				</>
			)}
			<LedgerRowsTable username={username} graphSlug={graphSlug} />
		</div>
	);
}
