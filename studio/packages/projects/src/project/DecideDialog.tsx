/**
 * **Decide on a branch** — a verdict on its hypothesis and a decision about the
 * line, with a rationale, checked by every rule in force (projects.md PJ-07,
 * board `projects.branch.decide`); and **merge**, which is a decision too
 * (PJ-08, board `projects.branch.merge`).
 *
 * What the engine requires is filled in rather than asked for: the verdict
 * addresses every contradicting finding, and a branch already decided names
 * the decision this one supersedes. What the person chooses is the verdict,
 * the decision, the rationale, the findings cited — and for a merge, the
 * branch it goes into and the findings it carries.
 *
 * **A refusal is drawn as the engine words it.** A rule that blocks names the
 * findings that broke it; the dialog offers to take them out of the cites and
 * try again, and keeps everything else as it was.
 */

import {
	Checkbox,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
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
	RefusalCard,
	SegmentedControl,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useEffect, useMemo, useState } from "react";
import { useBranchQuery, useRecordMutations } from "../records/queries";
import type { useProjectRecords } from "../records/useProjectRecords";
import {
	branchLabel,
	choiceOptions,
	plural,
	verdictOptions,
} from "../records/words";
import type { Choice, Project, Verdict } from "../types";

/** The finding numbers a rule refusal names — `f3, f5 not reviewed…`. */
function namedFindings(message: string): number[] {
	return [...message.matchAll(/\bf(\d+)\b/g)].map((m) => Number(m[1]));
}

export function DecideDialog({
	project,
	refKey,
	records,
	branch,
	merge,
	onClose,
}: {
	project: Project;
	refKey: { username: string; graphSlug: string; key: string };
	records: ReturnType<typeof useProjectRecords>;
	/** The branch being decided; null keeps the dialog shut. */
	branch: number | null;
	/** Open on *Merge into…*. */
	merge: boolean;
	onClose: () => void;
}) {
	const detail = useBranchQuery(refKey, branch);
	const { decide } = useRecordMutations(refKey);
	const resetDecide = decide.reset;
	const findings = detail.data?.findings ?? [];
	const current = detail.data?.decisions.find(
		(d) => d.number === detail.data?.branch.current_decision,
	);
	const contradicts = findings.filter((f) => f.stance === "contradicts");

	const [verdict, setVerdict] = useState<Verdict>("supported");
	const [choice, setChoice] = useState<Choice>("pursue");
	const [rationale, setRationale] = useState("");
	const [cites, setCites] = useState<Set<number>>(new Set());
	const [into, setInto] = useState<number | null>(null);
	const [carry, setCarry] = useState<Set<number>>(new Set());

	// Open on a fresh form whose cites and carry are every finding on the branch.
	const ids = useMemo(
		() => findings.map((f) => f.number).join(","),
		[findings],
	);
	useEffect(() => {
		if (branch === null) return;
		setVerdict(merge ? "inconclusive" : "supported");
		setChoice(merge ? "merge" : "pursue");
		setRationale("");
		setInto(null);
		const all = new Set(ids ? ids.split(",").map(Number) : []);
		setCites(all);
		setCarry(all);
		resetDecide();
	}, [branch, merge, ids, resetDecide]);

	const targets = records.branches.filter(
		(b) =>
			b.number !== branch && b.status !== "dropped" && b.status !== "merged",
	);
	const error = decide.error as Error | null;
	const blocked = !!error && /blocked by rule/.test(error.message);
	const broken = blocked ? namedFindings(error.message) : [];
	const label = branch !== null ? branchLabel(project, branch) : "";
	const isMerge = choice === "merge";
	// A merge cites what it carries: the findings that move are its evidence.
	const cited = isMerge ? carry : cites;

	const submit = () => {
		if (branch === null || !rationale.trim()) return;
		decide.mutate(
			{
				n: branch,
				data: {
					verdict,
					choice,
					rationale: rationale.trim(),
					cites: [...cited],
					addresses: contradicts.map((f) => f.number),
					supersedes: current?.number ?? null,
					into: isMerge ? into : null,
					carry: isMerge ? [...carry] : null,
				},
			},
			{ onSuccess: onClose },
		);
	};

	return (
		<Dialog open={branch !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{isMerge
							? `Merge ${label}${into ? ` into ${branchLabel(project, into)}` : ""}`
							: `Decide on ${label}`}
					</DialogTitle>
					<DialogDescription>
						{isMerge
							? "carry what it learned into the line you pursue"
							: detail.data?.branch.title}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<Label>
							Verdict on the {(project.words?.branch ?? "branch").toLowerCase()}
						</Label>
						<SegmentedControl
							options={verdictOptions(project)}
							value={verdict}
							onValueChange={(v) => setVerdict(v as Verdict)}
						/>
						{contradicts.length ? (
							<p className="text-sm text-muted-foreground">
								Addresses the{" "}
								{plural(contradicts.length, "contradicting finding")}:{" "}
								{contradicts.map((f) => `f${f.number}`).join(", ")}.
							</p>
						) : null}
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Decision</Label>
						<SegmentedControl
							options={choiceOptions(project)}
							value={choice}
							onValueChange={(v) => setChoice(v as Choice)}
						/>
					</div>
					{isMerge ? (
						<>
							<div className="flex flex-col gap-1.5">
								<Label>Into</Label>
								<Select
									value={into === null ? "" : String(into)}
									onValueChange={(v) => setInto(Number(v))}
								>
									<SelectTrigger aria-label="Merge into">
										<SelectValue placeholder="The branch it carries into" />
									</SelectTrigger>
									<SelectContent>
										{targets.map((b) => (
											<SelectItem key={b.id} value={String(b.number)}>
												{branchLabel(project, b.number)} · {b.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<FindingChecks
								label="What moves"
								findings={findings}
								value={carry}
								onChange={setCarry}
							/>
							<p className="text-sm text-muted-foreground">
								What moves is also what this decision cites. A merge copies
								references, never data; {label} keeps its history and this
								decision, and is marked merged.
							</p>
						</>
					) : null}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="decision-rationale">Rationale</Label>
						<Textarea
							id="decision-rationale"
							rows={4}
							value={rationale}
							onChange={(e) => setRationale(e.target.value)}
							placeholder="Why — in words a reviewer can follow back to the evidence"
						/>
					</div>
					{isMerge ? null : (
						<FindingChecks
							label="Cites"
							findings={findings}
							value={cites}
							onChange={setCites}
						/>
					)}
					{current ? (
						<p className="text-sm text-muted-foreground">
							Supersedes d{current.number} (
							{current.choice_label ?? current.choice}). Cite at least one
							finding added after it; nothing edits d{current.number}.
						</p>
					) : null}
					{blocked ? (
						<RefusalCard
							label="Blocked by a rule"
							remedy={
								broken.length ? (
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											const keep = new Set(
												[...cited].filter((n) => !broken.includes(n)),
											);
											if (isMerge) setCarry(keep);
											else setCites(keep);
											decide.reset();
										}}
									>
										Remove {broken.map((n) => `f${n}`).join(", ")} from the
										cites
									</Button>
								) : null
							}
						>
							{error?.message.replace(/^blocked by rule — /, "")}
						</RefusalCard>
					) : (
						<FormError error={error} />
					)}
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={
							!rationale.trim() ||
							decide.isPending ||
							(isMerge && into === null)
						}
						onClick={submit}
					>
						{isMerge
							? `Merge ${plural(carry.size, "item")}`
							: "Record decision"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function FindingChecks({
	label,
	findings,
	value,
	onChange,
}: {
	label: string;
	findings: {
		number: number;
		statement: string;
		stance: string;
		reviewed_by_id: string | null;
	}[];
	value: Set<number>;
	onChange: (next: Set<number>) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>
			{findings.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No findings on this branch.
				</p>
			) : (
				<ul className="flex flex-col gap-1">
					{findings.map((f) => (
						<li key={f.number} className="flex items-center gap-2">
							<Checkbox
								id={`${label}-f${f.number}`}
								checked={value.has(f.number)}
								onCheckedChange={(on) => {
									const next = new Set(value);
									if (on) next.add(f.number);
									else next.delete(f.number);
									onChange(next);
								}}
							/>
							<Label
								htmlFor={`${label}-f${f.number}`}
								className="min-w-0 flex-1 truncate font-normal"
							>
								f{f.number} · {f.statement}
							</Label>
							<Badge
								variant="outline"
								tone={f.reviewed_by_id ? "success" : "warning"}
								size="xs"
							>
								{f.reviewed_by_id ? "reviewed" : "not reviewed"}
							</Badge>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
