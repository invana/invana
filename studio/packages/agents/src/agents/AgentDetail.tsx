/**
 * The agent's page — one page, eleven tabs: **Overview · Runs · Instructions ·
 * Soul · Model · Flow · Access · Limits · Deploy · Evals · History**
 * (the-agent-page.md).
 *
 * *As a builder, I want to build an agent the way I build a skill — on a page
 * — and read a published agent's numbers, voice, model, reach, limits and
 * lifecycle in one place, so that an agent changes deliberately and I see when
 * it gets worse.*
 *
 * A draft's Overview is the builder; a live agent's is its dashboard. The open
 * tab is `?tab=` beside `?page=`, written on every switch (replacing the
 * history entry), so a link or a reload opens the same tab. A page kept
 * mounted behind another reads its own tab locally until it is in front.
 *
 * ## Save is explicit
 *
 * Nothing autosaves. Edits from every tab accumulate in one buffer, Discard ·
 * Save appear in the head while it differs, and one **Save** sends only the
 * fields that moved. Three acts are their own writes: binding a skill, the
 * instructions (a draft published through the eval gate) and the model pin (a
 * gated move with a reason).
 */

import { Button, RecordHeader, TabbedPanel } from "@invana/ui";
import { ActButton, ReadOnlyNotice } from "@invana-studio/shell";
import { agentTone, DetailStatus, humanStatus } from "@invana-studio/ui";
import { Bot, Check, Pause, Play, Save, Star, Trash2 } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EvalSetPanel } from "../evals/EvalSetPanel";
import { AgentsOpenContext } from "../open";
import { AgentAccessTab } from "./AgentAccessTab";
import { AgentBuilder } from "./AgentBuilder";
import { AgentDashboard } from "./AgentDashboard";
import { AgentDeployTab } from "./AgentDeployTab";
import { AgentFlowTab } from "./AgentFlowTab";
import { AgentHistoryTab } from "./AgentHistoryTab";
import { AgentInstructionsTab } from "./AgentInstructionsTab";
import { AgentLimitsTab } from "./AgentLimitsTab";
import { AgentModelTab } from "./AgentModelTab";
import { AgentRunsTab } from "./AgentRunsTab";
import { AgentSoulTab, useSoulPreview } from "./AgentSoulTab";
import { type AgentDraft, changesOf, draftOf } from "./agentDraft";
import {
	AGENT_TABS,
	type AgentTab,
	isAgentTab,
	versionName,
} from "./agentParts";
import type { Agent, AgentUpdate } from "./types";

/** The head's state chip: `draft` · `authored · v7` · `paused` · `retired`. */
function stateChip(agent: Agent): string {
	if (agent.status === "active") return `${agent.kind} · v${agent.version}`;
	return humanStatus(agent.status);
}

/** The open tab: `?tab=` while this page is the one in front, else its own. */
function useAgentTab(agentId: string): [AgentTab, (tab: AgentTab) => void] {
	const [params, setParams] = useSearchParams();
	const [local, setLocal] = useState<AgentTab>("overview");
	const inFront = params.get("page") === `agent:${agentId}`;
	const fromUrl = params.get("tab");
	const tab = inFront ? (isAgentTab(fromUrl) ? fromUrl : "overview") : local;
	const setTab = (next: AgentTab) => {
		setLocal(next);
		if (!inFront) return;
		setParams(
			(prev) => {
				const out = new URLSearchParams(prev);
				out.set("tab", next);
				return out;
			},
			{ replace: true },
		);
	};
	return [tab, setTab];
}

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
	onCreate,
	creating,
	onDiscard,
	discarding,
	onOpenLineage,
	onOpenEnvelope,
	saveError,
	isSaving,
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
	/** *Create agent* — the draft goes live through the eval gate. */
	onCreate: () => void;
	creating?: boolean;
	/** *Discard draft* — deletes a draft, after a confirm. */
	onDiscard: () => void;
	discarding?: boolean;
	onOpenLineage: () => void;
	onOpenEnvelope: () => void;
	/** The last Save's refusal, in the engine's words. */
	saveError?: unknown;
	isSaving?: boolean;
}) {
	const open = useContext(AgentsOpenContext);
	const [tab, setTab] = useAgentTab(agent.id);
	// Keyed by agent and version: a save re-takes the buffer from what the
	// engine answered, never from what was typed.
	const [draftFor, setDraftFor] = useState(`${agent.id}@${agent.version}`);
	const [draft, setDraft] = useState<AgentDraft>(() => draftOf(agent));
	if (draftFor !== `${agent.id}@${agent.version}`) {
		setDraftFor(`${agent.id}@${agent.version}`);
		setDraft(draftOf(agent));
	}
	const soulPreview = useSoulPreview(username, graphSlug, agent.id, draft);

	const changes = useMemo(() => changesOf(agent, draft), [agent, draft]);
	const dirty = Object.keys(changes).length > 0;
	const patch = (next: Partial<AgentDraft>) =>
		setDraft((d) => ({ ...d, ...next }));

	const isDraft = agent.status === "draft";
	const retired = agent.status === "retired";
	const model = versionName(agent.model_pin);
	const meta = isDraft
		? `pins ${model ?? "no model"} · not deployed`
		: (model ?? "no pinned model — the world's cast decides");

	const acts = dirty ? (
		<>
			<Button
				size="sm"
				variant="ghost"
				disabled={isSaving}
				onClick={() => setDraft(draftOf(agent))}
			>
				Discard
			</Button>
			<ActButton
				area="build"
				size="sm"
				disabled={isSaving}
				onClick={() => onSave(changes)}
			>
				<Save /> {isSaving ? "Saving…" : "Save"}
			</ActButton>
		</>
	) : isDraft ? (
		<>
			<ActButton
				area="build"
				size="sm"
				variant="ghost"
				disabled={creating || discarding}
				onClick={onDiscard}
			>
				<Trash2 /> {discarding ? "Discarding…" : "Discard draft"}
			</ActButton>
			<ActButton
				area="build"
				size="sm"
				disabled={creating || discarding}
				onClick={onCreate}
			>
				<Check /> {creating ? "Creating…" : "Create agent"}
			</ActButton>
		</>
	) : (
		<>
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
			<ActButton
				area="build"
				size="sm"
				variant="outline"
				disabled={retired}
				onClick={agent.status === "paused" ? onResume : onPause}
			>
				{agent.status === "paused" ? <Play /> : <Pause />}
				{agent.status === "paused" ? "Resume" : "Pause"}
			</ActButton>
			<ActButton
				area="build"
				size="sm"
				variant="outline"
				disabled={retired}
				onClick={onRetire}
			>
				Retire
			</ActButton>
		</>
	);

	const body = (value: AgentTab) => {
		switch (value) {
			case "overview":
				return isDraft ? (
					<AgentBuilder
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						draft={draft}
						onPatch={patch}
						onGoTo={setTab}
					/>
				) : (
					<AgentDashboard
						username={username}
						graphSlug={graphSlug}
						agent={agent}
					/>
				);
			case "runs":
				return (
					<AgentRunsTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
					/>
				);
			case "instructions":
				return (
					<AgentInstructionsTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						onGoToHistory={() => setTab("history")}
						onGoToEvals={() => setTab("evals")}
					/>
				);
			case "soul":
				return (
					<AgentSoulTab
						agent={agent}
						draft={draft}
						onPatch={patch}
						soulPreview={soulPreview}
					/>
				);
			case "model":
				return (
					<AgentModelTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						onGoTo={setTab}
					/>
				);
			case "flow":
				return (
					<AgentFlowTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						onOpenLineage={onOpenLineage}
						onOpenSkill={open ? open.skill : undefined}
					/>
				);
			case "access":
				return (
					<AgentAccessTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						onOpenEnvelope={onOpenEnvelope}
					/>
				);
			case "limits":
				return (
					<AgentLimitsTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						draft={draft}
						onPatch={patch}
					/>
				);
			case "deploy":
				return (
					<AgentDeployTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
						draft={draft}
						onPatch={patch}
					/>
				);
			case "evals":
				return (
					<div className="flex flex-col gap-2.5 p-3.5">
						<EvalSetPanel
							username={username}
							graphSlug={graphSlug}
							kind="agent"
							subjectId={agent.id}
						/>
					</div>
				);
			case "history":
				return (
					<AgentHistoryTab
						username={username}
						graphSlug={graphSlug}
						agent={agent}
					/>
				);
		}
	};

	return (
		// `h-full`: the page host is not a flex column, so without it the page
		// grows to its content and the head and tabs scroll away with it.
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<Bot />}
				crumbs={[
					open
						? { label: "Agents", onClick: () => open.section("agents") }
						: "Agents",
					agent.name,
				]}
				chips={
					<>
						<DetailStatus tone={isDraft ? undefined : agentTone(agent.status)}>
							{stateChip(agent)}
						</DetailStatus>
						{isDefault ? <DetailStatus>Graph default</DetailStatus> : null}
						<span className="truncate text-sm text-muted-foreground">
							{meta}
						</span>
					</>
				}
				actions={acts}
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
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				bodyClassName="@container"
				activeTab={tab}
				onTabChange={(v) => setTab(v as AgentTab)}
				tabs={AGENT_TABS.map((t) => ({
					value: t.value,
					label:
						t.value === "instructions" && agent.instructions_draft !== null
							? "Instructions · draft"
							: t.label,
					content: t.value === tab ? body(t.value) : null,
				}))}
			/>
		</div>
	);
}
