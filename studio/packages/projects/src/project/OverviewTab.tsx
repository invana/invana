/**
 * **Overview** — where the quest stands (projects.md PJ-03, board
 * `projects.project`).
 *
 * Five tiles answer the questions a person arrives with — how many lines of
 * inquiry and how they stand, how much evidence and how much of it a person
 * reviewed, which datasets it rests on, what work is open, and which decision
 * is waiting. Under them, the tree and the datasets side by side.
 */

import {
	MetricGrid,
	MetricTile,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useTodosQuery } from "../queries";
import { useLineageDatasets } from "../records/queries";
import type { useProjectRecords } from "../records/useProjectRecords";
import { branchLabel, plural } from "../records/words";
import type { Project } from "../types";
import { BranchTree } from "./BranchTree";
import { Box, Muted } from "./parts";

export function OverviewTab({
	username,
	graphSlug,
	project,
	records,
	onOpenBranch,
	onOpenDataset,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	records: ReturnType<typeof useProjectRecords>;
	onOpenBranch: (n: number) => void;
	onOpenDataset?: (address: string) => void;
}) {
	const { branches, findings, decisions, datasets } = records;
	const todos = useTodosQuery(username, graphSlug, { project: project.key });
	const open = (todos.data?.items ?? []).filter(
		(t) => !["done", "cancelled", "failed"].includes(t.status),
	);
	const datasetReads = useLineageDatasets(datasets.map((d) => d.address));
	const by = (s: string) => branches.filter((b) => b.status === s).length;
	const waiting = branches.find(
		(b) =>
			b.current_decision === null &&
			(b.status === "pursuing" ||
				(b.status === "open" && b.parent_number !== null)),
	);
	const reviewed = findings.filter((f) => f.reviewed_by_id).length;

	return (
		<div className="flex flex-col gap-3 p-3">
			<MetricGrid columns={5}>
				<MetricTile
					label="Branches"
					value={branches.length}
					caption={
						[
							by("pursuing") && `${by("pursuing")} pursuing`,
							by("parked") && `${by("parked")} parked`,
							by("dropped") && `${by("dropped")} dropped`,
						]
							.filter(Boolean)
							.join(" · ") || "none decided yet"
					}
				/>
				<MetricTile
					label="Findings"
					value={findings.length}
					caption={`${reviewed} person-reviewed`}
					captionTone={reviewed === findings.length ? "success" : "warning"}
				/>
				<MetricTile
					label="Datasets"
					value={datasets.length}
					caption="cited by its findings"
				/>
				<MetricTile
					label="Todos"
					value={`${open.length} open`}
					caption={`${open.filter((t) => t.assignee_kind === "agent").length} for agents`}
				/>
				<MetricTile
					label="Decision open"
					value={waiting ? branchLabel(project, waiting.number) : "none"}
					caption={waiting ? waiting.title : `${decisions.length} decided`}
					tone={waiting ? "warning" : undefined}
				/>
			</MetricGrid>

			<div className="grid min-w-0 grid-cols-[3fr_2fr] gap-3">
				<Box title="Branches" count={branches.length}>
					<BranchTree
						project={project}
						branches={branches}
						decisions={decisions}
						onOpen={onOpenBranch}
					/>
				</Box>
				<Box title="Datasets" count={datasets.length}>
					{datasets.length === 0 ? (
						<Muted>
							No dataset cited yet. A finding that cites a dataset version
							brings it here.
						</Muted>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Dataset</TableHead>
									<TableHead>Origin</TableHead>
									<TableHead>Version</TableHead>
									<TableHead>Cited by</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{datasets.map((d) => {
									const read = datasetReads.get(d.address);
									return (
										<TableRow
											key={d.address}
											className={onOpenDataset ? "cursor-pointer" : undefined}
											onClick={() => onOpenDataset?.(d.address)}
										>
											<TableCell className="max-w-0 truncate">
												{read?.title || d.address}
											</TableCell>
											<TableCell>{read?.origin ?? "—"}</TableCell>
											<TableCell className="whitespace-nowrap">
												{[...d.versions].map((v) => `v${v}`).join(", ") || "—"}
											</TableCell>
											<TableCell className="whitespace-nowrap">
												{plural(d.findings.length, "finding")}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</Box>
			</div>
		</div>
	);
}
