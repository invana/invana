/**
 * *New agent* — opens a **draft** named `untitled` on Overview, the builder.
 * A draft is offered no work until *Create agent*.
 *
 * Agent names are unique in a Graph, so a second click never mints a second
 * `untitled`: when the Graph already has an `untitled` draft, the click opens
 * that one, and only otherwise creates it. Renaming the draft frees the name.
 * Drawn on Agents and on Fleet; a refusal is shown beside the act.
 */

import { ActButton } from "@invana-studio/shell";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAgentsOpen } from "../open";
import { agentsApi } from "./api";
import { useAgentMutations } from "./queries";

const UNTITLED = "untitled";

export function NewAgentButton({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const { create } = useAgentMutations(username, graphSlug);
	const start = useMutation({
		mutationFn: async () => {
			const drafts = await agentsApi.list(username, graphSlug, {
				q: UNTITLED,
				filters: { status: ["draft"] },
				limit: 20,
			});
			const found = drafts.items.find((a) => a.name === UNTITLED);
			return found ?? (await create.mutateAsync({ name: UNTITLED }));
		},
		onSuccess: (agent) => open.agent(agent.id),
	});
	return (
		<span className="flex items-center gap-2">
			{start.error ? (
				<span role="alert" className="text-sm text-destructive">
					{start.error instanceof Error
						? start.error.message
						: "The agent was not created."}
				</span>
			) : null}
			<ActButton
				area="build"
				size="sm"
				disabled={start.isPending}
				onClick={() => start.mutate()}
			>
				<Plus /> {start.isPending ? "Opening…" : "New agent"}
			</ActButton>
		</span>
	);
}
