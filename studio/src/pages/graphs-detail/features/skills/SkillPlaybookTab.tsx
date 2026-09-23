/**
 * The **Playbook** tab — the prose, and the step each sentence produced.
 *
 * Two states, one surface. A published skill reads as its sentences with the
 * step each drew beside it, and a sentence that produced none is marked
 * **unmapped** — the diagnosis, without the author hunting for it (C11). Edit
 * it and the same lines become a **draft**: the one mutable version row there
 * will ever be (SK20), with its own plan being drawn beside it.
 *
 * ## What happens when the planner stops
 *
 * A sentence with two readings raises a question **against that sentence**, and
 * nothing is written until it is answered (C10 · SK26). The readings are the
 * options — each naming the step it would write — and never a free-text box,
 * because that is a second way to write the playbook in a box that is not the
 * playbook.
 *
 * ## And when the prose cannot fix it
 *
 * **Edit by hand** opens the rows themselves (SK7). After that the plan is
 * `authored`, so drawing again stops being a button and becomes an offer that
 * names what it would discard — because editing the prose must never silently
 * throw away a correction somebody made deliberately.
 */

import {
	useAnswerClarificationMutation,
	useDiscardDraftMutation,
	useDrawDraftMutation,
	useInlinablePlansQuery,
	usePublishSkillVersionMutation,
	useSaveDraftMutation,
	useSkillDraftQuery,
	useWriteDraftTasksMutation,
} from "@/hooks/queries/useSkills";
import { SkillPlanEditor } from "@/pages/graphs-detail/features/skills/SkillPlanEditor";
import type {
	Skill,
	SkillClarification,
	SkillDrawRefusal,
	SkillPlanNode,
	SkillPlanRead,
} from "@/types/skills";
import { PanelSection } from "@/ui/PanelSection";
import { Input, Label, Textarea } from "@invana/forms";
import { Badge, Button, Spinner } from "@invana/ui";
import { PencilLine, Sparkles, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

/** One line of the playbook, and what it drew. */
function sentences(content: string): string[] {
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

/** The node whose span carries this sentence. A span may hold two sentences —
 *  *ask which* qualifies *turn it into a query* rather than adding a step. */
function stepFor(
	sentence: string,
	nodes: SkillPlanNode[],
): SkillPlanNode | undefined {
	return nodes.find((n) => (n.source_span ?? "").includes(sentence));
}

export function SkillPlaybookTab({
	username,
	graphSlug,
	skill,
	plan,
	editing,
	onEditing,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	plan: SkillPlanRead | undefined;
	editing: boolean;
	onEditing: (editing: boolean) => void;
}) {
	// The draft exists as a row the moment it is opened, so this is a read of
	// something durable rather than form state (SK20).
	const [drawing, setDrawing] = useState(false);
	const draft = useSkillDraftQuery(username, graphSlug, skill.id, {
		enabled: editing,
		poll: drawing,
	});
	const save = useSaveDraftMutation(username, graphSlug, skill.id);
	// Publishing is its own route: `POST …/versions` stamps the open draft and
	// moves the head. `PATCH …/draft` only writes the prose — a *Publish vN*
	// wired to it saved the text and left the skill a draft for ever, which is
	// the one act this drawer exists to complete (SK20).
	const publish = usePublishSkillVersionMutation(username, graphSlug);
	const discard = useDiscardDraftMutation(username, graphSlug, skill.id);
	const draw = useDrawDraftMutation(username, graphSlug, skill.id);
	const answer = useAnswerClarificationMutation(username, graphSlug, skill.id);
	const writeTasks = useWriteDraftTasksMutation(username, graphSlug, skill.id);
	// The Graph's library, read only while the rows are open: a plan a skill may
	// inline instead of redrawing its steps (SK32).
	const inlinable = useInlinablePlansQuery(username, graphSlug, editing);
	const [editingPlan, setEditingPlan] = useState(false);
	// A redraw over an authored plan is offered, never automatic (SK7).
	const [confirmRedraw, setConfirmRedraw] = useState(false);

	const open = draft.data?.open_clarification ?? null;
	const drawn = draft.data?.plan;
	// Only a hand-edit flips `origin` (SK29), so this is the one fact that
	// claims somebody's rows are at stake — the plan a draft is born with is
	// `generated`, and nobody wrote it.
	const handEdited = drawn?.origin === "authored";
	// A node carries a `source_span` only because a draw wrote it, so this is
	// *has this ever been drawn* — which is what turns the action into Redraw.
	const everDrawn = (drawn?.nodes ?? []).some((n) => !!n.source_span);

	// Whether a draw is in flight is the engine's answer, not the browser's: a
	// reload during a draw lands back in **Drawing…** rather than on a button
	// that invites a second one.
	const inFlight = !!draft.data?.drawing_run_id;
	const refusal = draft.data?.refusal ?? null;
	const busy = drawing || inFlight || draw.isPending;

	useEffect(() => {
		// A draw already running — this tab was reopened, or reloaded, while it
		// went on. Pick it up rather than offering to start a second one.
		if (inFlight && !drawing) {
			setDrawing(true);
			return;
		}
		// And it is over only when nothing can still be carrying it: no run, no
		// request out, no read in the air. A draw that settles between two polls
		// is then as finished as one we watched.
		if (drawing && !inFlight && !draw.isPending && !draft.isFetching) {
			setDrawing(false);
		}
	}, [drawing, inFlight, draw.isPending, draft.isFetching]);

	// Answering continues the drawing (SK30): the run that asked has settled,
	// so the next draw is opened here. A hand-edited plan is the exception —
	// there a draw discards rows somebody wrote, so it stays an offer (SK7).
	const startDraw = () => {
		setConfirmRedraw(false);
		setDrawing(true);
		draw.mutate(undefined, { onError: () => setDrawing(false) });
	};

	if (!editing) {
		return (
			<Published skill={skill} plan={plan} onEdit={() => onEditing(true)} />
		);
	}

	if (draft.isLoading || !draft.data) return <Spinner />;
	const version = draft.data.version;

	return (
		<div className="pb-3">
			<div className="flex items-center gap-1.5 border-b bg-warning/10 px-3 py-1.5">
				<Badge variant="outline">draft · v{version.version}</Badge>
				<span className="truncate text-base text-muted-foreground">
					nothing is offered a draft
				</span>
			</div>

			<DraftFields
				description={version.description}
				content={version.content}
				whenToUse={version.when_to_use}
				saving={save.isPending}
				onSave={(fields) => save.mutate(fields)}
			/>

			<PanelSection
				title="The flow it draws"
				hint="drafted automatically, published deliberately — editing prose never silently changes what runs"
				action={
					editingPlan ? null : (
						<span className="flex items-center gap-1">
							<Button
								size="sm"
								variant="ghost"
								className="h-6 text-base"
								disabled={!!open || busy}
								onClick={() => {
									setConfirmRedraw(false);
									setEditingPlan(true);
								}}
							>
								<SquarePen className="size-3" />
								Edit by hand
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="h-6 text-base"
								disabled={busy}
								onClick={() => {
									// An authored plan is somebody's correction, so drawing over
									// it asks first and says what it would throw away (SK7).
									if (handEdited && !confirmRedraw) {
										setConfirmRedraw(true);
										return;
									}
									startDraw();
								}}
							>
								<Sparkles className="size-3" />
								{busy
									? "Drawing…"
									: confirmRedraw
										? "Discard and redraw"
										: everDrawn || handEdited
											? "Redraw"
											: "Draw this"}
							</Button>
						</span>
					)
				}
			>
				{confirmRedraw && !editingPlan ? (
					<p className="mb-1.5 rounded-sm border border-warning/40 bg-warning/5 px-2 py-1.5 text-base">
						Drawing again replaces the {drawn?.nodes.length} step
						{drawn?.nodes.length === 1 ? "" : "s"} you edited by hand with what
						the prose reads as.{" "}
						<button
							type="button"
							className="underline"
							onClick={() => setConfirmRedraw(false)}
						>
							Keep what I wrote
						</button>
					</p>
				) : null}

				{open ? (
					<ClarificationCard
						clarification={open}
						pending={answer.isPending}
						onAnswer={(value) =>
							answer.mutate(
								{ clarificationId: open.id, answer: value },
								{
									// The answer was given to get the flow drawn, so the next
									// draw opens on it (SK30) — unless it would discard a
									// hand-edit, which stays an offer (SK7).
									onSuccess: (next) => {
										if (next.plan.origin !== "authored") startDraw();
									},
								},
							)
						}
					/>
				) : editingPlan && drawn ? (
					<SkillPlanEditor
						plan={drawn}
						vocabulary={draft.data.vocabulary ?? []}
						inlinable={inlinable.data?.items ?? []}
						saving={writeTasks.isPending}
						error={
							writeTasks.error
								? String((writeTasks.error as Error).message)
								: null
						}
						onSave={(tasks) =>
							writeTasks.mutate(tasks, {
								onSuccess: () => {
									writeTasks.reset();
									setEditingPlan(false);
								},
							})
						}
						onCancel={() => {
							writeTasks.reset();
							setEditingPlan(false);
						}}
					/>
				) : (
					<>
						{refusal && !busy ? <RefusalCard refusal={refusal} /> : null}
						<DrawnSteps plan={drawn} drawing={busy} />
					</>
				)}
			</PanelSection>

			<div className="flex items-center gap-1.5 border-t px-3 py-2">
				<Button
					size="sm"
					className="h-7 text-base"
					disabled={!!open || publish.isPending}
					onClick={() =>
						publish.mutate(
							{
								id: skill.id,
								data: {
									description: version.description,
									content: version.content,
									when_to_use: version.when_to_use,
								},
							},
							{ onSuccess: () => onEditing(false) },
						)
					}
				>
					{publish.isPending ? "Publishing…" : `Publish v${version.version}`}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="h-7 text-base"
					onClick={() => onEditing(false)}
				>
					Keep writing later
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="ml-auto h-7 text-base text-destructive"
					disabled={discard.isPending}
					onClick={() =>
						discard.mutate(undefined, { onSuccess: () => onEditing(false) })
					}
				>
					<Trash2 className="size-3" />
					Discard
				</Button>
			</div>
			{open ? (
				<p className="px-3 pb-2 text-base text-warning">
					Answer the question above before publishing — the plan is not written
					until it is settled.
				</p>
			) : null}
		</div>
	);
}

/** The published prose, sentence by sentence, with what each one drew. */
function Published({
	skill,
	plan,
	onEdit,
}: {
	skill: Skill;
	plan: SkillPlanRead | undefined;
	onEdit: () => void;
}) {
	const nodes = plan?.nodes ?? [];
	const lines = sentences(skill.content);

	return (
		<div className="pb-3">
			<PanelSection title="When to use">
				<p className="text-base">
					{skill.when_to_use || (
						<span className="text-muted-foreground">
							Not set — the skill is offered on every ask, which is rarely what
							is meant.
						</span>
					)}
				</p>
			</PanelSection>

			<PanelSection title="Description">
				<p className="text-base">
					{skill.description || (
						<span className="text-muted-foreground">No description.</span>
					)}
				</p>
			</PanelSection>

			<PanelSection
				title="Playbook"
				hint="each sentence, and the step it produced"
				action={
					<Button
						size="sm"
						variant="ghost"
						className="h-6 text-base"
						onClick={onEdit}
					>
						<PencilLine className="size-3" />
						Edit
					</Button>
				}
			>
				{lines.length === 0 ? (
					<p className="text-base text-muted-foreground">
						No playbook yet. A skill with no steps at all is a rule, not a
						skill.
					</p>
				) : (
					<div className="-mx-1 space-y-0.5">
						{lines.map((line) => {
							const step = stepFor(line, nodes);
							return (
								<div
									key={line}
									className={`flex items-baseline gap-2 rounded-xs px-1 py-1 ${
										step ? "" : "bg-destructive/5"
									}`}
								>
									<span className="min-w-0 flex-1 text-base">{line}</span>
									{step ? (
										<span className="shrink-0 font-mono text-base text-muted-foreground">
											→ {step.task || "a person"}
										</span>
									) : (
										<span className="shrink-0 text-base text-destructive">
											unmapped
										</span>
									)}
								</div>
							);
						})}
					</div>
				)}
			</PanelSection>
		</div>
	);
}

/** The four fields, saved onto the draft row rather than held in this tab. */
function DraftFields({
	description,
	content,
	whenToUse,
	saving,
	onSave,
}: {
	description: string;
	content: string;
	whenToUse: string;
	saving: boolean;
	onSave: (fields: {
		description: string;
		content: string;
		when_to_use: string;
	}) => void;
}) {
	const [local, setLocal] = useState({ description, content, whenToUse });
	const dirty =
		local.description !== description ||
		local.content !== content ||
		local.whenToUse !== whenToUse;

	return (
		<PanelSection
			title="The draft"
			hint="a published version is never edited — this is the next one"
			action={
				<Button
					size="sm"
					variant="outline"
					className="h-6 text-base"
					disabled={!dirty || saving}
					onClick={() =>
						onSave({
							description: local.description,
							content: local.content,
							when_to_use: local.whenToUse,
						})
					}
				>
					{saving ? "Saving…" : "Save"}
				</Button>
			}
		>
			<div className="space-y-2">
				<div>
					<Label htmlFor="skill-when" className="text-muted-foreground">
						When to use
					</Label>
					<Input
						id="skill-when"
						value={local.whenToUse}
						onChange={(e) => setLocal({ ...local, whenToUse: e.target.value })}
						placeholder="when someone asks a question of the graph in prose"
						className="mt-1"
					/>
				</div>
				<div>
					<Label htmlFor="skill-description" className="text-muted-foreground">
						Description
					</Label>
					<Input
						id="skill-description"
						value={local.description}
						onChange={(e) =>
							setLocal({ ...local, description: e.target.value })
						}
						placeholder="What this playbook is for."
						className="mt-1"
					/>
				</div>
				<div>
					<Label htmlFor="skill-content" className="text-muted-foreground">
						Playbook — one instruction per line
					</Label>
					<Textarea
						id="skill-content"
						value={local.content}
						onChange={(e) => setLocal({ ...local, content: e.target.value })}
						rows={10}
						placeholder={
							"Read the question and turn it into a query.\nCheck it before it runs.\nBe concise."
						}
						className="mt-1 font-mono"
					/>
				</div>
			</div>
		</PanelSection>
	);
}

/**
 * What the last draw refused, where the flow would have been.
 *
 * A refusal settles rather than fails (SK31), so it is shown here rather than
 * left in a run nobody opens. The reasons are the validator's own — a plan is
 * refused **on what was checked** — and the two acts that can answer them are
 * the two the Seams table already names: rewrite the sentence, or edit by hand.
 */
function RefusalCard({ refusal }: { refusal: SkillDrawRefusal }) {
	return (
		<div className="rounded-sm border border-destructive/40 bg-destructive/5 p-2.5">
			<p className="font-medium text-base">
				That playbook does not hold together as a plan, so nothing was written.
			</p>
			<ul className="mt-1.5 space-y-1">
				{refusal.reasons.map((reason) => (
					<li
						key={reason}
						className="border-destructive/40 border-l-2 pl-2 text-base"
					>
						{reason}
					</li>
				))}
			</ul>
			<p className="mt-2 text-muted-foreground text-base">
				Rewrite the sentence it names and draw again, or <b>Edit by hand</b> —
				the plan you had is untouched.
			</p>
		</div>
	);
}

/** The question, against the sentence that raised it. */
function ClarificationCard({
	clarification,
	pending,
	onAnswer,
}: {
	clarification: SkillClarification;
	pending: boolean;
	onAnswer: (answer: string) => void;
}) {
	return (
		<div className="rounded-sm border border-warning/40 bg-warning/5 p-2.5">
			<p className="text-base font-medium">{clarification.question}</p>
			<p className="mt-1 border-warning/40 border-l-2 pl-2 text-base italic">
				“{clarification.span}”
			</p>
			<div className="mt-2 space-y-1">
				{clarification.options.map((option) => (
					<button
						key={option.step_key}
						type="button"
						disabled={pending}
						onClick={() => onAnswer(option.step_key)}
						className="flex w-full items-baseline gap-2 rounded-xs border bg-background px-2 py-1.5 text-left hover:border-primary"
					>
						<span className="font-mono text-base">{option.step_key}</span>
						<span className="min-w-0 flex-1 text-base text-muted-foreground">
							{option.why || option.label}
						</span>
					</button>
				))}
				<button
					type="button"
					disabled={pending}
					onClick={() => onAnswer("none")}
					className="w-full rounded-xs px-2 py-1 text-left text-base text-muted-foreground hover:text-foreground"
				>
					None of these — a person does this step
				</button>
			</div>
			<p className="mt-2 text-base text-muted-foreground">
				It asks rather than guesses: drawing a guess moves a question the
				planner could ask into a picture you would have to decode.
			</p>
		</div>
	);
}

/** What the last draw wrote — or what is about to replace it. */
function DrawnSteps({
	plan,
	drawing,
}: {
	plan: SkillPlanRead | undefined;
	drawing: boolean;
}) {
	if (drawing)
		return (
			<p className="text-base text-muted-foreground">
				Reading the playbook… the previous drawing stays until this one lands.
			</p>
		);
	if (!plan || plan.nodes.length === 0)
		return (
			<p className="text-base text-muted-foreground">
				Not drawn yet. <b>Draw this</b> reads the prose and proposes the steps —
				you publish them.
			</p>
		);

	return (
		<div className="space-y-0.5">
			{plan.nodes.map((node) => (
				<div key={node.id} className="flex items-baseline gap-2 text-base">
					<span className="w-36 shrink-0 truncate font-mono">
						{node.task || "a person"}
					</span>
					<span className="min-w-0 flex-1 truncate text-muted-foreground">
						{node.source_span ?? "—"}
					</span>
				</div>
			))}
			<p className="pt-1 text-base text-muted-foreground">
				{plan.nodes.length} step{plan.nodes.length === 1 ? "" : "s"} ·{" "}
				{plan.layers.join(" · ")}
			</p>
		</div>
	);
}
