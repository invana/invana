/**
 * The agent's page, as a page in `mainSection` — `agent:<id>` on the
 * strip, the Agents list left beside it in `leftSection`.
 *
 * This is the host half: which agent, whether it is the Graph default, and the
 * writes — Save, bind, pause, resume, retire, make default. {@link AgentDetail}
 * is the page itself. Pause and Retire go through the same confirm the section
 * uses, naming the open work they would disturb.
 */

import { EmptyState, Spinner } from "@invana/ui";
import { useState } from "react";
import { AgentDetail } from "@/pages/graphs-detail/features/agents/AgentDetail";
import { LifecycleDialog } from "@/pages/graphs-detail/features/agents/LifecycleDialog";
import {
	useAgentMutations,
	useAgentsQuery,
	useLifecyclePreviewQuery,
} from "@/pages/graphs-detail/features/agents/queries";
import type { LifecycleAct } from "@/pages/graphs-detail/features/agents/types";

export function AgentBoardPage({
	username,
	graphSlug,
	agentId,
	onOpenLineage,
	onOpenEnvelope,
}: {
	username: string;
	graphSlug: string;
	agentId: string;
	onOpenLineage: (agentId: string) => void;
	onOpenEnvelope: (agentId: string) => void;
}) {
	// The same list the section reads, so the page and the row never disagree
	// about status or default — and a retired or ephemeral agent still opens.
	const query = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const mutations = useAgentMutations(username, graphSlug);
	const [confirming, setConfirming] = useState<LifecycleAct | null>(null);
	const preview = useLifecyclePreviewQuery(
		username,
		graphSlug,
		confirming ? agentId : undefined,
		confirming ?? undefined,
	);

	const agent = query.data?.items.find((a) => a.id === agentId) ?? null;
	if (query.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!agent)
		return (
			<EmptyState
				className="h-full"
				title="This agent is not in the Graph"
				description="It may have been removed. Close this page, or pick an agent in the Agents list."
			/>
		);

	return (
		<>
			<AgentDetail
				username={username}
				graphSlug={graphSlug}
				agent={agent}
				isDefault={agent.id === query.data?.default_agent_id}
				isSaving={mutations.update.isPending}
				saveError={mutations.update.error}
				onSave={(data) => mutations.update.mutate({ id: agent.id, data })}
				onPause={() => setConfirming("pause")}
				onResume={() => mutations.resume.mutate(agent.id)}
				onRetire={() => setConfirming("retire")}
				onSetDefault={() => mutations.setDefault.mutate(agent.id)}
				onOpenLineage={() => onOpenLineage(agent.id)}
				onOpenEnvelope={() => onOpenEnvelope(agent.id)}
				onBindSkill={(skillId) => {
					// Cleared first, so the card under the skill is this pick's
					// refusal and never the last one's.
					mutations.bindSkill.reset();
					mutations.bindSkill.mutate({ id: agent.id, skillId });
				}}
				onUnbindSkill={(skillId) => {
					mutations.bindSkill.reset();
					mutations.unbindSkill.mutate({ id: agent.id, skillId });
				}}
				bindError={mutations.bindSkill.error}
				isBinding={
					mutations.bindSkill.isPending || mutations.unbindSkill.isPending
				}
			/>
			<LifecycleDialog
				agent={confirming ? agent : null}
				act={confirming}
				items={preview.data?.items}
				isLoading={preview.isLoading}
				onCancel={() => setConfirming(null)}
				onConfirm={() => {
					if (confirming === "retire")
						mutations.retire.mutate({ id: agent.id });
					else if (confirming === "pause") mutations.pause.mutate(agent.id);
					setConfirming(null);
				}}
			/>
		</>
	);
}
