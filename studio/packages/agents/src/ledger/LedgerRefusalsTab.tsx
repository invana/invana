/**
 * Ledger › Refusals: what the bounds held today — tiles Refused today (its
 * share of acts) · By grant · By lens · By ceiling, refused a day over 30
 * days, the most refused functions, and each rule that held with what it
 * stopped and whom. Every figure is the engine's `/ledger/refusals`.
 */

import { BarChartV } from "@invana/charts";
import {
	Badge,
	MetricGrid,
	MetricTile,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { day, FleetReadState } from "../overview/fleetParts";
import { CountTable } from "./CountTable";
import { Act, n } from "./ledgerParts";
import { useLedgerRefusalsQuery } from "./queries";

const REASON_TONE: Record<string, "destructive" | "warning" | "muted"> = {
	grant: "destructive",
	lens: "destructive",
	ceiling: "warning",
};

export function LedgerRefusalsTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const read = useLedgerRefusalsQuery(username, graphSlug);
	const d = read.data;
	if (!d)
		return (
			<FleetReadState
				loading={read.isLoading}
				error={read.error}
				what="the refusals"
			/>
		);
	const last = d.by_day.length - 1;

	return (
		<div className="flex flex-col gap-3">
			<MetricGrid minTileWidth={160}>
				<MetricTile
					label="Refused today"
					value={n(d.refused_today)}
					caption={`of ${n(d.acts_today)}${d.share_pct == null ? "" : ` · ${d.share_pct}%`}`}
					captionTone="muted"
				/>
				<MetricTile label="By grant" value={n(d.by_grant)} />
				<MetricTile label="By lens" value={n(d.by_lens)} />
				<MetricTile
					label="By ceiling"
					value={n(d.by_ceiling)}
					caption={d.by_robots ? `${n(d.by_robots)} by robots.txt` : undefined}
					captionTone="muted"
				/>
			</MetricGrid>
			<div className="grid gap-3 lg:grid-cols-2">
				<PanelSection card title="Refused a day · 30 days">
					<BarChartV
						height={120}
						highlightIndex={last >= 0 ? last : null}
						labelMode="none"
						data={d.by_day.map((b, i) => ({
							// Only the window's ends are named.
							label: i === 0 || i === last ? day(b.day) : "",
							value: b.refused,
							display: `${n(b.refused)} refused`,
						}))}
					/>
				</PanelSection>
				<CountTable
					title="Top refused functions"
					rows={d.top_functions}
					rowKey={(r) => r.key}
					empty="Nothing refused"
					columns={[
						{ header: "Function", cell: (r) => <Act act={r.key} /> },
						{ header: "Refused", cell: (r) => n(r.a), numeric: true },
						{ header: "Rule", cell: (r) => r.line || "—" },
					]}
				/>
			</div>
			<PanelSection card title="By the rule that held">
				{d.by_rule.length === 0 ? (
					<p className="py-2 text-muted-foreground">No rule held today</p>
				) : (
					<Table density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Rule</TableHead>
								<TableHead>Today</TableHead>
								<TableHead>What</TableHead>
								<TableHead>Who</TableHead>
								<TableHead>The rule</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{d.by_rule.map((r) => (
								<TableRow key={`${r.refused_by}:${r.rule}`}>
									<TableCell>
										<Badge
											variant="soft"
											tone={REASON_TONE[r.refused_by] ?? "muted"}
										>
											{r.rule}
										</Badge>
									</TableCell>
									<TableCell className="font-mono">{n(r.today)}</TableCell>
									<TableCell>{r.what}</TableCell>
									<TableCell>{r.who}</TableCell>
									<TableCell className="text-muted-foreground">
										{r.the_rule}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</PanelSection>
		</div>
	);
}
