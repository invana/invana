/**
 * The agents module's public surface — the only file another module imports.
 */

export { AgentBoardPage } from "@/pages/graphs-detail/features/agents/AgentBoardPage";
export { AgentsViewPanel } from "@/pages/graphs-detail/features/agents/AgentsViewPanel";
export { EnvelopeCanvas } from "@/pages/graphs-detail/features/agents/EnvelopeCanvas";
export { LineageCanvas } from "@/pages/graphs-detail/features/agents/LineageCanvas";
export {
	useAgentLineageQuery,
	useAgentMutations,
	useAgentsQuery,
} from "@/pages/graphs-detail/features/agents/queries";
export type {
	AgentChip,
	AgentEdge,
} from "@/pages/graphs-detail/features/agents/types";
