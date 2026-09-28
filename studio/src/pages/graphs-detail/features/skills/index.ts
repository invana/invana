/**
 * The skills module's public surface — the only file another module imports.
 */

export {
	SKILL_ACTIONS,
	ruleTitle,
	when,
} from "@/pages/graphs-detail/features/skills/boards/shared";
export { SkillFlowWidget } from "@/pages/graphs-detail/features/skills/boards/SkillFlowWidget";
export { UsageBoardPage } from "@/pages/graphs-detail/features/skills/boards/UsageBoardPage";
export {
	useCreateProjectRuleMutation,
	useCreateRuleMutation,
	useProjectRulesQuery,
	useRuleCitationsQuery,
	useRulesQuery,
	useSetRuleActiveMutation,
	useSkillsQuery,
	useUpdateRuleMutation,
} from "@/pages/graphs-detail/features/skills/queries";
export { SkillBoardPage } from "@/pages/graphs-detail/features/skills/SkillBoardPage";
export { SkillsViewPanel } from "@/pages/graphs-detail/features/skills/SkillsViewPanel";
export type {
	BindRefusal,
	OfferedRule,
	PlanArg,
	Rule,
	RuleCitationsResponse,
	Skill,
	SkillLayer,
	SkillPlaybookRead,
} from "@/pages/graphs-detail/features/skills/types";
