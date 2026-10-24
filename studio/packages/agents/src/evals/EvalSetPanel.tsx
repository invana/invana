/**
 * The subject's eval set — the fixed questions a draft is replayed on before
 * it publishes (evals.md).
 *
 * A case is a question, whether a good answer passes or a bad one fails, and
 * the rule checks it is held to. *Propose from the instructions* drafts up to
 * five, each `proposed` until a person accepts it; only active cases are
 * replayed. Rule checks only here: a judged rubric is the set's own setting.
 */

import { Checkbox, Input, Label } from "@invana/forms";
import {
	Badge,
	Button,
	SegmentedControl,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEvalMutations, useEvalSetQuery } from "./queries";
import type { EvalCheck, EvalCheckKind, EvalSubjectKind } from "./types";

/** The checks a case can name without a value. */
const PLAIN_CHECKS: { kind: EvalCheckKind; label: string }[] = [
	{ kind: "cites_records", label: "cites records" },
	{ kind: "names_world", label: "names the world" },
	{ kind: "cannot_answer", label: "says it cannot answer" },
	{ kind: "guardrail_holds", label: "guardrail holds" },
];

const checkLabel = (c: EvalCheck) =>
	`${c.kind.replaceAll("_", " ")}${c.value != null && c.value !== "" ? ` ${c.value}` : ""}`;

export function EvalSetPanel({
	username,
	graphSlug,
	kind,
	subjectId,
}: {
	username: string;
	graphSlug: string;
	kind: EvalSubjectKind;
	subjectId: string;
}) {
	const set = useEvalSetQuery(username, graphSlug, kind, subjectId);
	const m = useEvalMutations(username, graphSlug, kind, subjectId);
	const [adding, setAdding] = useState(false);
	const [question, setQuestion] = useState("");
	const [label, setLabel] = useState<"passing" | "failing">("passing");
	const [checks, setChecks] = useState<EvalCheckKind[]>(["cites_records"]);
	const [maxTokens, setMaxTokens] = useState("");
	const cases = set.data?.cases ?? [];
	const active = cases.filter((c) => c.status === "active").length;

	const reset = () => {
		setAdding(false);
		setQuestion("");
		setLabel("passing");
		setChecks(["cites_records"]);
		setMaxTokens("");
	};

	const add = () => {
		const body: EvalCheck[] = checks.map((k) => ({ kind: k }));
		if (maxTokens.trim())
			body.push({ kind: "max_tokens", value: Number(maxTokens) });
		m.addCase.mutate(
			{ question: question.trim(), label, checks: body },
			{ onSuccess: reset },
		);
	};

	return (
		<PanelSection
			card
			title="Eval set"
			hint={`${active} active · replayed before every publish`}
			action={
				<span className="flex gap-1">
					<ActButton
						area="build"
						size="xs"
						variant="ghost"
						disabled={m.propose.isPending}
						onClick={() => m.propose.mutate()}
					>
						<Sparkles />{" "}
						{m.propose.isPending
							? "Proposing…"
							: "Propose from the instructions"}
					</ActButton>
					<ActButton
						area="build"
						size="xs"
						variant="outline"
						onClick={() => setAdding(true)}
					>
						<Plus /> Add a case
					</ActButton>
				</span>
			}
		>
			<FormError
				error={
					(m.propose.error ??
						m.deleteCase.error ??
						m.acceptCase.error) as Error | null
				}
			/>
			{adding ? (
				<div className="flex flex-col gap-2 border-b pb-2">
					<div className="flex flex-col gap-1">
						<Label htmlFor="eval-question">Question</Label>
						<Input
							id="eval-question"
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
							placeholder="Which routes out of LHR are growing?"
						/>
					</div>
					<SegmentedControl
						value={label}
						onValueChange={(v) => setLabel(v as "passing" | "failing")}
						options={[
							{ value: "passing", label: "A good answer passes" },
							{ value: "failing", label: "A bad answer fails" },
						]}
					/>
					<div className="flex flex-wrap items-center gap-3">
						{PLAIN_CHECKS.map((c) => (
							<Label key={c.kind} className="flex items-center gap-1.5">
								<Checkbox
									checked={checks.includes(c.kind)}
									onCheckedChange={(on) =>
										setChecks((cur) =>
											on ? [...cur, c.kind] : cur.filter((k) => k !== c.kind),
										)
									}
								/>
								{c.label}
							</Label>
						))}
						<Label className="flex items-center gap-1.5">
							under
							<Input
								aria-label="Token limit"
								inputMode="numeric"
								value={maxTokens}
								onChange={(e) =>
									setMaxTokens(e.target.value.replace(/\D/g, ""))
								}
								placeholder="tokens"
								className="w-24"
							/>
							tokens
						</Label>
					</div>
					<FormError error={m.addCase.error as Error | null} />
					<span className="flex gap-1">
						<Button
							size="xs"
							disabled={!question.trim() || m.addCase.isPending}
							onClick={add}
						>
							Add case
						</Button>
						<Button size="xs" variant="ghost" onClick={reset}>
							Cancel
						</Button>
					</span>
				</div>
			) : null}
			{set.isLoading ? (
				<Spinner />
			) : cases.length === 0 ? (
				<p className="text-muted-foreground">
					No cases yet — nothing is checked before publishing. Add one, or let
					the assistant propose a starter set from the instructions.
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead className="w-full">Question</TableHead>
							<TableHead>Expect</TableHead>
							<TableHead>Checks</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{cases.map((c) => (
							<TableRow key={c.id}>
								<TableCell>
									{c.question}{" "}
									{c.status !== "active" ? (
										<Badge size="xs" variant="soft" tone="warning">
											{c.status}
										</Badge>
									) : null}
								</TableCell>
								<TableCell className="whitespace-nowrap">{c.label}</TableCell>
								<TableCell className="whitespace-nowrap">
									<span className="flex flex-wrap gap-1">
										{c.checks.map((k) => (
											<Badge key={checkLabel(k)} size="xs" variant="outline">
												{checkLabel(k)}
											</Badge>
										))}
									</span>
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{c.status === "proposed" ? (
										<ActButton
											area="build"
											size="xs"
											variant="ghost"
											disabled={m.acceptCase.isPending}
											onClick={() => m.acceptCase.mutate(c.id)}
										>
											Accept
										</ActButton>
									) : null}
									<ActButton
										area="build"
										size="xs"
										variant="ghost"
										aria-label={`Delete ${c.question}`}
										disabled={m.deleteCase.isPending}
										onClick={() => m.deleteCase.mutate(c.id)}
									>
										<Trash2 />
									</ActButton>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}
