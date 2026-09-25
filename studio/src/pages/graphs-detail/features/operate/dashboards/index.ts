/**
 * The declared board Operate owns — a run, with a step opened inside it (SR72)
 * ([boards-migration § 5](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * This file is the border ([code-shape.md § 4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)):
 * the page host imports the page body and nothing else from here, and
 * the composers, the flow panel and the shared vocabulary stay inside.
 */

export { RunDashboardPage } from "@/pages/graphs-detail/features/operate/dashboards/RunDashboardPage";
export type { RunDashboardPageProps } from "@/pages/graphs-detail/features/operate/dashboards/RunDashboardPage";
export { useRunStep } from "@/pages/graphs-detail/features/operate/dashboards/useRunStep";
