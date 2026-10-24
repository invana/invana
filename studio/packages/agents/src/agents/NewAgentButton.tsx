/**
 * *New agent* — creates a **draft** named `untitled` and opens its page on
 * Overview, the builder. A draft is offered no work until *Create agent*.
 * Drawn on Agents and on Fleet; a refusal is shown beside the act.
 */

import { ActButton } from "@invana-studio/shell";
import { Plus } from "lucide-react";
import { useAgentsOpen } from "../open";
import { useAgentMutations } from "./queries";

export function NewAgentButton({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const { create } = useAgentMutations(username, graphSlug);
	return (
		<span className="flex items-center gap-2">
			{create.error ? (
				<span role="alert" className="text-sm text-destructive">
					{create.error instanceof Error
						? create.error.message
						: "The agent was not created."}
				</span>
			) : null}
			<ActButton
				area="build"
				size="sm"
				disabled={create.isPending}
				onClick={() =>
					create.mutate(
						{ name: "untitled" },
						{ onSuccess: (agent) => open.agent(agent.id) },
					)
				}
			>
				<Plus /> {create.isPending ? "Creating…" : "New agent"}
			</ActButton>
		</span>
	);
}
