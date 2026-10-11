/**
 * `@invana-studio/agents` — the Agents product's public surface: the agents
 * that do the legwork (`agents/`), the skills they may be offered (`skills/`),
 * the Library of plans (`plans/`) and answer templates (`projections/`), the
 * LLM endpoints they think with (`llms/`), and how much of it may run at once
 * (`settings/`) (agents.md); the Overview, Plugins and Performance panels; and
 * the product's `ProductDefinition`.
 *
 * Nothing outside this package reaches past this file. What the product
 * borrows from its host comes through `AgentsSlotsContext`.
 */

export { AgentsSlotsContext } from "./AgentsSlots";
export { AgentBoardPage } from "./agents/AgentBoardPage";
export { AgentsViewPanel } from "./agents/AgentsViewPanel";
export { EnvelopeCanvas } from "./agents/EnvelopeCanvas";
export { LineageCanvas } from "./agents/LineageCanvas";
export {
	useAgentLineageQuery,
	useAgentsQuery,
} from "./agents/queries";
export type { AgentEdge } from "./agents/types";
export { useLLMProvidersQuery } from "./llms/queries";
export type { LLMProvider } from "./llms/types";
export { OverviewViewPanel } from "./overview/OverviewViewPanel";
export { PerformanceViewPanel } from "./performance/PerformanceViewPanel";
export { taskPlansApi } from "./plans/api";
export { PlanBoardPage } from "./plans/boards/PlanBoardPage";
export { PLAN_CHART_WIDGETS } from "./plans/boards/PlanChartWidgets";
export {
	PlanArgumentsPage,
	PlanExportPage,
	PlanVersionsPage,
} from "./plans/boards/PlanRecordPages";
export { LibraryViewPanel } from "./plans/LibraryViewPanel";
export { PlanFlowCanvas } from "./plans/PlanFlowCanvas";
export {
	useTaskPlanQuery,
	useTaskPlansQuery,
} from "./plans/queries";
export { useLibraryViewPanel } from "./plans/useLibraryViewPanel";
export { PluginsViewPanel } from "./plugins/PluginsViewPanel";
export { agents } from "./product";
export { AgentsSettingsViewPanel } from "./settings/AgentsSettingsViewPanel";
export { SkillFlowWidget } from "./skills/boards/SkillFlowWidget";
export { ruleTitle, SKILL_ACTIONS, when } from "./skills/boards/shared";
export { UsageBoardPage } from "./skills/boards/UsageBoardPage";
export { useSkillsQuery } from "./skills/queries";
export { SkillBoardPage } from "./skills/SkillBoardPage";
export { SkillsViewPanel } from "./skills/SkillsViewPanel";
