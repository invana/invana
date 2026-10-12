import { useStackSections } from "@invana-studio/shell";
import { useCallback } from "react";

// **Agents** is one rail icon over a stack of one section — the agents. The
// endpoints their casts resolve against are the LLMs page, a rail item of its
// own (fleet-performance.md).
type AgentsSectionKey = "agents";

const AGENTS_SECTION_KEYS: readonly AgentsSectionKey[] = ["agents"];

// `agent` is read only — an old link to the drill-in the agent's page used to
// be; the page is `?page=agent:<id>` now.
const AGENTS_DETAIL_PARAM: Record<AgentsSectionKey, string> = {
	agents: "agent",
};

/**
 * URL-backed state for the Agents panel.
 *
 * - `agentId` — the legacy `&agent=` drill-in, if a link still carries it.
 * - `openAgent(id)` — write it; `null` drops it.
 *
 * **Drilling in is not selecting.** A row click states the agent beside the
 * list and paints the canvas; the agent's page is what survives a reload.
 */
export function useAgentsViewPanel() {
	const stack = useStackSections<AgentsSectionKey>({
		sectionKeys: AGENTS_SECTION_KEYS,
		detailParam: AGENTS_DETAIL_PARAM,
	});

	const openAgent = useCallback(
		(id: string | null) => stack.open("agents", id),
		[stack.open],
	);

	return { agentId: stack.detail.agents, openAgent };
}
