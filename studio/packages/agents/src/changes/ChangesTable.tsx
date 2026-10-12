/**
 * A record's change log as a table — version · when · by · what changed · why
 * · after — the History tab of an agent and of a skill (boards
 * `agents.agent.history` · `agents.skills.history`).
 *
 * *After* is the engine's effect of each version: the runs that recorded it,
 * how many failed, and the tokens they used. Newest first. `act` draws a
 * row's own action — a restore — and `detail` what a row opens under it.
 */

import {
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { Fragment, type ReactNode } from "react";
import {
	type ChangeEntry,
	effectLine,
	type RecordKind,
	useRecordHistoryQuery,
} from "./history";

/** Engine field names, in the product's words. */
const FIELD_WORDS: Record<string, string> = {
	model_pin: "model version",
	lens_id: "world",
	workflow_spec: "plan",
};

/** A change summary with each `<field> changed` named as the product names it. */
const worded = (summary: string) =>
	summary.replace(
		/\b([a-z][a-z0-9_]*) changed\b/g,
		(_, field: string) =>
			`${FIELD_WORDS[field] ?? field.replaceAll("_", " ")} changed`,
	);

const day = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})
		: "—";

export function ChangesTable({
	username,
	graphSlug,
	kind,
	recordId,
	act,
	detail,
}: {
	username: string;
	graphSlug: string;
	kind: RecordKind;
	recordId: string;
	act?: (entry: ChangeEntry, latest: boolean) => ReactNode;
	detail?: (entry: ChangeEntry) => ReactNode;
}) {
	const history = useRecordHistoryQuery(username, graphSlug, kind, recordId);
	// The engine answers newest first, and so does the table.
	const items = history.data?.items ?? [];

	if (history.isLoading) return <Spinner />;
	return (
		<PanelSection card title="Changes" hint={`${items.length}`}>
			{items.length === 0 ? (
				<p className="text-muted-foreground">
					Nothing has changed since it was made.
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Version</TableHead>
							<TableHead>When</TableHead>
							<TableHead>By</TableHead>
							<TableHead className="w-1/2 min-w-48">What changed</TableHead>
							<TableHead className="w-1/2">Why</TableHead>
							<TableHead>After</TableHead>
							{act ? <TableHead /> : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((e, i) => {
							const more = detail?.(e);
							return (
								<Fragment key={`${e.version}-${e.event_id}`}>
									<TableRow>
										<TableCell className="font-mono">v{e.version}</TableCell>
										<TableCell className="whitespace-nowrap">
											{day(e.at)}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{e.actor_name ?? e.actor_kind ?? "—"}
										</TableCell>
										<TableCell>{worded(e.summary)}</TableCell>
										<TableCell>{e.why ?? "—"}</TableCell>
										<TableCell className="whitespace-nowrap">
											{effectLine(e.effect)}
										</TableCell>
										{act ? <TableCell>{act(e, i === 0)}</TableCell> : null}
									</TableRow>
									{more ? (
										<TableRow>
											<TableCell colSpan={act ? 7 : 6}>{more}</TableCell>
										</TableRow>
									) : null}
								</Fragment>
							);
						})}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}
