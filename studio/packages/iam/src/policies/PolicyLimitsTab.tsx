/**
 * A policy's **Limits** — each ceiling beside what the policy's holders use
 * now, read from the engine (`…/limits`): the used line and the meter's share
 * are its numbers, printed as they come. Beside the table, what happens when a
 * limit is reached and how an agent's own settings sit under these ceilings.
 *
 * The ceilings change through *Edit*, with the statements, so a limit is
 * reviewed by its impact like any other change.
 */

import { Switch } from "@invana/forms";
import {
	PanelBox,
	Progress,
	PropertyList,
	PropertyRow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { usePolicyLimitsQuery } from "../queries";
import { ceilingLine, ReadState } from "./policyParts";

export function PolicyLimitsTab({
	username,
	graphSlug,
	name,
}: {
	username: string;
	graphSlug: string;
	name: string;
}) {
	const query = usePolicyLimitsQuery(username, graphSlug, name);
	const limits = query.data;
	if (!limits)
		return (
			<ReadState
				loading={query.isLoading}
				error={query.error}
				what="this policy's limits"
				onRetry={() => void query.refetch()}
			/>
		);

	return (
		<div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<Table aria-label="Limits">
				<TableHeader>
					<TableRow>
						<TableHead>Limit</TableHead>
						<TableHead>Per</TableHead>
						<TableHead>Ceiling</TableHead>
						<TableHead>Used now</TableHead>
						<TableHead className="w-40" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{limits.rows.map((row) => (
						<TableRow key={row.key}>
							<TableCell className="font-semibold">{row.label}</TableCell>
							<TableCell className="text-sm text-muted-foreground">
								{row.per}
							</TableCell>
							<TableCell>{ceilingLine(row.key, row.ceiling)}</TableCell>
							<TableCell className="text-sm">{row.used_line}</TableCell>
							<TableCell>
								{row.share === null ? (
									<span className="text-muted-foreground">—</span>
								) : (
									<span className="flex items-center gap-2">
										<Progress
											size="sm"
											className="w-24"
											value={row.share}
											aria-label={`${row.label} ${row.per} used`}
										/>
										<span className="text-sm text-muted-foreground tabular-nums">
											{Math.round(row.share)}%
										</span>
									</span>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<div className="flex flex-col gap-3">
				<PanelBox title="When a limit is reached">
					<PropertyList labelWidth="auto">
						<PropertyRow label="Live agents">
							new agents wait for a slot; the run carries on
						</PropertyRow>
						<PropertyRow label="Tokens">
							the run pauses and asks the person who started it
						</PropertyRow>
						<PropertyRow label="Worker-seconds">
							its steps wait until the hour turns
						</PropertyRow>
						<PropertyRow label="May ask for more">
							<span className="flex items-center gap-2">
								<Switch
									checked={limits.may_ask_more}
									disabled
									aria-label="May ask for more"
								/>
								{limits.may_ask_more
									? `asks go to ${limits.asks_go_to ?? "the policy's owner"}, in Approvals`
									: "no — a limit reached is final"}
							</span>
						</PropertyRow>
					</PropertyList>
				</PanelBox>
				<PanelBox title="Agents set their own">
					<p className="text-muted-foreground">
						An agent's own budget, children and live-at-once sit under these
						ceilings. A setting above a ceiling is refused when saved, naming
						this policy.
					</p>
				</PanelBox>
			</div>
		</div>
	);
}
