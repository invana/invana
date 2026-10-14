/**
 * **A finding** — one claim with every record behind it, its origin and
 * version, and whether a person reviewed it (projects.md PJ-06, board
 * `projects.finding`).
 *
 * The evidence table is the finding's cites: a dataset version opens in
 * Datasets with its origin read from the dataset, a run opens as its board, a
 * record names its id. **Rules** are the checks of every decision that cited
 * this finding — what it was held to, and whether it passed. An agent's
 * finding waits for a person: *Review* is that person saying they checked it.
 */

import {
	Badge,
	Button,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { RecordRow } from "@invana-studio/ui";
import { Check, GitBranch } from "lucide-react";
import {
	useFindingQuery,
	useLineageDatasets,
	useRecordMutations,
} from "../records/queries";
import { usePeople } from "../records/usePeople";
import {
	parseDatasetRef,
	type useProjectRecords,
} from "../records/useProjectRecords";
import { branchLabel, evidenceWord, shortDate } from "../records/words";
import type { Project } from "../types";
import { Box, Muted, Page, ReadState, StanceBadge } from "./parts";

export function FindingView({
	username,
	graphSlug,
	project,
	records,
	number,
	onTrace,
	onOpenRun,
	onOpenDataset,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	records: ReturnType<typeof useProjectRecords>;
	number: number;
	onTrace: (decision: number) => void;
	onOpenRun?: (runId: string) => void;
	onOpenDataset?: (address: string) => void;
}) {
	const ref = { username, graphSlug, key: project.key };
	const query = useFindingQuery(ref, number);
	const { review } = useRecordMutations(ref);
	const f = query.data;
	const datasetAddresses = (f?.cites ?? []).flatMap((c) => {
		const d = c.kind === "dataset" ? parseDatasetRef(c.ref) : null;
		return d ? [`${d.publisher}/${d.name}`] : [];
	});
	const datasets = useLineageDatasets(datasetAddresses);
	const people = usePeople(username, graphSlug, [project.key]);
	if (!f)
		return (
			<Page>
				<ReadState loading={query.isLoading} error={query.error} />
			</Page>
		);

	const citedBy = records.decisions.filter((d) => d.cites.includes(f.number));
	const checks = citedBy.flatMap((d) =>
		d.checks.map((c) => ({ ...c, decision: d.number })),
	);
	const named = (id: string | null, fallback: string) =>
		(id && people.get(id)) || fallback;
	const addedBy = named(
		f.added_by_id,
		f.added_by_kind === "agent" ? "an agent" : "a person",
	);
	const reviewer = named(f.reviewed_by_id, "a person");

	return (
		<Page>
			<RecordHeader
				crumbs={[f.statement]}
				chips={
					<>
						<StanceBadge stance={f.stance} />
						<Badge
							variant="soft"
							tone={f.reviewed_by_id ? "success" : "warning"}
							size="xs"
						>
							{f.reviewed_by_id ? "person-reviewed" : "not reviewed"}
						</Badge>
					</>
				}
				actions={
					f.reviewed_by_id || project.status === "archived" ? null : (
						<ActButton
							area="work"
							size="sm"
							disabled={review.isPending}
							onClick={() => review.mutate(f.number)}
						>
							<Check />
							Review
						</ActButton>
					)
				}
			/>
			<p className="px-4 pt-2 text-sm text-muted-foreground">
				{[
					`f${f.number}`,
					f.branch_number !== null
						? `added on ${branchLabel(project, f.branch_number)}`
						: null,
					`by ${addedBy}`,
					shortDate(f.created_at),
					f.reviewed_at
						? `reviewed by ${reviewer} · ${shortDate(f.reviewed_at)}`
						: null,
				]
					.filter(Boolean)
					.join(" · ")}
			</p>

			<div className="flex flex-col gap-3 p-3">
				<Box title="Evidence" count={f.cites.length}>
					{f.cites.length === 0 ? (
						<Muted>
							This {evidenceWord(project).toLowerCase()} cites nothing. A claim
							a reviewer can check names the records, datasets or runs behind
							it.
						</Muted>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Cite</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead>Origin</TableHead>
									<TableHead>Version</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{f.cites.map((c) => {
									const d =
										c.kind === "dataset" ? parseDatasetRef(c.ref) : null;
									const read = d
										? datasets.get(`${d.publisher}/${d.name}`)
										: undefined;
									const open =
										c.kind === "run"
											? () => onOpenRun?.(c.ref)
											: d
												? () => onOpenDataset?.(`${d.publisher}/${d.name}`)
												: undefined;
									const label =
										c.kind === "run"
											? `run ${c.ref.slice(0, 8)}`
											: read?.title || c.ref;
									return (
										<TableRow
											key={`${c.kind}:${c.ref}`}
											className={open ? "cursor-pointer" : undefined}
											onClick={open}
										>
											<TableCell className="max-w-0 truncate">
												{open ? (
													<Button
														variant="link"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															open();
														}}
													>
														{label}
													</Button>
												) : (
													label
												)}
											</TableCell>
											<TableCell>{c.kind}</TableCell>
											<TableCell>
												{read?.origin ?? (c.kind === "run" ? "derived" : "—")}
											</TableCell>
											<TableCell className="whitespace-nowrap">
												{d?.version ? `v${d.version}` : "—"}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</Box>
				<div className="grid min-w-0 grid-cols-2 gap-3">
					<Box title="Rules" count={checks.length}>
						{checks.length === 0 ? (
							<Muted>
								No decision has cited it yet, so no rule has checked it.
							</Muted>
						) : (
							<ul>
								{checks.map((c) => (
									<li key={`${c.decision}-${c.rule_id}`}>
										<RecordRow
											tone={c.passed ? "success" : "warning"}
											title={<span className="truncate">{c.statement}</span>}
											subtitle={`d${c.decision} · ${c.passed ? "satisfied" : (c.reason ?? "not satisfied")}`}
											status={c.passed ? "passed" : c.mode}
											statusTone={c.passed ? "success" : "warning"}
										/>
									</li>
								))}
							</ul>
						)}
					</Box>
					<Box title="Trail">
						<div className="p-3">
							<PropertyList labelWidth={92}>
								<PropertyRow label="added by">{addedBy}</PropertyRow>
								<PropertyRow label="reached by">
									{f.via === "fork"
										? "a fork"
										: f.via === "merge"
											? "a merge"
											: "added here"}
								</PropertyRow>
								<PropertyRow label="cited by">
									{citedBy.length
										? citedBy.map((d) => `d${d.number}`).join(", ")
										: "no decision yet"}
								</PropertyRow>
							</PropertyList>
							{citedBy[0] ? (
								<Button
									variant="outline"
									size="sm"
									className="mt-2"
									onClick={() => onTrace(citedBy[0].number)}
								>
									<GitBranch />
									Open in Lineage
								</Button>
							) : null}
						</div>
					</Box>
				</div>
			</div>
		</Page>
	);
}
