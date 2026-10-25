/**
 * Ledger › By record (`?address=graph/Airport:LHR&since=30d`): one address
 * over a window — tiles Acts · Reads · Writes · Refused · People · Agents,
 * every act on it, and who can see it now (worlds, people, agents, who may
 * write), which the engine reads from govern rather than from the ledger.
 *
 * The address is typed and read on Enter, so a half-typed one is never read.
 */

import { Input } from "@invana/forms";
import {
	EmptyState,
	MetricGrid,
	MetricTile,
	PropertyList,
	PropertyRow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import { FleetReadState } from "../overview/fleetParts";
import {
	Act,
	ActorChain,
	n,
	rowTime,
	SINCE_OPTIONS,
	sinceLabel,
	VerdictBadge,
} from "./ledgerParts";
import { useLedgerRecordQuery } from "./queries";
import { SinceSelect } from "./SinceSelect";
import { useSearchParam } from "./useSearchParam";

export function LedgerRecordTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const [address, setAddress] = useSearchParam("address");
	const [sinceParam, setSince] = useSearchParam("since");
	const since = sinceParam || "30d";
	const [typed, setTyped] = useState(address);
	useEffect(() => setTyped(address), [address]);
	const read = useLedgerRecordQuery(
		username,
		graphSlug,
		address || null,
		since,
	);
	const d = read.data;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					className="w-72 font-mono"
					aria-label="Address"
					placeholder="graph/Airport:LHR"
					value={typed}
					onChange={(e) => setTyped(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") setAddress(typed.trim());
					}}
					onBlur={() => setAddress(typed.trim())}
				/>
				<SinceSelect
					value={since}
					options={SINCE_OPTIONS}
					onChange={setSince}
				/>
				<span className="ml-auto text-muted-foreground">
					every act on this record, and who can see it
				</span>
			</div>

			{!address ? (
				<EmptyState
					title="Type an address"
					description="A type or one record — graph/Fare, graph/Airport:LHR — and press Enter."
				/>
			) : !d ? (
				<FleetReadState
					loading={read.isLoading}
					error={read.error}
					what="the record"
				/>
			) : (
				<>
					<MetricGrid minTileWidth={140}>
						<MetricTile
							label="Acts"
							value={n(d.acts)}
							caption={sinceLabel(d.since).toLowerCase()}
							captionTone="muted"
						/>
						<MetricTile label="Reads" value={n(d.reads)} />
						<MetricTile
							label="Writes"
							value={n(d.writes)}
							caption={d.writes_line || undefined}
							captionTone="muted"
						/>
						<MetricTile
							label="Refused"
							value={n(d.refused)}
							caption={d.refused_line || undefined}
							captionTone="muted"
						/>
						<MetricTile label="People" value={n(d.people)} />
						<MetricTile label="Agents" value={n(d.agents)} />
					</MetricGrid>
					<div className="grid gap-3 lg:grid-cols-3">
						<div className="min-w-0 lg:col-span-2">
							<PanelSection card title={`Acts on ${d.address}`}>
								{d.rows.length === 0 ? (
									<p className="py-2 text-muted-foreground">
										No act on this record in the window
									</p>
								) : (
									<Table density="compact">
										<TableHeader>
											<TableRow>
												<TableHead>When</TableHead>
												<TableHead>Actor</TableHead>
												<TableHead>Act</TableHead>
												<TableHead>What</TableHead>
												<TableHead>Verdict</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{d.rows.map((r) => (
												<TableRow key={r.id}>
													<TableCell className="whitespace-nowrap font-mono text-muted-foreground">
														{rowTime(r.at)}
													</TableCell>
													<TableCell>
														<ActorChain chain={r.actor_chain} />
													</TableCell>
													<TableCell>
														<Act act={r.act} />
													</TableCell>
													<TableCell className="text-muted-foreground">
														{r.touched_line || "—"}
													</TableCell>
													<TableCell>
														<VerdictBadge
															verdict={r.verdict}
															refusedBy={r.refused_by}
														/>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</PanelSection>
						</div>
						<PanelSection card title="Who can see it now">
							<PropertyList labelWidth="auto">
								<PropertyRow label="Worlds">
									{d.can_see.worlds.join(" · ") || "—"}
								</PropertyRow>
								<PropertyRow label="People">
									{d.can_see.people || "—"}
								</PropertyRow>
								<PropertyRow label="Agents">
									{d.can_see.agents || "—"}
								</PropertyRow>
								<PropertyRow label="Can write">
									{d.can_see.can_write || "—"}
								</PropertyRow>
							</PropertyList>
						</PanelSection>
					</div>
				</>
			)}
		</div>
	);
}
