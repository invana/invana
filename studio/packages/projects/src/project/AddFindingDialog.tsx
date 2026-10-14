/**
 * **Add a finding** — evidence for or against a branch, with what it cites
 * (projects.md PJ-06; explorer.md EX-12, board `explorer.answer.to_project`).
 *
 * Two callers, one form. On a branch the project and branch are fixed and the
 * person writes the cites (`publisher/name@v` for a dataset version, a record
 * id, a run id). From an answer in the Explorer the person picks the project
 * and the branch, and the cites are the answer's own — its run — so the
 * finding keeps the evidence the answer stood on.
 *
 * A person's finding is reviewed by them as it is added; nothing here asks.
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	SegmentedControl,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { recordsApi } from "../api";
import { useProjectsQuery } from "../queries";
import { useBranchesQuery, useRecordMutations } from "../records/queries";
import { branchLabel, evidenceWord } from "../records/words";
import type { Cite, Project, Stance } from "../types";

const STANCES: { value: Stance; label: string }[] = [
	{ value: "supports", label: "Supports" },
	{ value: "contradicts", label: "Contradicts" },
	{ value: "context", label: "Context" },
];

const KINDS: Cite["kind"][] = ["dataset", "record", "run"];

export function AddFindingDialog({
	open,
	onClose,
	username,
	graphSlug,
	fixed,
	initial,
	from,
	evidence,
	onAdded,
}: {
	open: boolean;
	onClose: () => void;
	username: string;
	graphSlug: string;
	/** The project and branch, when the dialog is opened on one. */
	fixed?: { project: Project; branch: number };
	initial?: { statement?: string; cites?: Cite[] };
	/** The subtitle — what the finding is being made from. */
	from?: string;
	/** What the carried cites stand for, said under the form. */
	evidence?: string;
	onAdded?: (where: { projectKey: string; branch: number }) => void;
}) {
	const qc = useQueryClient();
	const projects = useProjectsQuery(username, graphSlug);
	const [projectKey, setProjectKey] = useState(fixed?.project.key ?? "");
	const [branch, setBranch] = useState<number | null>(fixed?.branch ?? null);
	const [statement, setStatement] = useState(initial?.statement ?? "");
	const [stance, setStance] = useState<Stance>("supports");
	const [cites, setCites] = useState<Cite[]>(initial?.cites ?? []);
	const [kind, setKind] = useState<Cite["kind"]>("dataset");
	const [ref, setRef] = useState("");
	const [error, setError] = useState<Error | null>(null);
	const [saving, setSaving] = useState(false);

	// Opening again starts from what the caller hands in, not the last draft.
	useEffect(() => {
		if (!open) return;
		setProjectKey(fixed?.project.key ?? "");
		setBranch(fixed?.branch ?? null);
		setStatement(initial?.statement ?? "");
		setCites(initial?.cites ?? []);
		setStance("supports");
		setError(null);
	}, [
		open,
		fixed?.project.key,
		fixed?.branch,
		initial?.statement,
		initial?.cites,
	]);

	const project =
		fixed?.project ??
		(projects.data?.items ?? []).find((p) => p.key === projectKey) ??
		null;
	const branches = useBranchesQuery(
		!fixed && project ? { username, graphSlug, key: project.key } : null,
	);
	const openBranches = (branches.data?.items ?? []).filter(
		(b) => b.status !== "dropped" && b.status !== "merged",
	);
	const word = project ? evidenceWord(project) : "Finding";
	const mutations = useRecordMutations({
		username,
		graphSlug,
		key: project?.key ?? "",
	});

	const add = () => {
		if (!project || branch === null || !statement.trim()) return;
		setSaving(true);
		setError(null);
		const data = { statement: statement.trim(), stance, cites };
		// Fixed: the branch page's own mutation, which re-reads the branch.
		const call = fixed
			? mutations.addFinding.mutateAsync({ n: branch, data })
			: recordsApi.addFinding(username, graphSlug, project.key, branch, data);
		call
			.then(() => {
				qc.invalidateQueries({ queryKey: ["projects", username, graphSlug] });
				onAdded?.({ projectKey: project.key, branch });
				onClose();
			})
			.catch((e: Error) => setError(e))
			.finally(() => setSaving(false));
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{fixed
							? `Add ${word.toLowerCase()} to ${branchLabel(fixed.project, fixed.branch)}`
							: "Add to a project"}
					</DialogTitle>
					<DialogDescription>{from ?? fixed?.project.name}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					{fixed ? null : (
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1.5">
								<Label>Project</Label>
								<Select
									value={projectKey}
									onValueChange={(v) => {
										setProjectKey(v);
										setBranch(null);
									}}
								>
									<SelectTrigger aria-label="Project">
										<SelectValue placeholder="A project on this Graph" />
									</SelectTrigger>
									<SelectContent>
										{(projects.data?.items ?? [])
											.filter((p) => p.status === "active")
											.map((p) => (
												<SelectItem key={p.id} value={p.key}>
													{p.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Branch</Label>
								<Select
									value={branch === null ? "" : String(branch)}
									disabled={!project}
									onValueChange={(v) => setBranch(Number(v))}
								>
									<SelectTrigger aria-label="Branch">
										<SelectValue placeholder="A line of inquiry" />
									</SelectTrigger>
									<SelectContent>
										{project
											? openBranches.map((b) => (
													<SelectItem key={b.id} value={String(b.number)}>
														{branchLabel(project, b.number)} · {b.title}
													</SelectItem>
												))
											: null}
									</SelectContent>
								</Select>
							</div>
						</div>
					)}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="finding-statement">{word}</Label>
						<Input
							id="finding-statement"
							value={statement}
							onChange={(e) => setStatement(e.target.value)}
							placeholder="One claim, in a sentence"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Stance</Label>
						<SegmentedControl
							options={STANCES}
							value={stance}
							onValueChange={(v) => setStance(v as Stance)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Cites</Label>
						{cites.length ? (
							<div className="flex flex-wrap gap-1.5">
								{cites.map((c, i) => (
									<Badge
										key={`${c.kind}:${c.ref}`}
										variant="outline"
										tone="muted"
										size="sm"
									>
										{c.kind} · {c.ref}
										<button
											type="button"
											aria-label={`Remove ${c.ref}`}
											onClick={() => setCites(cites.filter((_, j) => j !== i))}
										>
											<X className="size-3" />
										</button>
									</Badge>
								))}
							</div>
						) : null}
						<div className="flex gap-2">
							<Select
								value={kind}
								onValueChange={(v) => setKind(v as Cite["kind"])}
							>
								<SelectTrigger aria-label="Cite kind" className="w-32">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{KINDS.map((k) => (
										<SelectItem key={k} value={k}>
											{k}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								aria-label="Cite"
								value={ref}
								onChange={(e) => setRef(e.target.value)}
								placeholder={
									kind === "dataset"
										? "publisher/name@v3"
										: kind === "run"
											? "a run id"
											: "a record id"
								}
							/>
							<Button
								variant="outline"
								size="sm"
								disabled={!ref.trim()}
								onClick={() => {
									setCites([...cites, { kind, ref: ref.trim() }]);
									setRef("");
								}}
							>
								Add cite
							</Button>
						</div>
					</div>
					{evidence ? (
						<p className="text-sm text-muted-foreground">{evidence}</p>
					) : null}
					<FormError error={error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={
							!project || branch === null || !statement.trim() || saving
						}
						onClick={add}
					>
						{saving ? "Adding…" : `Add ${word.toLowerCase()}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
