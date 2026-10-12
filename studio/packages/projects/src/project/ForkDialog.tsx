/**
 * **Fork a branch** — one line of inquiry into several (projects.md PJ-04,
 * board `projects.branch.fork`).
 *
 * The person names the new branches; what carries over is not a choice but a
 * rule, so it is said rather than offered: the children inherit the parent's
 * findings, its open todos stay where they are, and the parent stays as it is.
 */

import { Input, Label } from "@invana/forms";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRecordMutations } from "../records/queries";
import type { useProjectRecords } from "../records/useProjectRecords";
import { branchLabel, plural } from "../records/words";
import type { Project } from "../types";

export function ForkDialog({
	project,
	refKey,
	records,
	branch,
	onClose,
}: {
	project: Project;
	refKey: { username: string; graphSlug: string; key: string };
	records: ReturnType<typeof useProjectRecords>;
	/** The branch to fork; null keeps the dialog shut. */
	branch: number | null;
	onClose: () => void;
}) {
	const [titles, setTitles] = useState(["", ""]);
	const { fork } = useRecordMutations(refKey);
	const resetFork = fork.reset;
	useEffect(() => {
		if (branch !== null) {
			setTitles(["", ""]);
			resetFork();
		}
	}, [branch, resetFork]);

	const parent = records.branches.find((b) => b.number === branch);
	const inherited =
		records.details.find((d) => d.branch.number === branch)?.findings.length ??
		0;
	const named = titles.map((t) => t.trim()).filter(Boolean);
	const next = Math.max(0, ...records.branches.map((b) => b.number)) + 1;

	return (
		<Dialog open={branch !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						Fork {branch !== null ? branchLabel(project, branch) : ""}
					</DialogTitle>
					<DialogDescription>{parent?.title}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<Label>New branches</Label>
					{titles.map((t, i) => (
						<div
							key={`fork-${i.toString()}`}
							className="flex items-center gap-2"
						>
							<Badge variant="outline" tone="muted" size="sm">
								{branchLabel(project, next + i)}
							</Badge>
							<Input
								aria-label={`New branch ${i + 1}`}
								value={t}
								onChange={(e) =>
									setTitles(
										titles.map((x, j) => (j === i ? e.target.value : x)),
									)
								}
								placeholder="What this line of inquiry tries"
							/>
							{titles.length > 1 ? (
								<Button
									variant="ghost"
									size="sm"
									aria-label={`Remove branch ${i + 1}`}
									onClick={() => setTitles(titles.filter((_, j) => j !== i))}
								>
									<X />
								</Button>
							) : null}
						</div>
					))}
					<div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setTitles([...titles, ""])}
						>
							<Plus />
							Add a branch
						</Button>
					</div>
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="text-sm text-muted-foreground">Carry over</span>
						<Badge variant="soft" tone="success" size="sm">
							{plural(inherited, "finding")}
						</Badge>
						<Badge variant="outline" tone="muted" size="sm">
							open todos stay on{" "}
							{branch !== null ? branchLabel(project, branch) : "the parent"}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground">
						{branch !== null ? branchLabel(project, branch) : "The parent"}{" "}
						stays as the parent; every child inherits its evidence and can be
						merged back.
					</p>
					<FormError error={fork.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={named.length === 0 || fork.isPending || branch === null}
						onClick={() =>
							branch !== null &&
							fork.mutate({ n: branch, titles: named }, { onSuccess: onClose })
						}
					>
						Fork into {named.length || titles.length}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
