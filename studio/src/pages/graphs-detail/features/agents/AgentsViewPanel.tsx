/**
 * **Agents** — one rail icon, one panel, two sections
 * ([PM6](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md) ·
 * [GV18](../../../../../docs/for-developers/modules/govern/spec.md) · G32 · G33).
 *
 * `Agents` over `LLMs`, stacked, with no panel header above them: the first
 * section header is the top of the column, and the breadcrumb already says which
 * panel is open (G16).
 *
 * **The agents lead, and the endpoints are one section down.** A person arrives
 * at Agents to see who is working; they reach the LLMs section from a cast that
 * names an endpoint, or from a refusal saying the Graph offers no model. The
 * providers were a tab of Graph settings while an agent bound one — an agent
 * binds no provider now ([PM1](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)),
 * and what it resolves against belongs beside it.
 *
 * **The lenses are read here, once.** The LLMs section needs *who casts this
 * model* to say whether removing one is safe (PM11), and that is the same list
 * Govern draws — one query, read where it is needed, never a counter on the
 * model row.
 */

import { useLensesQuery } from "@/hooks/queries/useGovern";
import { useLLMProvidersQuery } from "@/hooks/queries/useLLMProviders";
import { useAgentsQuery } from "@/hooks/queries/useWork";
import {
	type AgentFilters,
	NO_AGENT_FILTERS,
	agentsSection,
	visibleAgents,
} from "@/pages/graphs-detail/features/agents/AgentsSection";
import { llmsSection } from "@/pages/graphs-detail/features/llms/LlmsSection";
import { useStackSectionUi } from "@/pages/graphs-detail/shared/StackSection";
import {
	type AgentsSectionKey,
	useAgentsViewPanel,
} from "@/pages/graphs-detail/shell/useAgentsViewPanel";
import type { AgentEdge } from "@/types/work";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { useEffect, useRef, useState } from "react";

export interface AgentsViewPanelProps {
	username: string;
	graphSlug: string;
	/** The agent the canvas is drawing. Selection, not the drill-in. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	/** Opens the agent's page in `mainSection` (AG34). */
	onOpenAgentPage: (id: string) => void;
	selectedEdge?: AgentEdge | null;
	onOpenLineage?: (agentId: string) => void;
	onOpenTask?: (taskId: string) => void;
	onNewAgent?: () => void;
}

export function AgentsViewPanel({
	username,
	graphSlug,
	selectedAgentId,
	onSelectAgent,
	onOpenAgentPage,
	selectedEdge,
	onOpenLineage,
	onOpenTask,
	onNewAgent,
}: AgentsViewPanelProps) {
	const agents = useAgentsViewPanel();
	const ui = useStackSectionUi();
	const providers = useLLMProvidersQuery(username, graphSlug);
	const lenses = useLensesQuery(username, graphSlug);
	// Held here, not in the list: the funnel in the section's header and the
	// rows under it read the same filters, and the count beside the title is
	// the rows they leave (AG36).
	const [filters, setFilters] = useState<AgentFilters>(NO_AGENT_FILTERS);
	const agentList = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const count = agentList.data
		? visibleAgents(agentList.data.items, filters).length
		: undefined;

	// `PanelStack` reads `defaultSize` at **mount**, so this is the opening split
	// only (G35) — after that it is the reader's. **A Graph has many agents and
	// two or three endpoints**, so the split is not even.
	const size = (d: AgentsSectionKey) =>
		d === "agents"
			? agents.sectionKey === "agents"
				? "72%"
				: "45%"
			: agents.sectionKey === "llms"
				? "55%"
				: "28%";

	// A drill-in expands the section holding it — the URL now names something to
	// look at, and rendering it into a collapsed section makes the click look
	// like it did nothing (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		agents.sectionKey === "agents" ? agents.agentId : agents.providerId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(agents.sectionKey);
	}, [agents.sectionKey, focused]);

	// `&agent=` was the drill-in when the page lived in this section. A link that
	// still carries it opens the page, and the key is dropped — read, never
	// written (AG34).
	//
	// **Two writes, one after the other.** Dropping `&agent=` and opening the
	// page (`?page=`) are two writers of one query string; in one tick the
	// second is composed against the string as it was before the first, and
	// `?page=` is lost. So the key is dropped first, and the page opens once that
	// write has landed — the same order Govern's drill-in keeps (WO15).
	const legacyAgentId = agents.agentId;
	const { openAgent } = agents;
	const pendingPage = useRef<string | null>(null);
	useEffect(() => {
		if (legacyAgentId) {
			pendingPage.current = legacyAgentId;
			openAgent(null);
			return;
		}
		if (!pendingPage.current) return;
		const id = pendingPage.current;
		pendingPage.current = null;
		onOpenAgentPage(id);
	}, [legacyAgentId, onOpenAgentPage, openAgent]);

	return (
		<PanelStack
			withHandle
			stackRef={stackRef}
			className="h-full"
			headerHeight={30}
			sections={[
				agentsSection({
					ui,
					filters,
					onFilters: setFilters,
					count,
					username,
					graphSlug,
					onOpenAgentPage,
					selectedAgentId,
					onSelectAgent,
					selectedEdge,
					onOpenLineage,
					onOpenTask,
					onNewAgent,
					defaultSize: size("agents"),
				}),
				llmsSection({
					ui,
					username,
					graphSlug,
					items: providers.data?.items ?? [],
					isLoading: providers.isLoading,
					error: providers.error,
					lenses: lenses.data?.items ?? [],
					providerId: agents.providerId,
					onOpenProvider: agents.openProvider,
					defaultSize: size("llms"),
				}),
			]}
		/>
	);
}
