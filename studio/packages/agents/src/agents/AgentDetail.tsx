/**
 * The agent's page — one page, seven tabs: **Overview · Instructions ·
 * Skills & callables · Thinking · Soul · Activity · History**.
 *
 * *As someone running work through agents, I want to see what one agent is,
 * what it can do, how it thinks, how it speaks and what it has done, so that
 * assigning it a task is a choice and not a guess.*
 *
 * There is no Bounds tab. The world comes with the work, and every
 * standing limit sits where it is read: effort on Thinking, budget and reach on
 * Activity beside the meters they cap.
 *
 * ## Save is explicit
 *
 * Nothing here autosaves. An envelope is a permission boundary and a voice is
 * a version, so edits from every tab accumulate in one buffer, Discard · Save
 * appear in the header while it differs, and one **Save** is one agent edit.
 * Three acts are their own writes: binding a skill, so a refusal can name the
 * one skill it refused; the instructions, which have a draft and publish
 * through the eval gate; and the model pin, a gated move with a reason.
 */

import { Button, RecordHeader, TabbedPanel } from "@invana/ui";
import { ActButton, ReadOnlyNotice } from "@invana-studio/shell";
import { agentTone, DetailStatus, humanStatus } from "@invana-studio/ui";
import { Eye, Lock, Play, Save, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { AgentActivityTab } from "./AgentActivityTab";
import { AgentEffortTab } from "./AgentEffortTab";
import { AgentHistoryTab } from "./AgentHistoryTab";
import { AgentInstructionsTab } from "./AgentInstructionsTab";
import { AgentOverviewTab } from "./AgentOverviewTab";
import { AgentSkillsTab } from "./AgentSkillsTab";
import { AgentSoulTab, useSoulPreview } from "./AgentSoulTab";
import { type AgentDraft, changesOf, draftOf } from "./agentDraft";
import type { Agent, AgentUpdate } from "./types";

/**
 * Every step the interpreter knows. The allow-list is drawn against this whole
 * set rather than against itself, because *what this agent may not do* is as
 * much of the answer as what it may — an allow-list shown alone always looks
 * complete.
 */
export const ALL_TASKS = [
	"nl.understand",
	"plan.compose",
	"nl.translate",
	"graph.read.validate",
	"graph.read.query",
	"answer.shape",
	"plan.verify",
	"work.spawn_agent",
	"work.delegate",
	"work.await",
	"work.create_task",
];

export type AgentTab =
	| "overview"
	| "instructions"
	| "skills"
	| "thinking"
	| "soul"
	| "activity"
	| "history";

export function AgentDetail({
	username,
	graphSlug,
	agent,
	isDefault,
	onSave,
	onPause,
	onResume,
	onRetire,
	onSetDefault,
	onOpenLineage,
	onOpenEnvelope,
	onBindSkill,
	onUnbindSkill,
	bindError,
	saveError,
	isSaving,
	isBinding,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	isDefault: boolean;
	onSave: (data: AgentUpdate) => void;
	onPause: () => void;
	onResume: () => void;
	onRetire: () => void;
	onSetDefault: () => void;
	onOpenLineage: () => void;
	onOpenEnvelope: () => void;
	onBindSkill: (skillId: string) => void;
	onUnbindSkill: (skillId: string) => void;
	/** The engine's `409`, drawn under the chip that raised it. */
	bindError?: unknown;
	/** The last Save's refusal — a `422` naming the dial or key it refused. */
	saveError?: unknown;
	isSaving?: boolean;
	isBinding?: boolean;
}) {
	const [tab, setTab] = useState<AgentTab>("overview");
	// Keyed by agent id: selecting a different agent starts a fresh buffer rather
	// than carrying one agent's unsaved edits onto another's.
	const [draftFor, setDraftFor] = useState(agent.id);
	const [draft, setDraft] = useState<AgentDraft>(() => draftOf(agent));
	// The version the buffer was taken from. A save moves the agent's version,
	// and the buffer is re-taken from what the engine answered — never from
	// what was typed, which is what a refused save would otherwise keep.
	const [draftVersion, setDraftVersion] = useState(agent.version);
	if (draftFor !== agent.id || draftVersion !== agent.version) {
		setDraftFor(agent.id);
		setDraftVersion(agent.version);
		setDraft(draftOf(agent));
	}
	/** The raw envelope editor's parse error; a spec that does not parse cannot be saved. */
	const [specError, setSpecError] = useState<string | null>(null);

	const soulPreview = useSoulPreview(username, graphSlug, agent.id, draft);
	// The soul's **Preview** belongs to the Soul tab's header actions, beside
	// Discard · Save, as drawn — it answers the tab's sample ask in both voices.
	const previewButton =
		tab === "soul" ? (
			<ActButton
				area="build"
				size="sm"
				variant="outline"
				disabled={soulPreview.preview.isPending}
				onClick={soulPreview.run}
			>
				<Eye />
				{soulPreview.preview.isPending ? "Asking…" : "Preview"}
			</ActButton>
		) : null;

	const changes = useMemo(() => changesOf(agent, draft), [agent, draft]);
	const dirty = Object.keys(changes).length > 0;
	const patch = (next: Partial<AgentDraft>) =>
		setDraft((d) => ({ ...d, ...next }));

	return (
		// `h-full`: the page host is not a flex column, so without it the page
		// grows to its content and the header and tabs scroll away with it.
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				crumbs={[agent.name]}
				chips={
					<>
						<DetailStatus>{agent.kind}</DetailStatus>
						<DetailStatus tone={agentTone(agent.status)}>
							{humanStatus(agent.status)}
						</DetailStatus>
						{isDefault ? <DetailStatus>Graph default</DetailStatus> : null}
						{agent.lifetime === "ephemeral" ? (
							<DetailStatus>ephemeral</DetailStatus>
						) : null}
					</>
				}
				actions={
					dirty ? (
						<>
							{previewButton}
							<Button
								size="sm"
								variant="ghost"
								disabled={isSaving}
								onClick={() => {
									setDraft(draftOf(agent));
									setSpecError(null);
								}}
							>
								Discard
							</Button>
							{/* A spec that does not parse must not be savable: the
							    structured fields still hold the last valid document, so
							    Save would write something the editor is not showing. */}
							<ActButton
								area="build"
								size="sm"
								disabled={isSaving || specError !== null}
								onClick={() => onSave(changes)}
							>
								<Save />{" "}
								{isSaving ? "Saving…" : tab === "soul" ? "Save soul" : "Save"}
							</ActButton>
						</>
					) : (
						<>
							{previewButton}
							{/* Only an agent that answers asks can be the default. */}
							{!isDefault && agent.status === "active" && agent.answers_asks ? (
								<ActButton
									area="settings"
									size="sm"
									variant="ghost"
									onClick={onSetDefault}
								>
									<Star /> Make default
								</ActButton>
							) : null}
							{agent.status === "retired" ? null : (
								<>
									<ActButton
										area="build"
										size="sm"
										variant="ghost"
										onClick={agent.status === "paused" ? onResume : onPause}
									>
										{agent.status === "paused" ? <Play /> : <Lock />}
										{agent.status === "paused" ? "Resume" : "Pause"}
									</ActButton>
									<ActButton
										area="build"
										size="sm"
										variant="ghost"
										onClick={onRetire}
									>
										Retire
									</ActButton>
								</>
							)}
						</>
					)
				}
			/>
			{dirty && saveError ? (
				<p role="alert" className="px-4 py-1 text-sm text-destructive">
					Not saved —{" "}
					{saveError instanceof Error
						? saveError.message
						: "the engine refused this edit."}
				</p>
			) : null}
			<div className="shrink-0 px-3.5 pt-3.5 empty:hidden">
				<ReadOnlyNotice area="build" noun="agent" />
			</div>

			{/* The kit's underline tab strip, as drawn. Its card border is
			    the page's own, so it is dropped here. */}
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				bodyClassName="@container"
				activeTab={tab}
				onTabChange={(v) => setTab(v as AgentTab)}
				tabs={[
					{
						value: "overview",
						label: "Overview",
						content: (
							<AgentOverviewTab
								username={username}
								graphSlug={graphSlug}
								agent={agent}
								draft={draft}
								onPatch={patch}
								onGoTo={setTab}
							/>
						),
					},
					{
						value: "instructions",
						label:
							agent.instructions_draft !== null
								? "Instructions · draft"
								: "Instructions",
						content: (
							<AgentInstructionsTab
								username={username}
								graphSlug={graphSlug}
								agent={agent}
								onGoToHistory={() => setTab("history")}
							/>
						),
					},
					{
						value: "skills",
						label: "Skills & functions",
						content: (
							<AgentSkillsTab
								username={username}
								graphSlug={graphSlug}
								agent={agent}
								draft={draft}
								onPatch={patch}
								specError={specError}
								onSpecError={setSpecError}
								onOpenEnvelope={onOpenEnvelope}
								onBindSkill={onBindSkill}
								onUnbindSkill={onUnbindSkill}
								bindError={bindError}
								isBinding={isBinding}
							/>
						),
					},
					{
						value: "thinking",
						label: "Thinking",
						content: (
							<AgentEffortTab
								username={username}
								graphSlug={graphSlug}
								agent={agent}
								draft={draft}
								onPatch={patch}
							/>
						),
					},
					{
						value: "soul",
						label: "Soul",
						content: (
							<AgentSoulTab
								agent={agent}
								draft={draft}
								onPatch={patch}
								soulPreview={soulPreview}
							/>
						),
					},
					{
						value: "activity",
						label: "Activity",
						content: (
							<AgentActivityTab
								username={username}
								graphSlug={graphSlug}
								agent={agent}
								draft={draft}
								onPatch={patch}
								onOpenLineage={onOpenLineage}
							/>
						),
					},
					{
						value: "history",
						label: "History",
						content: (
							<AgentHistoryTab
								username={username}
								graphSlug={graphSlug}
								agent={agent}
							/>
						),
					},
				]}
			/>
		</div>
	);
}
