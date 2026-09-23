/**
 * **Agents** — one rail icon, one panel, two drawers
 * ([PM6](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md) ·
 * [GV18](../../../../../docs/for-developers/modules/govern/spec.md) · G32 · G33).
 *
 * `Agents` over `LLMs`, stacked, with no panel header above them: the first
 * drawer header is the top of the column, and the breadcrumb already says which
 * panel is open (G16).
 *
 * **The agents lead, and the endpoints are one drawer down.** A person arrives
 * at Agents to see who is working; they reach the LLMs drawer from a cast that
 * names an endpoint, or from a refusal saying the Graph offers no model. The
 * providers were a tab of Graph settings while an agent bound one — an agent
 * binds no provider now ([PM1](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)),
 * and what it resolves against belongs beside it.
 *
 * **The lenses are read here, once.** The LLMs drawer needs *who casts this
 * model* to say whether removing one is safe (PM11), and that is the same list
 * Govern draws — one query, read where it is needed, never a counter on the
 * model row.
 */

import { useLensesQuery } from "@/hooks/queries/useGovern";
import { useLLMProvidersQuery } from "@/hooks/queries/useLLMProviders";
import { agentsDrawerSection } from "@/pages/graphs-detail/features/agents/AgentsDrawer";
import { llmsDrawerSection } from "@/pages/graphs-detail/features/agents/LlmsDrawer";
import { useTaskDrawerUi } from "@/pages/graphs-detail/shared/TaskDrawer";
import {
	type AgentsDrawer,
	useAgentsPanel,
} from "@/pages/graphs-detail/shell/useAgentsPanel";
import type { AgentEdge } from "@/types/work";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { useEffect, useRef } from "react";

export interface AgentsStackPanelProps {
	username: string;
	graphSlug: string;
	/** The agent the canvas is drawing. Selection, not the drill-in. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	selectedEdge?: AgentEdge | null;
	onOpenLineage?: (agentId: string) => void;
	onOpenEnvelope?: (agentId: string) => void;
	onOpenTask?: (taskId: string) => void;
	onNewAgent?: () => void;
}

export function AgentsStackPanel({
	username,
	graphSlug,
	selectedAgentId,
	onSelectAgent,
	selectedEdge,
	onOpenLineage,
	onOpenEnvelope,
	onOpenTask,
	onNewAgent,
}: AgentsStackPanelProps) {
	const agents = useAgentsPanel();
	const ui = useTaskDrawerUi();
	const providers = useLLMProvidersQuery(username, graphSlug);
	const lenses = useLensesQuery(username, graphSlug);

	// `PanelStack` reads `defaultSize` at **mount**, so this is the opening split
	// only (G35) — after that it is the reader's. **A Graph has many agents and
	// two or three endpoints**, so the split is not even.
	const size = (d: AgentsDrawer) =>
		d === "agents"
			? agents.drawer === "agents"
				? "72%"
				: "45%"
			: agents.drawer === "llms"
				? "55%"
				: "28%";

	// A drill-in expands the drawer holding it — the URL now names something to
	// look at, and rendering it into a collapsed section makes the click look
	// like it did nothing (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		agents.drawer === "agents" ? agents.agentId : agents.providerId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(agents.drawer);
	}, [agents.drawer, focused]);

	return (
		<PanelStack
			withHandle
			stackRef={stackRef}
			className="h-full"
			headerHeight={30}
			sections={[
				agentsDrawerSection({
					ui,
					username,
					graphSlug,
					agentId: agents.agentId,
					onOpenAgent: agents.openAgent,
					selectedAgentId,
					onSelectAgent,
					selectedEdge,
					onOpenLineage,
					onOpenEnvelope,
					onOpenTask,
					onNewAgent,
					defaultSize: size("agents"),
				}),
				llmsDrawerSection({
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
