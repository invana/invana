import { useDrawerStack } from "@/pages/graphs-detail/shell/useDrawerStack";
import { useCallback } from "react";

// **Agents** is one rail icon over a stack of two drawers — the list, and the
// endpoints its casts resolve against
// ([PM6](docs/for-developers/modules/agents/features/providers-and-models.md) ·
// [GV18](docs/for-developers/modules/govern/spec.md)). A provider is what an
// agent's cast resolves against, so it is read where agents are rather than in
// a tab of Graph settings.
//
// **The agents drawer leads**, as every stack's top drawer does: a person arrives at
// Agents to see who is working, and reaches the LLMs drawer from a cast that
// names an endpoint or from a refusal that says none is configured.
export type AgentsDrawer = "agents" | "llms";

export const AGENTS_DRAWERS: readonly AgentsDrawer[] = ["agents", "llms"];

// One key per drawer, named for the record rather than for the drawer, so a
// link says what it opens. `agent` is the agent's own surface — its three
// bounds — and `provider` is one configured endpoint and the models it offers.
const AGENTS_DETAIL_PARAM: Record<AgentsDrawer, string> = {
	agents: "agent",
	llms: "provider",
};

/**
 * URL-backed state for the Agents panel's two drawers.
 *
 * - `drawer` — which drawer holds the height. Defaults to `agents`.
 * - `agentId` · `providerId` — what is drilled into, per drawer.
 * - `focus(d)` — give a drawer the height.
 * - `openAgent` / `openProvider` — drill in; `null` goes back to the list.
 *
 * **Drilling in is not selecting.** A row click states the agent beside the
 * list and paints the canvas; `Open` is what writes `&agent=`, which is the
 * gesture that survives a reload.
 */
export function useAgentsPanel() {
	const stack = useDrawerStack<AgentsDrawer>({
		drawers: AGENTS_DRAWERS,
		detailParam: AGENTS_DETAIL_PARAM,
	});

	const openAgent = useCallback(
		(id: string | null) => stack.open("agents", id),
		[stack.open],
	);
	const openProvider = useCallback(
		(id: string | null) => stack.open("llms", id),
		[stack.open],
	);

	return {
		drawer: stack.drawer,
		focus: stack.focus,
		agentId: stack.detail.agents,
		providerId: stack.detail.llms,
		openAgent,
		openProvider,
	};
}
