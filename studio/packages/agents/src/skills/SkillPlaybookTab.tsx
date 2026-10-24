/**
 * The skill's draft, being written — the edit mode of the Instructions tab
 * (board `agents.skills.instructions.edit`, AG-08).
 *
 * *As a builder, I want to write a skill's instructions and see the plan
 * generated from them, so that I never hand-draw a pipeline.*
 *
 * The draft is a row the engine keeps — the one mutable version there will
 * ever be — so it survives a reload. **Save draft · run evals** is one act in
 * three steps: the text is saved, the plan is generated from it (a draw), and
 * once the plan is drawn from these exact words the eval set is replayed on
 * the draft against live. The Why typed here is what *Publish* sends.
 *
 * ## What happens when the planner stops
 *
 * A sentence with two readings raises a question **against that sentence**,
 * and nothing is written until it is answered. The readings are the options —
 * each naming the step it would write — and never a free-text box, because
 * that is a second way to write the instructions in a box that is not them.
 *
 * ## Nobody draws the plan
 *
 * The generated steps are read-only. A plan that reads wrong is fixed in the
 * text or in the answer to a question, and generated again.
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@invana/forms";
import { Badge, Button, ClarifyCard, RefusalCard, Spinner } from "@invana/ui";
import { FormError, PanelSection } from "@invana-studio/ui";
import { Play, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEvalMutations, useEvalSetQuery } from "../evals/queries";
import { EVERY } from "../lists";
import { useLLMProvidersQuery } from "../llms/queries";
import {
	useAnswerClarificationMutation,
	useDiscardDraftMutation,
	useDrawDraftMutation,
	useSaveDraftMutation,
	useSkillDraftQuery,
} from "./queries";
import type { Skill, SkillClarification, SkillPlaybookRead } from "./types";

/** The draft's words, held here until saved onto the row. */
interface Fields {
	content: string;
	when_to_use: string;
	description: string;
}

const KEEP_PIN = "__keep__";

export function SkillDraftEditor({
	username,
	graphSlug,
	skill,
	why,
	onWhy,
	modelPin,
	onModelPin,
	onEvaluated,
	onClose,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	why: string;
	onWhy: (why: string) => void;
	/** The version to pin on publish; null keeps the current one. */
	modelPin: string | null;
	onModelPin: (pin: string | null) => void;
	/** The draft is drawn and replayed — `runId` null when the set has no active case. */
	onEvaluated: (runId: string | null) => void;
	onClose: () => void;
}) {
	const [drawing, setDrawing] = useState(false);
	// Save → draw → evals, carried across the polls between them.
	const [chain, setChain] = useState(false);
	const draft = useSkillDraftQuery(username, graphSlug, skill.id, {
		poll: drawing,
	});
	const save = useSaveDraftMutation(username, graphSlug, skill.id);
	const discard = useDiscardDraftMutation(username, graphSlug, skill.id);
	const draw = useDrawDraftMutation(username, graphSlug, skill.id);
	const answer = useAnswerClarificationMutation(username, graphSlug, skill.id);
	const evals = useEvalMutations(username, graphSlug, "skill", skill.id);
	const set = useEvalSetQuery(username, graphSlug, "skill", skill.id);
	const providers = useLLMProvidersQuery(username, graphSlug, EVERY);
	const [fields, setFields] = useState<Fields | null>(null);

	const version = draft.data?.version;
	// Taken once from the row, so a poll never overwrites what is being typed.
	if (version && fields === null)
		setFields({
			content: version.content,
			when_to_use: version.when_to_use,
			description: version.description,
		});

	const open = draft.data?.open_clarification ?? null;
	const inFlight = !!draft.data?.drawing_run_id;
	const refusal = draft.data?.refusal ?? null;
	const busy = drawing || inFlight || draw.isPending;
	const drawn = !!draft.data?.drawn;
	const dirty =
		!!version &&
		!!fields &&
		(fields.content !== version.content ||
			fields.when_to_use !== version.when_to_use ||
			fields.description !== version.description);
	const activeCases = (set.data?.cases ?? []).filter(
		(c) => c.status === "active",
	).length;

	// Whether a draw is in flight is the engine's answer, not the browser's: a
	// reload during a draw lands back in *Generating…*.
	useEffect(() => {
		if (inFlight && !drawing) {
			setDrawing(true);
			return;
		}
		if (drawing && !inFlight && !draw.isPending && !draft.isFetching)
			setDrawing(false);
	}, [drawing, inFlight, draw.isPending, draft.isFetching]);

	const startDraw = () => {
		setDrawing(true);
		draw.mutate(undefined, { onError: () => setDrawing(false) });
	};

	// The last step of the chain: drawn from these words, nothing asked, so
	// the eval set is replayed — or, with no active case, there is nothing to.
	useEffect(() => {
		if (!chain || busy || dirty || open || !draft.data) return;
		if (refusal && !drawn) {
			setChain(false);
			return;
		}
		if (!drawn) return;
		setChain(false);
		if (activeCases === 0) {
			onEvaluated(null);
			return;
		}
		evals.open.mutate(
			{ side: "both" },
			{ onSuccess: (r) => onEvaluated(r.run_id) },
		);
	}, [
		chain,
		busy,
		dirty,
		open,
		drawn,
		refusal,
		activeCases,
		draft.data,
		evals.open,
		onEvaluated,
	]);

	const saveAndEvaluate = () => {
		setChain(true);
		if (dirty && fields)
			save.mutate(fields, {
				onSuccess: startDraw,
				onError: () => setChain(false),
			});
		else if (!drawn) startDraw();
	};

	if (draft.isLoading || !version || !fields) return <Spinner />;
	const versions = [
		...new Set(
			(providers.data?.items ?? []).flatMap((p) =>
				p.models.map((x) => x.address),
			),
		),
	].sort();

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<div className="flex flex-wrap items-center gap-1">
				<Badge size="xs" variant="soft" tone="warning">
					draft · v{version.version} · nothing is offered a draft
				</Badge>
				<span className="ms-auto flex gap-1">
					<Button
						size="xs"
						variant="ghost"
						disabled={discard.isPending}
						onClick={() => discard.mutate(undefined, { onSuccess: onClose })}
					>
						<Trash2 /> Discard
					</Button>
					<Button size="xs" variant="ghost" onClick={onClose}>
						Keep writing later
					</Button>
					<Button
						size="xs"
						disabled={
							busy || chain || !!open || save.isPending || evals.open.isPending
						}
						onClick={saveAndEvaluate}
					>
						<Play />
						{chain || evals.open.isPending
							? "Running…"
							: "Save draft · run evals"}
					</Button>
				</span>
			</div>
			<FormError
				error={
					(save.error ?? evals.open.error ?? discard.error) as Error | null
				}
			/>

			<div className="grid items-start gap-2.5 @[760px]:grid-cols-[1.6fr_1fr]">
				<PanelSection
					card
					title="instructions.md"
					hint={dirty ? "editing · not saved" : "saved on the draft"}
				>
					<div className="flex flex-col gap-2">
						<Textarea
							aria-label="instructions.md"
							value={fields.content}
							rows={14}
							className="font-mono"
							onChange={(e) =>
								setFields({ ...fields, content: e.target.value })
							}
							placeholder={
								"# Answer in natural language\n\n## Steps\n1. Find the models the question names\n2. Write one query per model"
							}
						/>
						<div className="flex flex-col gap-1">
							<Label htmlFor="skill-when">When to use</Label>
							<Input
								id="skill-when"
								value={fields.when_to_use}
								onChange={(e) =>
									setFields({ ...fields, when_to_use: e.target.value })
								}
								placeholder="when someone asks a question of the graph in prose"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="skill-description">Description</Label>
							<Input
								id="skill-description"
								value={fields.description}
								onChange={(e) =>
									setFields({ ...fields, description: e.target.value })
								}
							/>
						</div>
					</div>
				</PanelSection>

				<div className="flex flex-col gap-2.5">
					<PanelSection card title="Why" hint="kept in History">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="skill-why">Reason for the change</Label>
							<Input
								id="skill-why"
								value={why}
								maxLength={500}
								onChange={(e) => onWhy(e.target.value)}
								placeholder="Readers ask which world an answer used"
							/>
							<p className="text-sm text-muted-foreground">
								A draft until published. Each bound agent picks up the new
								version on its next run after publish.
							</p>
						</div>
					</PanelSection>
					<PanelSection card title="Model version" hint="pinned on publish">
						<Select
							value={modelPin ?? KEEP_PIN}
							onValueChange={(v) => onModelPin(v === KEEP_PIN ? null : v)}
						>
							<SelectTrigger aria-label="Model version">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={KEEP_PIN}>keep the current pin</SelectItem>
								{versions.map((v) => (
									<SelectItem key={v} value={v}>
										{v}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</PanelSection>
				</div>
			</div>

			<PanelSection
				card
				title="The plan it generates"
				hint="generated from the text, published deliberately — read-only"
				action={
					<Button
						size="xs"
						variant="outline"
						disabled={busy || dirty}
						onClick={startDraw}
					>
						<Sparkles />{" "}
						{busy ? "Generating…" : drawn ? "Generate again" : "Generate"}
					</Button>
				}
			>
				{open ? (
					<Clarification
						clarification={open}
						pending={answer.isPending}
						onAnswer={(value) =>
							answer.mutate(
								{ clarificationId: open.id, answer: value },
								{ onSuccess: startDraw },
							)
						}
					/>
				) : (
					<>
						{refusal && !busy ? (
							<RefusalCard
								label="refused · the plan does not hold together"
								remedy="Rewrite the sentence it names and generate again — the plan you had is untouched."
							>
								<ul>
									{refusal.reasons.map((r) => (
										<li key={r}>{r}</li>
									))}
								</ul>
							</RefusalCard>
						) : null}
						<GeneratedSteps plan={draft.data?.plan} generating={busy} />
						{!drawn && !busy ? (
							<p className="text-sm text-warning">
								The plan was generated from an earlier text — it is generated
								again before the evals run.
							</p>
						) : null}
					</>
				)}
			</PanelSection>
		</div>
	);
}

/** The question, against the sentence that raised it. */
function Clarification({
	clarification,
	pending,
	onAnswer,
}: {
	clarification: SkillClarification;
	pending: boolean;
	onAnswer: (answer: string) => void;
}) {
	return (
		<ClarifyCard
			step={`“${clarification.span}”`}
			question={clarification.question}
			options={[
				...clarification.options.map((o) => ({
					value: o.step_key,
					label: o.step_key,
					detail: o.why || o.label,
					disabled: pending,
				})),
				{
					value: "none",
					label: "None of these",
					detail: "a person does this step",
					disabled: pending,
				},
			]}
			onSelect={onAnswer}
			footnote="It asks rather than guesses: a guessed step is a question moved into a plan you would have to decode."
		/>
	);
}

/** The steps the last generation wrote — or what is about to replace them. */
export function GeneratedSteps({
	plan,
	generating,
}: {
	plan: SkillPlaybookRead | undefined;
	generating?: boolean;
}) {
	if (generating)
		return (
			<p className="text-muted-foreground">
				Reading the instructions… the previous plan stays until this one lands.
			</p>
		);
	if (!plan || plan.nodes.length === 0)
		return <p className="text-muted-foreground">Not generated yet.</p>;
	return (
		<div className="flex flex-col gap-0.5">
			{plan.nodes.map((node) => (
				<div key={node.id} className="flex items-baseline gap-2">
					<span className="w-44 shrink-0 truncate font-mono">
						{node.task || "a person"}
					</span>
					<span className="min-w-0 flex-1 truncate text-muted-foreground">
						{node.source_span ?? "—"}
					</span>
				</div>
			))}
			<p className="pt-1 text-sm text-muted-foreground">
				{plan.nodes.length} step{plan.nodes.length === 1 ? "" : "s"} ·{" "}
				{plan.layers.join(" · ")}
			</p>
		</div>
	);
}
