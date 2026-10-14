/**
 * The decisions table — one project's, or every project's on the Graph
 * (projects.md PJ-13, board `projects.decisions`).
 *
 * A row is a decision as it was recorded: what was chosen on which branch,
 * the rationale, the decision it supersedes, what it cited and the rules it
 * passed. A superseded decision stays, muted and struck: decisions are
 * append-only, and the row that replaced it names it.
 */

import {
	Badge,
	cn,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { branchLabel, choiceLabel, plural, shortDate } from "../records/words";
import type { Decision, Project } from "../types";
import { Muted } from "./parts";

/** `✓ passed` · `1 warned` — the rules a decision was checked against. */
export function rulesCell(d: Decision): {
	text: string;
	tone: "success" | "warning" | "muted";
} {
	if (d.warnings.length)
		return { text: plural(d.warnings.length, "warning"), tone: "warning" };
	if (d.checks.length)
		return {
			text: `✓ ${plural(d.checks.length, "rule")} passed`,
			tone: "success",
		};
	return { text: "no rule applied", tone: "muted" };
}

export function DecisionsTable({
	decisions,
	projects,
	showProject,
	people,
	onOpen,
	onTrace,
	empty,
}: {
	decisions: Decision[];
	/** The projects the rows belong to, for their words and names. */
	projects: Project[];
	showProject?: boolean;
	/** A user id → the name to show in *By*. */
	people?: Map<string, string>;
	onOpen?: (d: Decision) => void;
	onTrace?: (d: Decision) => void;
	empty: string;
}) {
	if (decisions.length === 0) return <Muted>{empty}</Muted>;
	const byId = new Map(projects.map((p) => [p.id, p]));
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[40%]">Decision</TableHead>
						{showProject ? <TableHead>Project</TableHead> : null}
						<TableHead>By</TableHead>
						<TableHead>When</TableHead>
						<TableHead>Cites</TableHead>
						<TableHead>Rules</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{decisions.map((d) => {
						const project = byId.get(d.project_id);
						const on =
							project && d.branch_number !== null
								? branchLabel(project, d.branch_number)
								: d.branch_number !== null
									? `b${d.branch_number}`
									: "";
						const what = project
							? choiceLabel(project, d.choice)
							: (d.choice_label ?? d.choice);
						const rules = rulesCell(d);
						const superseded = d.superseded_by_number !== null;
						return (
							<TableRow
								key={d.id}
								className={onOpen ? "cursor-pointer" : undefined}
								onClick={() => onOpen?.(d)}
							>
								<TableCell className="max-w-0">
									<span
										className={cn(
											"block truncate",
											superseded && "text-muted-foreground line-through",
										)}
									>
										<span className="font-medium">
											{what.charAt(0).toUpperCase() + what.slice(1)} {on}
											{d.into_number !== null && project
												? ` into ${branchLabel(project, d.into_number)}`
												: ""}
										</span>
										{d.rationale ? ` · ${d.rationale}` : ""}
									</span>
									{d.supersedes_number !== null ? (
										<span className="block truncate text-sm text-muted-foreground">
											supersedes d{d.supersedes_number}
										</span>
									) : null}
								</TableCell>
								{showProject ? (
									<TableCell className="max-w-0 truncate">
										{project?.name ?? d.project_key}
									</TableCell>
								) : null}
								<TableCell className="whitespace-nowrap">
									{(d.decided_by_id && people?.get(d.decided_by_id)) ??
										"a person"}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{shortDate(d.created_at)}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{plural(d.cites.length, "finding")}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									<Badge variant="soft" tone={rules.tone} size="xs">
										{rules.text}
									</Badge>
									{onTrace ? (
										<button
											type="button"
											className="ml-2 text-sm text-muted-foreground hover:underline"
											onClick={(e) => {
												e.stopPropagation();
												onTrace(d);
											}}
										>
											Lineage
										</button>
									) : null}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
