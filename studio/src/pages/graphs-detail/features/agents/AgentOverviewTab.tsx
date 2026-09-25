/**
 * Overview — the agent read whole (AG23): who it is, its focus, how it thinks,
 * what it can do, what is always in force, its limits, and the two policy
 * switches. Each summary names the tab that edits it.
 */

import { useLensQuery, useLensesQuery } from "@/hooks/queries/useGovern";
import {
	useAgentMetersQuery,
	useAgentSkillsAndCallablesQuery,
} from "@/hooks/queries/useWork";
import type { AgentTab } from "@/pages/graphs-detail/features/agents/AgentDetail";
import {
	type AgentDraft,
	effortSummary,
	usd,
	voiceSummary,
} from "@/pages/graphs-detail/features/agents/agentDraft";
import type { Agent } from "@/types/work";
import { PanelSection } from "@/ui/PanelSection";
import { PolicyFlag } from "@/ui/PolicyFlag";
import { Button, CastTable, PropertyList, PropertyRow } from "@invana/ui";

/** The two switches the Overview carries (AG23). Keys are the engine's. */
export const POLICY_FIELDS: { key: string; label: string; hint: string }[] = [
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
	// The agent's own guardrail and the cast it resolves to — an agent binds no
	// world (AG26). The record never waits on the resolution (WO12).
	const ownGuardrail = useLensQuery(
		username,
		graphSlug,
		agent.guardrail_id ?? undefined,
	);
	// Every guardrail that holds on this agent's runs: the Graph's, and its own
	// (AG7). Worlds are not here — a world comes with the work (AG24).
	const guardrails = useLensesQuery(username, graphSlug, { kind: "guardrail" });
	const inForce = (guardrails.data?.items ?? []).filter(
		(g) => g.scope === "graph" || g.scope === `agent:${agent.id}`,
	);
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const meters = useAgentMetersQuery(username, graphSlug, agent.id);

	const skills = can.data?.skills ?? [];
	const offered = skills.reduce((n, s) => n + s.offered, 0);
	const applied = skills.reduce((n, s) => n + s.applied, 0);
	const needAttention = skills.filter((s) => s.missing.length).length;
	const m = meters.data;

	return (
		<>
			<PanelSection
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
				title="Focus"
				hint="after the Graph's instructions"
				action={<GoTo label="Thinking" onClick={() => onGoTo("thinking")} />}
			>
				<p className={agent.instructions ? undefined : "text-muted-foreground"}>
					{agent.instructions ||
						"No focus of its own — the Graph's instructions alone."}
				</p>
			</PanelSection>

			<PanelSection
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
							{offered.toLocaleString()} · applied {applied.toLocaleString()}
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

			<PanelSection title="Always in force" hint="whoever asks">
				{/* **An agent binds no provider and no world** (PM1 · AG24). What
				    holds whoever asks is the Graph's guardrails and its own (AG7 ·
				    AG10), edited in Govern › Guardrails. */}
				{inForce.length ? (
					<PropertyList labelWidth={96}>
						{inForce.map((g) => (
							<PropertyRow
								key={g.id}
								label={g.scope === "graph" ? "the Graph" : "this agent"}
							>
								{g.display_name}
							</PropertyRow>
						))}
					</PropertyList>
				) : (
					<p className="text-muted-foreground">
						No guardrails — the Graph has none, and neither does this agent.
					</p>
				)}
				{agent.guardrail_id ? (
					<CastTable
						className="mt-2"
						readOnly
						cast={ownGuardrail.data?.cast}
						resolved={ownGuardrail.data?.cast_resolved?.map((row) => ({
							role: row.role,
							address: row.address,
							allowed: row.allowed,
							ruleMatched: row.rule_matched,
							// *Which contributor won* is a fact about a run; a lens read
							// on its own has one contributor, and `shipped` is the only
							// source that means anything here.
							source: row.source === "shipped" ? "shipped" : undefined,
						}))}
					/>
				) : (
					<p className="mt-1.5 text-sm text-muted-foreground">
						No guardrail of its own. Each run is bounded by the world its
						session or Todo brings, inside the Graph's guardrails.
					</p>
				)}
			</PanelSection>

			<PanelSection title="Limits" hint="whoever asks">
				<PropertyList>
					<PropertyRow label="may run">
						{can.data
							? `${can.data.callables.length} callables · ${can.data.plans.length} plan${can.data.plans.length === 1 ? "" : "s"}`
							: "…"}
					</PropertyRow>
					<PropertyRow label="effort">
						{effortSummary(agent.effective_effort)}
					</PropertyRow>
					<PropertyRow label="spend">
						{m?.max_cost_usd_month == null
							? "no monthly ceiling"
							: m.spend_this_month == null
								? `nothing priced · of ${usd(m.max_cost_usd_month)} this month`
								: `${usd(m.spend_this_month)} of ${usd(m.max_cost_usd_month)} this month`}
					</PropertyRow>
					<PropertyRow label="at once">
						{m ? `${m.running} of ${m.max_concurrent_runs ?? "∞"} runs` : "…"}
					</PropertyRow>
				</PropertyList>
			</PanelSection>

			<PanelSection
				title="Policy"
				hint="a dash means the Graph default applies"
			>
				<PropertyList labelWidth={120}>
					{POLICY_FIELDS.map((field) => (
						<PropertyRow key={field.key} label={field.label}>
							<PolicyFlag
								label={field.hint}
								on={draft.policy[field.key]}
								onToggle={(next) => {
									const policy = { ...draft.policy };
									// Clearing *removes* the key — writing `false` would turn
									// "the Graph decides" into a denial nobody chose.
									if (next === undefined) delete policy[field.key];
									else policy[field.key] = next;
									onPatch({ policy });
								}}
							/>
						</PropertyRow>
					))}
				</PropertyList>
			</PanelSection>
		</>
	);
}
