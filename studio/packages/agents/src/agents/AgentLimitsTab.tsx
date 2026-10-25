/**
 * An agent › **Limits** (board `agents.agent.limits`): a form of the stored
 * limits, each beside the unit it bounds, and what happens at each.
 *
 * - **Budget** — `max_tokens_run` · `max_tokens_month`. A run budget above the
 *   month budget is flagged under the field.
 * - **Delegation** — `policy.can_spawn`, then the four ceilings of one run:
 *   `max_depth` · `max_children` · `max_descendants` (*in all*) ·
 *   `max_live` (*live at once*, past which a helper queues). They bound the
 *   helpers it creates, so they are disabled while it may create none.
 * - **Runs** — `max_concurrent_runs`, across every run it is working.
 * - **Effort** — `max_steps` · `max_replans` · `max_clarifications`.
 *
 * Empty is *the default applies*, never zero: the placeholder is what a run
 * reads where this agent is silent. Edits ride the page's one buffer; Save in
 * the head writes them. Tokens, never currency, and read as a magnitude.
 */

import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	Input,
	Switch,
} from "@invana/forms";
import { PropertyList, PropertyRow } from "@invana/ui";
import { formatCompact } from "@invana-studio/core";
import { useAccess } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import type { AgentDraft } from "./agentDraft";
import { useAgentMetersQuery } from "./queries";
import type { Agent } from "./types";

type Group = "budget" | "effort";

export function AgentLimitsTab({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
}) {
	const meters = useAgentMetersQuery(username, graphSlug, agent.id).data;
	const build = useAccess().gate("build");
	const readOnly = !build.allowed || agent.status === "retired";

	const set = (group: Group, key: string, raw: string) => {
		const next = { ...draft[group] };
		// Clearing removes the key — a zero nobody chose would be a limit.
		if (raw === "") delete next[key];
		else next[key] = Number(raw);
		onPatch({ [group]: next } as Partial<AgentDraft>);
	};
	const effective = (key: string): number | null | undefined =>
		key in agent.effective_effort
			? agent.effective_effort[key as keyof typeof agent.effective_effort]
			: ((meters?.[key as keyof typeof meters] as number | null | undefined) ??
				agent.effective_budget?.[key]);

	const limit = (
		group: Group,
		key: string,
		label: string,
		unit: string,
		opts: { hint?: string; error?: string; off?: boolean } = {},
	) => {
		const own = draft[group][key];
		const fallback = effective(key);
		// A token budget reads as a magnitude — `200k`, never `200000`.
		const shown = (v: number) =>
			unit === "tokens" ? formatCompact(v) : String(v);
		return (
			<Field data-invalid={opts.error ? true : undefined}>
				<FieldLabel htmlFor={`limit-${key}`}>{label}</FieldLabel>
				<div className="flex items-center gap-2">
					<Input
						id={`limit-${key}`}
						type="number"
						min={0}
						className="w-32 shrink-0 font-mono"
						disabled={readOnly || opts.off}
						aria-invalid={opts.error ? true : undefined}
						value={own ?? ""}
						placeholder={fallback != null ? shown(fallback) : "—"}
						onChange={(e) => set(group, key, e.target.value)}
					/>
					<span className="text-sm text-muted-foreground">{unit}</span>
				</div>
				{opts.error ? <FieldError>{opts.error}</FieldError> : null}
				{unit === "tokens" && own != null ? (
					<FieldDescription>
						{shown(own)} tokens{opts.hint ? ` · ${opts.hint}` : ""}
					</FieldDescription>
				) : opts.hint ? (
					<FieldDescription>{opts.hint}</FieldDescription>
				) : null}
			</Field>
		);
	};

	const run = draft.budget.max_tokens_run ?? meters?.max_tokens_run;
	const month = draft.budget.max_tokens_month ?? meters?.max_tokens_month;
	const runOverMonth =
		run != null && month != null && run > month
			? `A run may spend ${formatCompact(run)}, more than the ${formatCompact(month)} a month allows.`
			: undefined;
	const canSpawn = draft.policy.can_spawn === true;

	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection card title="Budget">
					<div className="grid gap-3 @[560px]:grid-cols-2">
						{limit("budget", "max_tokens_run", "A run", "tokens", {
							hint: "children are paid from it",
							error: runOverMonth,
						})}
						{limit("budget", "max_tokens_month", "A month", "tokens")}
					</div>
				</PanelSection>

				<PanelSection card title="Delegation">
					<div className="flex flex-col gap-3">
						<Field orientation="horizontal">
							<Switch
								id="limit-can-spawn"
								checked={canSpawn}
								disabled={readOnly}
								onCheckedChange={(on) => {
									const policy = { ...draft.policy };
									policy.can_spawn = on;
									onPatch({ policy });
								}}
							/>
							<FieldLabel htmlFor="limit-can-spawn">
								May create helpers
							</FieldLabel>
						</Field>
						<div className="grid gap-3 @[560px]:grid-cols-3">
							{limit("budget", "max_depth", "Depth", "levels", {
								off: !canSpawn,
							})}
							{limit("budget", "max_children", "Children", "an agent", {
								off: !canSpawn,
							})}
							{limit("budget", "max_descendants", "In all", "helpers", {
								off: !canSpawn,
								hint: "the whole tree of one run",
							})}
						</div>
						{limit("budget", "max_live", "Live at once", "agents", {
							off: !canSpawn,
							hint: "the rest queue; a large run goes as fast as this and the pools allow",
						})}
					</div>
				</PanelSection>

				<PanelSection card title="Runs">
					{limit("budget", "max_concurrent_runs", "At once", "runs", {
						hint: "across every run it is working; past it the next run is refused",
					})}
				</PanelSection>
			</div>

			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection card title="Effort">
					<div className="grid gap-3 @[560px]:grid-cols-3">
						{limit("effort", "max_steps", "Steps", "a plan")}
						{limit("effort", "max_replans", "Replans", "a run")}
						{limit("effort", "max_clarifications", "Questions", "a run", {
							hint: "0 never asks",
						})}
					</div>
				</PanelSection>

				<PanelSection card title="When it reaches a limit">
					<PropertyList labelWidth={150}>
						<PropertyRow label="Budget">
							drawn against — a run is not stopped part way
						</PropertyRow>
						<PropertyRow label="Depth · children · in all">
							the spawn is refused, naming the limit; the parent carries on
						</PropertyRow>
						<PropertyRow label="Live at once">
							the helper waits, queued, until another ends
						</PropertyRow>
						<PropertyRow label="Runs at once">
							the next run is refused at admission, naming the agent
						</PropertyRow>
						<PropertyRow label="Effort">
							a plan over its steps or replans is refused before it runs
						</PropertyRow>
					</PropertyList>
				</PanelSection>
			</div>
		</div>
	);
}
