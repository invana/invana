/**
 * The two declared boards Operate owns — a run, and one task run
 * ([boards-migration § 5](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * This file is the border ([code-shape.md § 4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)):
 * the page host imports the two page bodies and nothing else from here, and
 * the composers, the flow panel and the shared vocabulary stay inside.
 */

export { RunDashboardPage } from "@/pages/graphs-detail/features/operate/dashboards/RunDashboardPage";
export type { RunDashboardPageProps } from "@/pages/graphs-detail/features/operate/dashboards/RunDashboardPage";
export {
	useRunPageTitle,
	useStepPageTitle,
} from "@/pages/graphs-detail/features/operate/dashboards/RunDashboardPage";

export { StepDashboardPage } from "@/pages/graphs-detail/features/operate/dashboards/StepDashboardPage";
export type { StepDashboardPageProps } from "@/pages/graphs-detail/features/operate/dashboards/StepDashboardPage";
