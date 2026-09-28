import { useCallback } from "react";
import { useStackSections } from "@/pages/graphs-detail/shared/useStackSections";

// **Agents** is one rail icon over a stack of two sections — the list, and the
// endpoints its casts resolve against
// ([PM6](docs/for-developers/modules/agents/features/providers-and-models.md) ·
// [GV18](docs/for-developers/modules/govern/spec.md)). A provider is what an
// agent's cast resolves against, so it is read where agents are rather than in
// a tab of Graph settings.
//
// **The agents section leads**, as every stack's top section does: a person arrives at
// Agents to see who is working, and reaches the LLMs section from a cast that
// names an endpoint or from a refusal that says none is configured.
export type AgentsSectionKey = "agents" | "llms";

export const AGENTS_SECTION_KEYS: readonly AgentsSectionKey[] = [
	"agents",
	"llms",
];

// One key per section, named for the record rather than for the section, so a
// link says what it opens. `agent` is read only — an old link to the drill-in
// the agent's page used to be; the page is `?page=agent:<id>` now (AG34) — and
// `provider` is one configured endpoint and the models it offers.
const AGENTS_DETAIL_PARAM: Record<AgentsSectionKey, string> = {
	agents: "agent",
	llms: "provider",
};

/**
 * URL-backed state for the Agents panel's two sections.
 *
 * - `sectionKey` — which section holds the height. Defaults to `agents`.
 * - `agentId` · `providerId` — what is drilled into, per section.
 * - `focus(d)` — give a section the height.
 * - `openAgent` / `openProvider` — drill in; `null` goes back to the list.
 *
 * **Drilling in is not selecting.** A row click states the agent beside the
 * list and paints the canvas; `Open` is what writes `&agent=`, which is the
 * gesture that survives a reload.
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
	const openProvider = useCallback(
		(id: string | null) => stack.open("llms", id),
		[stack.open],
	);

	return {
		sectionKey: stack.sectionKey,
		focus: stack.focus,
		agentId: stack.detail.agents,
		providerId: stack.detail.llms,
		openAgent,
		openProvider,
	};
}
