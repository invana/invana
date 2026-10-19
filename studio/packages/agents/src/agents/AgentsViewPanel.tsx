/**
 * **Agents** — one rail icon, one panel, one section: the agents
 * ([fleet-performance.md](../../../../../docs/for-developers/modules/agents/features/fleet-performance.md)).
 *
 * The section header is the top of the column, with no panel header above it;
 * the breadcrumb already says which panel is open. The endpoints an agent's
 * cast resolves against are the LLMs page, a rail item of its own.
 */

import { PanelStack } from "@invana/ui";
import { useAccess } from "@invana-studio/shell";
import { useStackSectionUi } from "@invana-studio/ui";
import { useEffect, useRef, useState } from "react";
import { gateSection } from "../gateSection";
import {
	type AgentFilters,
	agentsSection,
	NO_AGENT_FILTERS,
} from "./AgentsSection";
import { useAgentsQuery } from "./queries";
import type { AgentEdge } from "./types";
import { useAgentsViewPanel } from "./useAgentsViewPanel";

export interface AgentsViewPanelProps {
	username: string;
	graphSlug: string;
	/** The agent the canvas is drawing. Selection, not the drill-in. */
	selectedAgentId: string | null;
	onSelectAgent: (id: string | null) => void;
	/** Opens the agent's page in `mainSection`. */
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
	const { gate } = useAccess();
	// Held here, not in the list: the funnel in the section's header and the
	// rows under it read the same filters. The count beside the title is the
	// engine's — the standing agents, or every agent once the hidden helpers
	// are shown; a kind or status filter narrows the rows, not the count.
	const [filters, setFilters] = useState<AgentFilters>(NO_AGENT_FILTERS);
	const agentList = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const count = agentList.data
		? filters.showEphemeral
			? agentList.data.total
			: agentList.data.persistent
		: undefined;

	// `&agent=` was the drill-in when the page lived in this section. A link that
	// still carries it opens the page, and the key is dropped — read, never
	// written.
	//
	// **Two writes, one after the other.** Dropping `&agent=` and opening the
	// page (`?page=`) are two writers of one query string; in one tick the
	// second is composed against the string as it was before the first, and
	// `?page=` is lost. So the key is dropped first, and the page opens once that
	// write has landed — the same order Govern's drill-in keeps.
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
			className="h-full"
			headerHeight={30}
			sections={[
				gateSection(
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
					}),
					["new"],
					gate("build"),
				),
			]}
		/>
	);
}
