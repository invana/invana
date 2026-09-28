/**
 * The two declared boards Skills owns — a skill's usage, and a rule
 * ([skills-dashboards.md](../../../../../../docs/for-developers/building-studio/skills-dashboards.md)).
 *
 * This file is the border ([code-shape §4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)):
 * the page host imports the page bodies and nothing else from here, and the
 * composers and the shared vocabulary stay inside. `skill:<id>` is the skill's
 * page, not a board (SK36) — `SkillBoardPage`, beside the drawer.
 */

export { UsageBoardPage } from "@/pages/graphs-detail/features/skills/boards/UsageBoardPage";
export type { UsageBoardPageProps } from "@/pages/graphs-detail/features/skills/boards/UsageBoardPage";

export { RuleBoardPage } from "@/pages/graphs-detail/features/rules/boards/RuleBoardPage";
export type { RuleBoardPageProps } from "@/pages/graphs-detail/features/rules/boards/RuleBoardPage";
