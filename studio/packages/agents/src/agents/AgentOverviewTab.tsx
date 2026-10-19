/**
 * Overview — the agent read whole: who it is, its focus, how it thinks,
 * what it can do, what is always in force, its limits, and the two policy
 * switches. Each summary names the tab that edits it. Two columns of cards as
 * drawn, stacking below 760px.
 */

import { Switch } from "@invana/forms";
import { Button, PropertyList, PropertyRow } from "@invana/ui";
import { useLensesQuery } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentTab } from "./AgentDetail";
import { type AgentDraft, effortSummary, voiceSummary } from "./agentDraft";
import { tokenBudgetLine } from "./CeilingsTable";
import {
	useAgentMetersQuery,
	useAgentSkillsAndCallablesQuery,
} from "./queries";
import type { Agent } from "./types";

/** The two switches the Overview carries. Keys are the engine's. */
const POLICY_FIELDS: { key: string; label: string; hint: string }[] = [
	{
		key: "can_be_assigned",
		label: "Can be assigned",
		hint: "appears in assignee pickers",
	},
	{ key: "unattended", label: "Unattended", hint: "may run on a schedule" },
];

function GoTo({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<Button variant="link" size="sm" className="h-auto p-0" onClick={onClick}>
			{label}
		</Button>
	);
}

export function AgentOverviewTab({
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
	// Every guardrail that holds on this agent's runs: the Graph's, and its own.
	// Worlds are not here — a world comes with the work.
	const guardrails = useLensesQuery(username, graphSlug, { kind: "guardrail" });
	const inForce = (guardrails.data?.items ?? []).filter(
		(g) => g.scope === "graph" || g.scope === `agent:${agent.id}`,
	);
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const meters = useAgentMetersQuery(username, graphSlug, agent.id);

	const skills = can.data?.skills ?? [];
	const needAttention = skills.filter((s) => s.missing.length).length;
	const m = meters.data;

	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection
					card
					title="Who"
					action={<GoTo label="Soul" onClick={() => onGoTo("soul")} />}
				>
					<PropertyList>
						<PropertyRow label="description">
							{agent.description || (
								<span className="text-muted-foreground">none</span>
							)}
						</PropertyRow>
						<PropertyRow label="soul">
							{agent.soul ? (
								`written · ${agent.soul.length.toLocaleString()} characters`
							) : (
								<span className="text-muted-foreground">
									Invana's default voice
								</span>
							)}
						</PropertyRow>
						<PropertyRow label="voice">
							{voiceSummary(agent.soul_traits)}
						</PropertyRow>
					</PropertyList>
				</PanelSection>

				<PanelSection
					card
					title="Instructions"
					action={
						<GoTo label="Instructions" onClick={() => onGoTo("instructions")} />
					}
				>
					<p
						className={
							agent.instructions ? "leading-relaxed" : "text-muted-foreground"
						}
					>
						{agent.instructions ||
							"No instructions of its own — the Graph's instructions alone."}
					</p>
				</PanelSection>

				<PanelSection
					card
					title="Thinking"
					action={<GoTo label="Thinking" onClick={() => onGoTo("thinking")} />}
				>
					<PropertyList>
						<PropertyRow label="effort">
							{effortSummary(agent.effective_effort)}
						</PropertyRow>
					</PropertyList>
				</PanelSection>

				<PanelSection
					card
					title="Skills"
					action={
						<GoTo label="Skills & callables" onClick={() => onGoTo("skills")} />
					}
				>
					<PropertyList>
						<PropertyRow label="bound">
							{skills.length
								? `${skills.length} skill${skills.length === 1 ? "" : "s"}`
								: "none — the Graph's base plans alone"}
						</PropertyRow>
						{skills.length ? (
							<PropertyRow label="offered">
								{(can.data?.offered ?? 0).toLocaleString()} · applied{" "}
								{(can.data?.applied ?? 0).toLocaleString()}
							</PropertyRow>
						) : null}
						{needAttention ? (
							<PropertyRow label="needs attention">
								<span className="text-warning">
									{needAttention} skill{needAttention === 1 ? "" : "s"} need
									{needAttention === 1 ? "s" : ""} a callable the envelope lacks
								</span>
							</PropertyRow>
						) : null}
					</PropertyList>
				</PanelSection>
			</div>

			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection card title="Always in force">
					{/* An agent binds no provider and no world: what
					    holds whoever asks is the Graph's guardrails and its own, edited in Govern › Guardrails. */}
					{inForce.length ? (
						<ul className="divide-y">
							{inForce.map((g) => (
								<li key={g.id} className="flex items-center gap-2 py-1.5">
									<Shield className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1 truncate">
										{g.display_name}
									</span>
									<span className="shrink-0 text-muted-foreground">
										{g.scope === "graph" ? "the Graph" : "this agent"}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground">
							No guardrails — the Graph has none, and neither does this agent.
						</p>
					)}
				</PanelSection>

				<PanelSection card title="Limits" hint="whoever asks">
					<PropertyList>
						<LimitRow
							label="may run"
							to={
								<GoTo
									label="Skills & callables"
									onClick={() => onGoTo("skills")}
								/>
							}
						>
							{can.data
								? `${can.data.callables.length} callables · ${can.data.plans.length} plan${can.data.plans.length === 1 ? "" : "s"}`
								: "…"}
						</LimitRow>
						<LimitRow
							label="effort"
							to={<GoTo label="Thinking" onClick={() => onGoTo("thinking")} />}
						>
							{effortSummary(agent.effective_effort)}
						</LimitRow>
						<LimitRow
							label="tokens"
							to={<GoTo label="Activity" onClick={() => onGoTo("activity")} />}
						>
							{m ? tokenBudgetLine(m.max_tokens_run) : "…"}
						</LimitRow>
						<LimitRow
							label="at once"
							to={<GoTo label="Activity" onClick={() => onGoTo("activity")} />}
						>
							{m ? `${m.running} of ${m.max_concurrent_runs ?? "∞"} runs` : "…"}
						</LimitRow>
					</PropertyList>
				</PanelSection>

				<PanelSection card title="Policy">
					<PropertyList labelWidth={120}>
						{POLICY_FIELDS.map((field) => {
							const on = draft.policy[field.key];
							const setTo = (next: boolean | undefined) => {
								const policy = { ...draft.policy };
								// Clearing *removes* the key — writing `false` would turn
								// "the Graph decides" into a denial nobody chose.
								if (next === undefined) delete policy[field.key];
								else policy[field.key] = next;
								onPatch({ policy });
							};
							return (
								<PropertyRow key={field.key} label={field.label}>
									<span className="flex min-w-0 items-center gap-3">
										<Switch
											aria-label={field.label}
											checked={on === true}
											onCheckedChange={(next) => setTo(next)}
										/>
										{/* Unset is its own state: the Graph decides. */}
										<span className="min-w-0 flex-1 truncate text-muted-foreground">
											{field.hint}
											{on === undefined ? " · Graph default" : ""}
										</span>
										{on === undefined ? null : (
											<GoTo label="Reset" onClick={() => setTo(undefined)} />
										)}
									</span>
								</PropertyRow>
							);
						})}
					</PropertyList>
				</PanelSection>
			</div>
		</div>
	);
}

/** A limit, and the tab that sets it. */
function LimitRow({
	label,
	to,
	children,
}: {
	label: string;
	to: ReactNode;
	children: ReactNode;
}) {
	return (
		<PropertyRow label={label}>
			<span className="flex items-center gap-3">
				<span className="min-w-0 flex-1">{children}</span>
				<span className="shrink-0">{to}</span>
			</span>
		</PropertyRow>
	);
}
