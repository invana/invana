/**
 * The two declared boards Skills owns — a skill's usage, and a rule
 * ([skills-dashboards.md](../../../../../../docs/for-developers/building-studio/skills-dashboards.md)).
 *
 * This file is the border ([code-shape §4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)):
 * the page host imports the page bodies and nothing else from here, and the
 * composers and the shared vocabulary stay inside. `skill:<id>` is the skill's
 * page, not a board (SK36) — `SkillBoardPage`, beside the drawer.
 */

export { UsageDashboardPage } from "@/pages/graphs-detail/features/skills/dashboards/UsageDashboardPage";
export type { UsageDashboardPageProps } from "@/pages/graphs-detail/features/skills/dashboards/UsageDashboardPage";

export { RuleDashboardPage } from "@/pages/graphs-detail/features/skills/dashboards/RuleDashboardPage";
export type { RuleDashboardPageProps } from "@/pages/graphs-detail/features/skills/dashboards/RuleDashboardPage";
