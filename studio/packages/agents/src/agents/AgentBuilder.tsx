/**
 * A draft agent's Overview — **the builder** (board `agents.agent.new`).
 *
 * *As a builder, I want to name an agent, pick its model, bind its skills and
 * write its instructions on one page, so that I see what it can reach and its
 * limits before I create it.*
 *
 * Identity · Skills · Instructions on the left; What it can reach and Limits
 * on the right. The name rides the page's one buffer (Save in the head);
 * binding a skill, the model pin and the instructions are each their own
 * write. Reach is the bound skills' needs, read from the engine after every
 * bind. Nothing here is offered work until *Create agent*.
 */

import { MarkdownEditorBlock } from "@invana/editor";
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
	BoundChip,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
	PropertyList,
	PropertyRow,
	Spinner,
} from "@invana/ui";
import { formatCompact } from "@invana-studio/core";
import { ActButton, useAccess } from "@invana-studio/shell";
import {
	asBindRefusal,
	BindRefusalCard,
	FormError,
	PanelSection,
} from "@invana-studio/ui";
import { ArrowRight, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { EVERY } from "../lists";
import { useSkillsQuery } from "../skills/queries";
import { type AgentDraft, effortSummary, voiceSummary } from "./agentDraft";
import { type AgentTab, useOfferedVersions, versionName } from "./agentParts";
import {
	useAgentMetersQuery,
	useAgentMutations,
	useAgentSkillsAndCallablesQuery,
} from "./queries";
import type { Agent } from "./types";

const n = (v: number | null | undefined) =>
	v == null ? "—" : formatCompact(v);

export function AgentBuilder({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
	onGoTo,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
	onGoTo: (tab: AgentTab) => void;
}) {
	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
			<div className="flex min-w-0 flex-col gap-2.5">
				<Identity
					username={username}
					graphSlug={graphSlug}
					agent={agent}
					draft={draft}
					onPatch={onPatch}
					onGoTo={onGoTo}
				/>
				<AgentSkillsCard
					username={username}
					graphSlug={graphSlug}
					agent={agent}
				/>
				<Instructions username={username} graphSlug={graphSlug} agent={agent} />
			</div>
			<div className="flex min-w-0 flex-col gap-2.5">
				<Reach username={username} graphSlug={graphSlug} agent={agent} />
				<LimitsSummary
					username={username}
					graphSlug={graphSlug}
					agent={agent}
					draft={draft}
					onGoTo={onGoTo}
				/>
			</div>
		</div>
	);
}

function Identity({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
	onGoTo,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
	onGoTo: (tab: AgentTab) => void;
}) {
	const { versions } = useOfferedVersions(username, graphSlug);
	const m = useAgentMutations(username, graphSlug);
	const build = useAccess().gate("build");
	return (
		<PanelSection card title="Identity">
			<div className="grid gap-3 @[560px]:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="agent-name">Name</Label>
					<Input
						id="agent-name"
						value={draft.name}
						disabled={!build.allowed}
						onChange={(e) => onPatch({ name: e.target.value })}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="agent-model">Model version</Label>
					<Select
						value={agent.model_pin ?? ""}
						disabled={!build.allowed || m.pin.isPending}
						onValueChange={(v) =>
							m.pin.mutate({ id: agent.id, modelPin: v, why: "" })
						}
					>
						<SelectTrigger id="agent-model" className="font-mono">
							<SelectValue placeholder="Pick an offered version" />
						</SelectTrigger>
						<SelectContent>
							{versions.map((v) => (
								<SelectItem key={v} value={v} className="font-mono">
									{versionName(v)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FormError error={m.pin.error} />
				</div>
			</div>
			<PropertyList className="mt-2">
				<PropertyRow label="Voice">
					<span className="flex items-center gap-2">
						<span className="min-w-0 flex-1 truncate">
							{voiceSummary(draft.soul_traits)}
						</span>
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={() => onGoTo("soul")}
						>
							Soul <ArrowRight />
						</Button>
					</span>
				</PropertyRow>
			</PropertyList>
		</PanelSection>
	);
}

/**
 * The agent's bound skills, with *Add skill* and an unbind per row — the
 * builder's Skills, and the Skills card on a live agent's Overview.
 */
export function AgentSkillsCard({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const all = useSkillsQuery(username, graphSlug, EVERY);
	const m = useAgentMutations(username, graphSlug);
	const build = useAccess().gate("build");
	const [pickedFor, setPickedFor] = useState<string | null>(null);
	const bound = can.data?.skills ?? [];
	const unbound = (all.data?.items ?? []).filter(
		(s) => !agent.skill_ids.includes(s.id),
	);
	const refusal = asBindRefusal(m.bindSkill.error);
	const refused = pickedFor
		? all.data?.items.find((s) => s.id === pickedFor)
		: undefined;
	const bind = (skillId: string) => {
		m.bindSkill.reset();
		setPickedFor(skillId);
		m.bindSkill.mutate({ id: agent.id, skillId });
	};
	const busy = m.bindSkill.isPending || m.unbindSkill.isPending;

	return (
		<PanelSection
			card
			title="Skills"
			action={
				<span className="text-sm text-muted-foreground">{bound.length}</span>
			}
		>
			{can.isLoading ? (
				<Spinner />
			) : bound.length ? (
				<ItemGroup>
					{bound.map((s) => (
						<Item key={s.skill_id} size="xs">
							<ItemContent>
								<ItemTitle>
									<Pencil className="size-3.5 text-muted-foreground" />
									{s.name}
									<span className="font-normal text-muted-foreground">
										{s.version == null ? "draft" : `v${s.version}`}
									</span>
								</ItemTitle>
							</ItemContent>
							<ItemActions>
								<span className="text-sm text-muted-foreground">
									{s.needs.length} function{s.needs.length === 1 ? "" : "s"}
								</span>
								<ActButton
									area="build"
									size="icon-xs"
									variant="ghost"
									aria-label={`Unbind ${s.name}`}
									disabled={busy}
									onClick={() =>
										m.unbindSkill.mutate({ id: agent.id, skillId: s.skill_id })
									}
								>
									<X />
								</ActButton>
							</ItemActions>
						</Item>
					))}
				</ItemGroup>
			) : (
				<p className="text-muted-foreground">
					No skills yet — an agent can reach only what its skills need.
				</p>
			)}
			{refusal && refused ? (
				<BindRefusalCard
					className="mt-1.5"
					refusal={refusal}
					subject={refused.name}
				/>
			) : null}
			<div className="mt-2 flex items-center gap-2">
				{build.allowed ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="sm" variant="outline" disabled={busy}>
								<Plus /> Add skill
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{unbound.length ? (
								unbound.map((s) => (
									<DropdownMenuItem key={s.id} onSelect={() => bind(s.id)}>
										{s.name}
										{s.is_draft ? (
											<Badge size="xs" variant="outline" tone="muted">
												draft
											</Badge>
										) : null}
									</DropdownMenuItem>
								))
							) : (
								<DropdownMenuItem disabled>
									Every skill in this Graph is bound
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<ActButton area="build" size="sm" variant="outline">
						<Plus /> Add skill
					</ActButton>
				)}
				<span className="ml-auto text-sm text-muted-foreground">
					its functions come from these
				</span>
			</div>
		</PanelSection>
	);
}

function Instructions({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const m = useAgentMutations(username, graphSlug);
	const [text, setText] = useState(agent.instructions);
	const [from, setFrom] = useState(agent.instructions);
	// A save, or another writer, moves the saved text: start again from it.
	if (from !== agent.instructions) {
		setFrom(agent.instructions);
		setText(agent.instructions);
	}
	const moved = text !== agent.instructions;
	return (
		<PanelSection
			card
			title="Instructions"
			hint="instructions.md · Markdown"
			action={
				moved ? (
					<ActButton
						area="build"
						size="xs"
						disabled={m.update.isPending}
						onClick={() =>
							m.update.mutate({ id: agent.id, data: { instructions: text } })
						}
					>
						{m.update.isPending ? "Saving…" : "Save instructions"}
					</ActButton>
				) : null
			}
		>
			<MarkdownEditorBlock
				aria-label="instructions.md"
				value={text}
				onChange={setText}
				placeholder={"# Analyst\nWho it is, what it does, and how it reports."}
				className="min-h-40"
			/>
			<FormError error={m.update.error} />
		</PanelSection>
	);
}

function Reach({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const needs = new Set((can.data?.skills ?? []).flatMap((s) => s.needs));
	const rows = (can.data?.callables ?? []).filter((c) => needs.has(c.step_key));
	const bounds = new Set(rows.map((r) => r.bound));
	return (
		<PanelSection
			card
			title="What it can reach"
			action={
				<span className="text-sm text-muted-foreground">
					{rows.length} functions · {bounds.size} bounds
				</span>
			}
		>
			{can.isLoading ? (
				<Spinner />
			) : rows.length ? (
				<ul className="flex flex-col gap-1.5">
					{rows.map((c) => (
						<li key={c.step_key} className="flex items-center gap-2">
							<Badge
								variant="outline"
								tone="muted"
								size="xs"
								className="font-mono font-normal"
							>
								{c.step_key}
							</Badge>
							<BoundChip bound={c.bound} />
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground">
					Nothing yet — add a skill and what it needs shows here.
				</p>
			)}
			<p className="mt-2 text-sm text-muted-foreground">From its skills.</p>
		</PanelSection>
	);
}

function LimitsSummary({
	username,
	graphSlug,
	agent,
	draft,
	onGoTo,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onGoTo: (tab: AgentTab) => void;
}) {
	// The meters carry each effective limit — the agent's own, or the Graph's.
	const m = useAgentMetersQuery(username, graphSlug, agent.id).data;
	const b = draft.budget;
	return (
		<PanelSection card title="Limits">
			<PropertyList>
				<PropertyRow label="Budget">
					{n(b.max_tokens_run ?? m?.max_tokens_run)} a run ·{" "}
					{n(b.max_tokens_month ?? m?.max_tokens_month)} a month
				</PropertyRow>
				<PropertyRow label="Delegation">
					{draft.policy.can_spawn !== true
						? "may not create helpers"
						: `depth ${n(b.max_depth ?? m?.max_depth)} · ${n(b.max_children ?? m?.max_children)} children`}
				</PropertyRow>
				<PropertyRow label="Live at once">
					{n(b.max_concurrent_runs ?? m?.max_concurrent_runs)}
				</PropertyRow>
				<PropertyRow label="Effort">
					{effortSummary({ ...agent.effective_effort, ...draft.effort })}
				</PropertyRow>
			</PropertyList>
			<Button
				variant="link"
				size="sm"
				className="mt-1 h-auto p-0"
				onClick={() => onGoTo("limits")}
			>
				Edit limits <ArrowRight />
			</Button>
		</PanelSection>
	);
}
