/**
 * An agent › **Instructions** (board `agents.agent.instructions`, AG-04): who
 * it is and how it works, in its own `instructions.md`.
 *
 * *As a builder, I want to write an agent's instructions.md, so that its
 * behaviour is plain text I own.*
 *
 * Read, the published text sits beside *What it shapes*. *Edit* writes the
 * agent's draft — a row the engine keeps, so it survives a reload and nothing
 * runs on it. *Publish* asks for a reason and goes through the eval gate; the
 * agent's eval set is edited below, and *Run the evals* replays it on the
 * draft against live. A restore is made from History.
 */

import { Textarea } from "@invana/forms";
import { Badge, Button, PropertyList, PropertyRow } from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { PencilLine, Play, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRecordHistoryQuery } from "../changes/history";
import { EvalRunView } from "../evals/EvalRunView";
import { EvalSetPanel } from "../evals/EvalSetPanel";
import { GatedActDialog } from "../evals/GatedActDialog";
import {
	useEvalMutations,
	useEvalRunQuery,
	useEvalSetQuery,
} from "../evals/queries";
import { useAgentMutations } from "./queries";
import type { Agent } from "./types";

export function AgentInstructionsTab({
	username,
	graphSlug,
	agent,
	onGoToHistory,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	onGoToHistory: () => void;
}) {
	const m = useAgentMutations(username, graphSlug);
	const evals = useEvalMutations(username, graphSlug, "agent", agent.id);
	const set = useEvalSetQuery(username, graphSlug, "agent", agent.id);
	const history = useRecordHistoryQuery(username, graphSlug, "agent", agent.id);
	const [editing, setEditing] = useState(false);
	const [text, setText] = useState(
		agent.instructions_draft ?? agent.instructions,
	);
	const [publishing, setPublishing] = useState(false);
	const [runId, setRunId] = useState<string | null>(null);
	const run = useEvalRunQuery(username, graphSlug, "agent", agent.id, runId);
	const hasDraft = agent.instructions_draft !== null;
	// The engine answers newest first.
	const last = history.data?.items[0];

	const startEdit = () => {
		setText(agent.instructions_draft ?? agent.instructions);
		setEditing(true);
	};
	const runEvals = () =>
		evals.open.mutate(
			{ side: "both" },
			{ onSuccess: (r) => setRunId(r.run_id) },
		);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<div className="grid items-start gap-2.5 @[760px]:grid-cols-[1.6fr_1fr]">
				<PanelSection
					card
					title="instructions.md"
					hint={
						hasDraft
							? `draft open · published v${agent.version}`
							: `v${agent.version}`
					}
					action={
						editing ? null : (
							<Button size="xs" variant="ghost" onClick={startEdit}>
								<PencilLine /> {hasDraft ? "Edit the draft" : "Edit"}
							</Button>
						)
					}
				>
					{editing ? (
						<div className="flex flex-col gap-2">
							<Textarea
								aria-label="instructions.md"
								value={text}
								rows={14}
								className="font-mono"
								onChange={(e) => setText(e.target.value)}
								placeholder={
									"# Analyst\nAnswers questions of the Graph.\n\n## Always\n- cite every record"
								}
							/>
							<span className="flex gap-1">
								<Button
									size="xs"
									disabled={m.writeDraft.isPending}
									onClick={() =>
										m.writeDraft.mutate(
											{ id: agent.id, instructions: text },
											{ onSuccess: () => setEditing(false) },
										)
									}
								>
									{m.writeDraft.isPending ? "Saving…" : "Save draft"}
								</Button>
								<Button
									size="xs"
									variant="ghost"
									onClick={() => setEditing(false)}
								>
									Cancel
								</Button>
							</span>
						</div>
					) : (
						<p className="whitespace-pre-wrap font-mono">
							{(hasDraft ? agent.instructions_draft : agent.instructions) || (
								<span className="font-sans text-muted-foreground">
									No instructions of its own — the Graph's instructions alone.
								</span>
							)}
						</p>
					)}
					{hasDraft && !editing ? (
						<div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
							<Badge size="xs" variant="soft" tone="warning">
								draft · nothing runs on it
							</Badge>
							<Button
								size="xs"
								variant="outline"
								disabled={evals.open.isPending}
								onClick={runEvals}
							>
								<Play /> Run the evals
							</Button>
							<Button size="xs" onClick={() => setPublishing(true)}>
								<Send /> Publish
							</Button>
							<Button
								size="xs"
								variant="ghost"
								disabled={m.discardDraft.isPending}
								onClick={() => m.discardDraft.mutate(agent.id)}
							>
								<Trash2 /> Discard draft
							</Button>
						</div>
					) : null}
				</PanelSection>

				<PanelSection card title="What it shapes">
					<PropertyList labelWidth={90}>
						<PropertyRow label="plans">
							every plan this agent runs is generated with these
						</PropertyRow>
						<PropertyRow label="skills">
							offered {agent.skill_ids.length} · listed under Skills & callables
						</PropertyRow>
						<PropertyRow label="last change">
							{last ? (
								<Button size="xs" variant="link" onClick={onGoToHistory}>
									{last.summary}
								</Button>
							) : (
								"—"
							)}
						</PropertyRow>
					</PropertyList>
				</PanelSection>
			</div>

			{runId ? (
				<EvalRunView run={run.data} cases={set.data?.cases ?? []} />
			) : null}

			<EvalSetPanel
				username={username}
				graphSlug={graphSlug}
				kind="agent"
				subjectId={agent.id}
			/>

			<GatedActDialog
				open={publishing}
				title={`Publish ${agent.name}'s instructions`}
				description="Every run after this reads the new text; a run in flight finishes on the old."
				confirm="Publish"
				pending={m.publish.isPending}
				error={m.publish.error}
				onConfirm={(why) =>
					m.publish.mutate(
						{ id: agent.id, why },
						{ onSuccess: () => setPublishing(false) },
					)
				}
				onClose={() => {
					m.publish.reset();
					setPublishing(false);
				}}
				onRunEvals={() => {
					runEvals();
					m.publish.reset();
					setPublishing(false);
				}}
				runningEvals={evals.open.isPending}
			/>
		</div>
	);
}
