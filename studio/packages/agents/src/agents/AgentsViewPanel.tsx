/**
 * **Agents** — one rail icon, one panel, one section: the agents
 * ([fleet-performance.md](../../../../../docs/for-developers/modules/agents/features/fleet-performance.md)).
 *
 * The section header is the top of the column, with no panel header above it;
 * the breadcrumb already says which panel is open. The endpoints an agent's
 * cast resolves against are the LLMs page, a rail item of its own.
 */

import { PanelStack } from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { useAccess } from "@invana-studio/shell";
import { useStackSectionUi } from "@invana-studio/ui";
import { useEffect, useRef } from "react";
import { gateSection } from "../gateSection";
import { useUrlSearchUi } from "../lists";
import { agentsSection } from "./AgentsSection";
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
	// The URL holds the list's search and filters, so the section's header and
	// the rows under it read the same ones — and a link opens the same rows.
	const list = useListParams();
	const ui = useUrlSearchUi(useStackSectionUi(), "agents", list);
	const { gate } = useAccess();

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
						list,
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
