/**
 * The three declared boards Skills owns — a skill, its usage, and a rule
 * ([skills-dashboards.md](../../../../../../docs/for-developers/building-studio/skills-dashboards.md)).
 *
 * This file is the border ([code-shape §4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)):
 * the page host imports the three page bodies and nothing else from here, and
 * the composers, the flow panel and the shared vocabulary stay inside.
 */

export { SkillDashboardPage } from "@/pages/graphs-detail/features/skills/dashboards/SkillDashboardPage";
export type { SkillDashboardPageProps } from "@/pages/graphs-detail/features/skills/dashboards/SkillDashboardPage";

export { UsageDashboardPage } from "@/pages/graphs-detail/features/skills/dashboards/UsageDashboardPage";
export type { UsageDashboardPageProps } from "@/pages/graphs-detail/features/skills/dashboards/UsageDashboardPage";

export { RuleDashboardPage } from "@/pages/graphs-detail/features/skills/dashboards/RuleDashboardPage";
export type { RuleDashboardPageProps } from "@/pages/graphs-detail/features/skills/dashboards/RuleDashboardPage";
