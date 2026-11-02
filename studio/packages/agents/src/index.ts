/**
 * `@invana-studio/agents` — the Agents product's public surface: the section
 * pages the rail opens as tabs (`sections/`), Home's tiles, the Runs,
 * Approvals and Ledger pages the Activity product draws, the record pages a
 * row opens beside them — an agent, a skill, a plugin, a function, a plan, a
 * template — the canvases an agent's page draws, and the product's
 * `ProductDefinition` (agent-fabric.md, the-agents-shell.md).
 *
 * Nothing outside this package reaches past this file. What the product
 * borrows from its host comes through `AgentsSlotsContext`; how a page opens a
 * record comes through `AgentsOpenContext`.
 */

export { AgentsSlotsContext } from "./AgentsSlots";
export { AgentBoardPage } from "./agents/AgentBoardPage";
export { EnvelopeCanvas } from "./agents/EnvelopeCanvas";
export { LineageCanvas } from "./agents/LineageCanvas";
export {
	EVERY_AGENT,
	useAgentLineageQuery,
	useAgentsQuery,
} from "./agents/queries";
export type { AgentEdge } from "./agents/types";
export { ApprovalsPage } from "./approvals/ApprovalsPage";
export { useAsksQuery } from "./approvals/queries";
export { TemplatePage } from "./functions/TemplatePage";
export { HomeTiles } from "./home/HomeTiles";
export { LedgerPage } from "./ledger/LedgerPage";
export { useLLMProvidersQuery } from "./llms/queries";
export type { LLMProvider } from "./llms/types";
export { type AgentsOpen, AgentsOpenContext } from "./open";
export { PlanBoardPage } from "./plans/boards/PlanBoardPage";
export { PLAN_CHART_WIDGETS } from "./plans/boards/PlanChartWidgets";
export {
	PlanArgumentsPage,
	PlanExportPage,
	PlanVersionsPage,
} from "./plans/boards/PlanRecordPages";
export { useFlowsQuery } from "./plans/queries";
export { FunctionPage } from "./plugins/FunctionPage";
export { agents } from "./product";
export { useRunNumbers } from "./runNumbers";
export { useRunsTilesQuery } from "./runs/queries";
export { RunPage } from "./runs/RunPage";
export { RunsListPage } from "./runs/RunsListPage";
export { AgentsSectionBody } from "./sections/AgentsSectionBody";
export {
	type AgentsSectionKey,
	firstTab,
	type RunSectionKey,
	SECTIONS,
	type SectionPageProps,
} from "./sections/spec";
export { SkillFlowWidget } from "./skills/boards/SkillFlowWidget";
export { ruleTitle, SKILL_ACTIONS, when } from "./skills/boards/shared";
export { useSkillsQuery } from "./skills/queries";
export { SkillBoardPage } from "./skills/SkillBoardPage";
