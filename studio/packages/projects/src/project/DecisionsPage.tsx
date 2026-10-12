/**
 * **Decisions** — every decision across the Graph's projects, in one place to
 * audit (projects.md PJ-13, board `projects.decisions`).
 *
 * The page `mainSection` draws when the rail's Decisions is open. It has no
 * left column: the table is the whole surface. A row opens its project on the
 * branch it decided; *Export for audit* downloads the rows as CSV.
 *
 * **Who decided.** A decision carries only the id of the person who made it;
 * the name is read through `usePeople`.
 */

import { Badge, Button, RecordHeader } from "@invana/ui";
import { Download } from "lucide-react";
import { useProjectsQuery } from "../queries";
import { useGraphDecisionsQuery } from "../records/queries";
import { usePeople } from "../records/usePeople";
import type { Decision, Project } from "../types";
import { DecisionsTable, rulesCell } from "./DecisionsTable";
import { Page, ReadState } from "./parts";

export interface DecisionsPageProps {
	username: string;
	graphSlug: string;
	/** A decision's project, opened on the branch it decided. */
	onOpenProject?: (key: string, branch: number | null) => void;
}

const csvCell = (v: string | number | null) => {
	const s = v === null ? "" : String(v);
	return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** The rows as CSV, one decision per line, superseded ones included. */
function toCsv(
	decisions: Decision[],
	projects: Project[],
	people: Map<string, string>,
) {
	const byId = new Map(projects.map((p) => [p.id, p]));
	const head = [
		"project",
		"decision",
		"branch",
		"verdict",
		"choice",
		"into",
		"rationale",
		"cites",
		"supersedes",
		"superseded_by",
		"rules",
		"decided_by",
		"decided_at",
	];
	const rows = decisions.map((d) => [
		byId.get(d.project_id)?.key ?? d.project_key,
		`d${d.number}`,
		d.branch_number === null ? null : `b${d.branch_number}`,
		d.verdict,
		d.choice,
		d.into_number === null ? null : `b${d.into_number}`,
		d.rationale,
		d.cites.map((n) => `f${n}`).join(" "),
		d.supersedes_number === null ? null : `d${d.supersedes_number}`,
		d.superseded_by_number === null ? null : `d${d.superseded_by_number}`,
		rulesCell(d).text,
		(d.decided_by_id && people.get(d.decided_by_id)) ?? d.decided_by_id,
		d.created_at,
	]);
	return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

function download(name: string, body: string, type: string) {
	const url = URL.createObjectURL(new Blob([body], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

export function DecisionsPage({
	username,
	graphSlug,
	onOpenProject,
}: DecisionsPageProps) {
	const decisions = useGraphDecisionsQuery(username, graphSlug);
	const projectsQuery = useProjectsQuery(username, graphSlug);
	const projects = projectsQuery.data?.items ?? [];
	const people = usePeople(
		username,
		graphSlug,
		projects.map((p) => p.key),
	);
	const items = decisions.data?.items ?? [];
	const current = items.filter((d) => d.superseded_by_number === null).length;

	return (
		<Page>
			<RecordHeader
				crumbs={["Decisions"]}
				chips={
					<Badge variant="outline" tone="muted" size="xs">
						{current === items.length
							? items.length
							: `${current} current · ${items.length} recorded`}
					</Badge>
				}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={items.length === 0}
						onClick={() =>
							download(
								`${graphSlug}-decisions.csv`,
								toCsv(items, projects, people),
								"text/csv",
							)
						}
					>
						<Download />
						Export for audit
					</Button>
				}
			/>
			<p className="truncate px-4 pt-2 text-sm text-muted-foreground">
				Append-only: a later decision names the one it supersedes; nothing is
				edited.
			</p>
			<div className="p-3">
				{decisions.data ? (
					<DecisionsTable
						decisions={items}
						projects={projects}
						showProject
						people={people}
						onOpen={(d) => {
							const key =
								projects.find((p) => p.id === d.project_id)?.key ??
								d.project_key;
							if (key) onOpenProject?.(key, d.branch_number);
						}}
						empty="Nothing decided yet. A decision is made on a project's branch, once the evidence is in."
					/>
				) : (
					<ReadState loading={decisions.isLoading} error={decisions.error} />
				)}
			</div>
		</Page>
	);
}
