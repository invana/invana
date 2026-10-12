/**
 * **The tree of inquiry** — every branch of a project under the one it was
 * forked from (projects.md PJ-04, boards `projects.project.branches`).
 *
 * A row is a branch: its short name and title, struck through once dropped,
 * and the fact that explains its status — *decided Oct 8 · seed too small*,
 * *3 findings · decision open*. A merged branch names the branch it went
 * into. Indentation is the fork; the legend under the tree names the colours.
 *
 * `BranchCanvas` draws the same tree as a picture on the Branches tab: a fork
 * is an edge from parent to child, a merge a dashed edge into the branch it
 * went into, and a dropped branch is drawn hollow.
 */

import { cn, Legend, RunStatusText } from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { RecordRow } from "@invana-studio/ui";
import { type ReactNode, useMemo } from "react";
import {
	balance,
	branchLabel,
	dotTone,
	STATUS_TONE,
	shortDate,
} from "../records/words";
import type { Branch, BranchStatus, Decision, Project } from "../types";

const ORDER: BranchStatus[] = [
	"pursuing",
	"parked",
	"dropped",
	"open",
	"merged",
];

/** Branches in tree order, each with its depth. */
function treeOrder(branches: Branch[]): { branch: Branch; depth: number }[] {
	const byParent = new Map<number | null, Branch[]>();
	for (const b of branches) {
		const key = b.parent_number ?? null;
		byParent.set(key, [...(byParent.get(key) ?? []), b]);
	}
	const out: { branch: Branch; depth: number }[] = [];
	const walk = (parent: number | null, depth: number) => {
		for (const b of (byParent.get(parent) ?? []).sort(
			(x, y) => x.number - y.number,
		)) {
			out.push({ branch: b, depth });
			walk(b.number, depth + 1);
		}
	};
	walk(null, 0);
	return out;
}

function meta(
	project: Project,
	b: Branch,
	decision: Decision | undefined,
): string {
	if (decision && b.status !== "pursuing" && b.status !== "open") {
		const parts = [`decided ${shortDate(decision.created_at)}`];
		if (decision.rationale) parts.push(decision.rationale);
		if (b.status === "merged" && b.merged_into_number)
			parts.unshift(
				`merged into ${branchLabel(project, b.merged_into_number)}`,
			);
		return parts.join(" · ");
	}
	const parts = [b.parent_number === null ? "the question" : null, balance(b)];
	if (!decision) parts.push("decision open");
	return parts.filter(Boolean).join(" · ");
}

export function BranchTree({
	project,
	branches,
	decisions,
	selected,
	onOpen,
	actions,
}: {
	project: Project;
	branches: Branch[];
	/** The project's decisions, to say when a closed branch was decided. */
	decisions: Decision[];
	selected?: number | null;
	onOpen: (n: number) => void;
	/** Per-row acts — *Fork*, *Merge…* — revealed on hover. */
	actions?: (b: Branch) => ReactNode;
}) {
	const current = new Map(
		decisions
			.filter(
				(d) => d.superseded_by_number === null && d.branch_number !== null,
			)
			.map((d) => [d.branch_number as number, d]),
	);
	return (
		<div className="flex flex-col">
			<ul aria-label="Branches">
				{treeOrder(branches).map(({ branch: b, depth }) => (
					<li key={b.id}>
						<RecordRow
							indent={depth}
							active={selected === b.number}
							onClick={() => onOpen(b.number)}
							tone={dotTone(STATUS_TONE[b.status])}
							title={
								<span
									className={cn(
										"truncate",
										b.status === "dropped" &&
											"text-muted-foreground line-through",
									)}
								>
									{branchLabel(project, b.number)} · {b.title}
								</span>
							}
							subtitle={
								<span className="truncate">
									{meta(project, b, current.get(b.number))}
								</span>
							}
							status={b.status}
							statusTone={dotTone(STATUS_TONE[b.status])}
							actions={actions?.(b)}
						/>
					</li>
				))}
			</ul>
			<Legend className="border-t px-3 py-2">
				{ORDER.map((s) => (
					<RunStatusText
						key={s}
						role="listitem"
						dot
						status={s}
						tone={dotTone(STATUS_TONE[s])}
					/>
				))}
			</Legend>
		</div>
	);
}

/** The tree as a drawing — fork edges, dashed merge edges, dropped hollow. */
export function BranchCanvas({
	project,
	branches,
	decisions,
	onOpen,
}: {
	project: Project;
	branches: Branch[];
	decisions: Decision[];
	onOpen: (n: number) => void;
}) {
	const { nodes, edges } = useMemo(() => {
		const current = new Map(
			decisions
				.filter(
					(d) => d.superseded_by_number === null && d.branch_number !== null,
				)
				.map((d) => [d.branch_number as number, d]),
		);
		const nodes: LayeredNode[] = treeOrder(branches).map(
			({ branch: b, depth }) => ({
				id: String(b.number),
				label: `${branchLabel(project, b.number)} · ${b.title}`,
				sub: `${b.status} · ${meta(project, b, current.get(b.number))}`,
				column: depth,
				tone: dotTone(STATUS_TONE[b.status]),
				disabled: b.status === "dropped",
			}),
		);
		const edges: LayeredEdge[] = branches.flatMap((b) => [
			...(b.parent_number !== null
				? [
						{
							id: `fork-${b.number}`,
							source: String(b.parent_number),
							target: String(b.number),
						},
					]
				: []),
			...(b.merged_into_number !== null
				? [
						{
							id: `merge-${b.number}`,
							source: String(b.number),
							target: String(b.merged_into_number),
							label: "merged",
							dashed: true,
						},
					]
				: []),
		]);
		return { nodes, edges };
	}, [project, branches, decisions]);

	return (
		<LayeredCanvas
			kind="branches"
			nodes={nodes}
			edges={edges}
			onSelectNode={(id) => id && onOpen(Number(id))}
			emptyHint="This project has no branches yet."
		/>
	);
}
