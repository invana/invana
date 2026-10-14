/**
 * A skill › **Instructions** (boards `agents.skills.detail` ·
 * `agents.skills.instructions.edit` · `agents.skills.evals`, AG-08).
 *
 * Three modes of one tab, because they are three moments of one act:
 *
 * | Mode | Draws |
 * |---|---|
 * | read | `instructions.md` beside the plan generated from it — read-only; to change the plan, change the text |
 * | edit | the draft, its Why and the model version it pins ({@link SkillDraftEditor}) |
 * | evals | the draft replayed against live on the eval set, the set itself, and *Publish vN* |
 *
 * Publishing goes through the eval gate with the Why typed while editing; a
 * failed hard check blocks it, a warning needs the reason. A published
 * version regenerates the plan, and the page moves to the Plan tab to show
 * the change.
 */

import {
	Badge,
	Button,
	PropertyList,
	PropertyRow,
	RecordHeader,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { ArrowLeft, Check, PencilLine } from "lucide-react";
import { useCallback, useState } from "react";
import { EvalRunView } from "../evals/EvalRunView";
import { EvalSetPanel } from "../evals/EvalSetPanel";
import { GatedActDialog } from "../evals/GatedActDialog";
import {
	useEvalMutations,
	useEvalRunQuery,
	useEvalSetQuery,
} from "../evals/queries";
import { usePublishSkillVersionMutation } from "./queries";
import { GeneratedSteps, SkillDraftEditor } from "./SkillPlaybookTab";
import type { Skill, SkillPlaybookRead } from "./types";

type Mode = "read" | "edit" | "evals";

export function SkillInstructionsTab({
	username,
	graphSlug,
	skill,
	plan,
	editing,
	onEditing,
	onPublished,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	/** The current version's generated plan. */
	plan: SkillPlaybookRead | undefined;
	editing: boolean;
	onEditing: (editing: boolean) => void;
	onPublished: () => void;
}) {
	const [evaluating, setEvaluating] = useState(false);
	const mode: Mode = evaluating ? "evals" : editing ? "edit" : "read";
	const [why, setWhy] = useState("");
	const [modelPin, setModelPin] = useState<string | null>(null);
	const [runId, setRunId] = useState<string | null>(null);
	const [publishing, setPublishing] = useState(false);
	const run = useEvalRunQuery(username, graphSlug, "skill", skill.id, runId);
	const set = useEvalSetQuery(username, graphSlug, "skill", skill.id);
	const evals = useEvalMutations(username, graphSlug, "skill", skill.id);
	const publish = usePublishSkillVersionMutation(username, graphSlug);
	const next = skill.is_draft ? skill.version : skill.version + 1;

	const onEvaluated = useCallback((id: string | null) => {
		setRunId(id);
		setEvaluating(true);
	}, []);

	if (mode === "edit")
		return (
			<SkillDraftEditor
				username={username}
				graphSlug={graphSlug}
				skill={skill}
				why={why}
				onWhy={setWhy}
				modelPin={modelPin}
				onModelPin={setModelPin}
				onEvaluated={onEvaluated}
				onClose={() => onEditing(false)}
			/>
		);

	if (mode === "evals")
		return (
			<div className="flex flex-col gap-2.5 p-3.5">
				<RecordHeader
					crumbs={["Evals", `v${next} draft against live`]}
					actions={
						<>
							<Button
								size="xs"
								variant="ghost"
								onClick={() => setEvaluating(false)}
							>
								<ArrowLeft /> Back to edit
							</Button>
							<ActButton
								area="build"
								size="xs"
								onClick={() => setPublishing(true)}
							>
								<Check /> Publish v{next}
							</ActButton>
						</>
					}
				/>
				{runId ? (
					<EvalRunView run={run.data} cases={set.data?.cases ?? []} />
				) : (
					<p className="text-muted-foreground">
						No active eval case — nothing is checked before this publishes. Add
						a case below to hold the next version to it.
					</p>
				)}
				<EvalSetPanel
					username={username}
					graphSlug={graphSlug}
					kind="skill"
					subjectId={skill.id}
				/>
				<GatedActDialog
					open={publishing}
					title={`Publish v${next} of ${skill.name}`}
					description="The plan regenerates from this text. Each bound agent uses the new version on its next run; a run in flight finishes on the old."
					confirm={`Publish v${next}`}
					initialWhy={why}
					pending={publish.isPending}
					error={publish.error}
					onConfirm={(reason) =>
						publish.mutate(
							{
								id: skill.id,
								data: {
									why: reason,
									...(modelPin ? { model_pin: modelPin } : {}),
								},
							},
							{
								onSuccess: () => {
									setPublishing(false);
									setEvaluating(false);
									setRunId(null);
									setWhy("");
									onEditing(false);
									onPublished();
								},
							},
						)
					}
					onClose={() => {
						publish.reset();
						setPublishing(false);
					}}
					onRunEvals={() =>
						evals.open.mutate(
							{ side: "both" },
							{
								onSuccess: (r) => {
									setRunId(r.run_id);
									publish.reset();
									setPublishing(false);
								},
							},
						)
					}
					runningEvals={evals.open.isPending}
				/>
			</div>
		);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-center gap-1">
				<span className="text-muted-foreground">
					{skill.when_to_use || "Offered on every ask — no *when to use* yet."}
				</span>
				<span className="ms-auto">
					<ActButton area="build" size="xs" onClick={() => onEditing(true)}>
						<PencilLine /> Edit instructions
					</ActButton>
				</span>
			</div>
			<div className="grid items-start gap-2.5 @[760px]:grid-cols-2">
				<PanelSection card title="instructions.md" hint={`v${skill.version}`}>
					<p className="whitespace-pre-wrap font-mono">
						{skill.content || (
							<span className="font-sans text-muted-foreground">
								No instructions yet. A skill with no steps at all is a rule, not
								a skill.
							</span>
						)}
					</p>
					{skill.description ? (
						<PropertyList labelWidth={90} className="mt-2 border-t pt-2">
							<PropertyRow label="description">{skill.description}</PropertyRow>
						</PropertyList>
					) : null}
				</PanelSection>
				<PanelSection
					card
					title="Generated plan"
					hint={`r${skill.version} · from v${skill.version} · read-only`}
					action={
						<Badge size="xs" variant="outline">
							{skill.origin}
						</Badge>
					}
				>
					<GeneratedSteps plan={plan} />
					<p className="pt-2 text-sm text-muted-foreground">
						This is how agents read the instructions. To change it, change them.
					</p>
				</PanelSection>
			</div>
		</div>
	);
}
