/**
 * The agent's page as a page in `mainSection` — `agent:<id>` on the strip.
 *
 * This is the host half: which agent (read by id, so a draft or a retired
 * agent opens), whether it is the Graph default, and the writes — Save,
 * Create agent, pause, resume, retire, make default. {@link AgentDetail} is
 * the page itself. Pause and Retire go through one confirm that names the
 * open work they would disturb; *Create agent* goes through the eval gate,
 * and a refusal opens the gated confirm with the engine's words. *Discard
 * draft* deletes a draft after a confirm and returns to the Agents list; a
 * refusal reopens the confirm with the engine's words.
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	RecordHeader,
} from "@invana/ui";
import { Bot } from "lucide-react";
import { useContext, useState } from "react";
import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import { AgentsOpenContext } from "../open";
import { AgentDetail } from "./AgentDetail";
import { TabReadState } from "./agentParts";
import { LifecycleDialog } from "./LifecycleDialog";
import {
	useAgentMutations,
	useAgentQuery,
	useAgentsQuery,
	useLifecyclePreviewQuery,
} from "./queries";
import type { LifecycleAct } from "./types";

/** One row is enough: the page reads `default_agent_id`, not the list. */
const DEFAULT_ONLY = { limit: 1 };

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
	const query = useAgentQuery(username, graphSlug, agentId);
	const defaults = useAgentsQuery(username, graphSlug, DEFAULT_ONLY);
	const mutations = useAgentMutations(username, graphSlug);
	const evals = useEvalMutations(username, graphSlug, "agent", agentId);
	const [confirming, setConfirming] = useState<LifecycleAct | null>(null);
	const [gated, setGated] = useState(false);
	const [discarding, setDiscarding] = useState(false);
	const open = useContext(AgentsOpenContext);
	const preview = useLifecyclePreviewQuery(
		username,
		graphSlug,
		confirming ? agentId : undefined,
		confirming ?? undefined,
	);

	const agent = query.data;
	if (!agent)
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RecordHeader variant="page" icon={<Bot />} crumbs={["Agents"]} />
				<TabReadState
					loading={query.isLoading}
					error={query.error ?? new Error("This agent is not in the Graph.")}
					what="this agent"
					onRetry={() => void query.refetch()}
				/>
			</div>
		);

	const makeLive = (why: string) =>
		mutations.makeLive.mutate(
			{ id: agent.id, why },
			{
				onSuccess: () => setGated(false),
				onError: () => setGated(true),
			},
		);

	const discard = () =>
		mutations.discard
			.mutateAsync(agent.id)
			.then(() => {
				setDiscarding(false);
				open?.section("agents");
			})
			.catch(() => setDiscarding(true));

	return (
		<>
			<AgentDetail
				username={username}
				graphSlug={graphSlug}
				agent={agent}
				isDefault={agent.id === defaults.data?.default_agent_id}
				isSaving={mutations.update.isPending}
				saveError={mutations.update.error}
				onSave={(data) => mutations.update.mutate({ id: agent.id, data })}
				onCreate={() => makeLive("")}
				creating={mutations.makeLive.isPending}
				onDiscard={() => {
					mutations.discard.reset();
					setDiscarding(true);
				}}
				discarding={mutations.discard.isPending}
				onPause={() => setConfirming("pause")}
				onResume={() => mutations.resume.mutate(agent.id)}
				onRetire={() => setConfirming("retire")}
				onSetDefault={() => mutations.setDefault.mutate(agent.id)}
				onOpenLineage={() => onOpenLineage(agent.id)}
				onOpenEnvelope={() => onOpenEnvelope(agent.id)}
			/>
			<LifecycleDialog
				agent={confirming ? agent : null}
				act={confirming}
				items={preview.data?.items}
				isLoading={preview.isLoading}
				onCancel={() => setConfirming(null)}
				onConfirm={(why) => {
					if (confirming === "retire")
						mutations.retire.mutate({ id: agent.id, why: why || undefined });
					else if (confirming === "pause") mutations.pause.mutate(agent.id);
					setConfirming(null);
				}}
			/>
			<AlertDialog open={discarding} onOpenChange={setDiscarding}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard {agent.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{mutations.discard.error instanceof Error
								? mutations.discard.error.message
								: "A draft never ran, so it is deleted: its instructions, soul, limits and skill bindings go with it."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutations.discard.isPending}
							onClick={() => void discard()}
						>
							Discard draft
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<GatedActDialog
				open={gated}
				title={`Create ${agent.name}`}
				description="It goes live as v1: it can be assigned, scheduled and asked once it is created."
				confirm="Create agent"
				pending={mutations.makeLive.isPending}
				error={mutations.makeLive.error}
				onConfirm={makeLive}
				onClose={() => {
					mutations.makeLive.reset();
					setGated(false);
				}}
				onRunEvals={() => evals.open.mutate({ side: "draft" })}
				runningEvals={evals.open.isPending}
			/>
		</>
	);
}
