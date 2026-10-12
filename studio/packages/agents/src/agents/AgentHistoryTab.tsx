/**
 * An agent › **History** (board `agents.agent.history`, AG-06): every change
 * to its instructions, soul, skills and limits, with what happened after.
 *
 * *As a builder, I want an agent's history with performance before and
 * after, so that tuning is measured, not guessed.*
 *
 * A row that changed the instructions offers *Restore*: a new version with
 * the text as it read then, asked for with a reason and gated by the agent's
 * evals like a publish. Nothing is rewritten.
 */

import { ActButton } from "@invana-studio/shell";
import { useState } from "react";
import { ChangesTable } from "../changes/ChangesTable";
import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import { useAgentMutations } from "./queries";
import type { Agent } from "./types";

export function AgentHistoryTab({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const m = useAgentMutations(username, graphSlug);
	const evals = useEvalMutations(username, graphSlug, "agent", agent.id);
	const [restoring, setRestoring] = useState<number | null>(null);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<ChangesTable
				username={username}
				graphSlug={graphSlug}
				kind="agent"
				recordId={agent.id}
				act={(e, latest) =>
					!latest && e.summary.includes("instructions") ? (
						<ActButton
							area="build"
							size="xs"
							variant="ghost"
							onClick={() => setRestoring(Number(e.version))}
						>
							Restore
						</ActButton>
					) : null
				}
			/>
			<GatedActDialog
				open={restoring !== null}
				title={`Restore the instructions of v${restoring}`}
				description={`Makes v${agent.version + 1} with the instructions as they read at v${restoring}; nothing is rewritten.`}
				confirm={`Restore v${restoring}`}
				pending={m.rollback.isPending}
				error={m.rollback.error}
				onConfirm={(why) =>
					m.rollback.mutate(
						{ id: agent.id, version: restoring as number, why },
						{ onSuccess: () => setRestoring(null) },
					)
				}
				onClose={() => {
					m.rollback.reset();
					setRestoring(null);
				}}
				onRunEvals={() =>
					evals.open.mutate({
						version: restoring,
						side: "draft",
						trigger: "rollback",
					})
				}
				runningEvals={evals.open.isPending}
			/>
		</div>
	);
}
