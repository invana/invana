/**
 * The skills module's public surface — the only file another module imports.
 */

export { SkillFlowWidget } from "@/pages/graphs-detail/features/skills/boards/SkillFlowWidget";
export {
	ruleTitle,
	SKILL_ACTIONS,
	when,
} from "@/pages/graphs-detail/features/skills/boards/shared";
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
export { StepRules } from "@/pages/graphs-detail/features/skills/StepRules";
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
