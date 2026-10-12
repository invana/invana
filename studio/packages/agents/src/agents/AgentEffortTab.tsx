/**
 * Thinking — the model version the agent thinks with, and its effort.
 *
 * No default stance yet: it ships with stances themselves, and until they are
 * rows with an author and a version this tab carries the model and effort
 * only. Effort is `agents.effort`, edited here and saved with the page.
 *
 * **Model version** is not in the page's Save. A pin names an exact version
 * (`claude-opus-5-5`) from the Graph's endpoints, so a provider's new release
 * changes nothing until a person moves it — and moving it is its own act,
 * with a reason, gated by the agent's evals (AG-14). Unpinned, the world's
 * cast decides. Clearing a pin is not offered: the engine cannot gate it yet.
 */

import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Button, PropertyList, PropertyRow } from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { useState } from "react";
import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import { useLLMProvidersQuery } from "../llms/queries";
import type { AgentDraft } from "./agentDraft";
import { CeilingsTable } from "./CeilingsTable";
import { useAgentMutations } from "./queries";
import type { Agent } from "./types";

export function AgentEffortTab({
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
	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-2">
			<ModelPin username={username} graphSlug={graphSlug} agent={agent} />

			<PanelSection card title="Effort">
				{/* The placeholder is what a run reads where this agent is silent —
				    the default, or a number still carried on the old columns. */}
				<CeilingsTable
					group="effort"
					values={draft.effort}
					effective={agent.effective_effort}
					onChange={(effort) => onPatch({ effort })}
				/>
			</PanelSection>
		</div>
	);
}

function ModelPin({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const providers = useLLMProvidersQuery(username, graphSlug);
	const m = useAgentMutations(username, graphSlug);
	const evals = useEvalMutations(username, graphSlug, "agent", agent.id);
	const [picked, setPicked] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	// Every model address the Graph's endpoints offer, once each — what a pin stores.
	const versions = [
		...new Set(
			(providers.data?.items ?? []).flatMap((p) =>
				p.models.map((x) => x.address),
			),
		),
	].sort();
	const close = () => {
		m.pin.reset();
		setConfirming(false);
		setPicked(null);
	};

	return (
		<PanelSection
			card
			title="Model version"
			hint="an exact version name; an upgrade is a choice"
		>
			<div className="flex flex-col gap-2">
				<PropertyList labelWidth={90}>
					<PropertyRow label="pinned" mono>
						{agent.model_pin ?? "none — the world's cast decides"}
					</PropertyRow>
				</PropertyList>
				<Label htmlFor="agent-model-pin" className="text-muted-foreground">
					Move to
				</Label>
				<span className="flex items-center gap-1">
					<Select value={picked ?? ""} onValueChange={(v) => setPicked(v)}>
						<SelectTrigger id="agent-model-pin" className="w-64">
							<SelectValue placeholder="Pick a version" />
						</SelectTrigger>
						<SelectContent>
							{versions
								.filter((v) => v !== agent.model_pin)
								.map((v) => (
									<SelectItem key={v} value={v}>
										{v}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</span>
				{versions.length === 0 && !providers.isLoading ? (
					<p className="text-muted-foreground">
						No endpoint offers a model yet — add one under LLMs.
					</p>
				) : null}
				<p className="text-sm text-muted-foreground">
					Moving it replays the agent's evals on the new version first, and is
					kept in History.
				</p>
				{picked ? (
					<Button
						size="xs"
						className="self-start"
						onClick={() => setConfirming(true)}
					>
						Move to {picked}
					</Button>
				) : null}
			</div>
			<GatedActDialog
				open={confirming && !!picked}
				title={`Pin ${agent.name} to ${picked}`}
				description="Its next run thinks with this version; a run in flight finishes on the old one."
				confirm={`Pin ${picked}`}
				pending={m.pin.isPending}
				error={m.pin.error}
				onConfirm={(why) =>
					m.pin.mutate(
						{ id: agent.id, modelPin: picked as string, why },
						{ onSuccess: close },
					)
				}
				onClose={close}
				onRunEvals={() =>
					evals.open.mutate({
						model_pin: picked,
						side: "draft",
						trigger: "pin",
					})
				}
				runningEvals={evals.open.isPending}
			/>
		</PanelSection>
	);
}
