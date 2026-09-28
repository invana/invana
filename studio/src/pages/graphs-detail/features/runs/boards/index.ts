/**
 * The declared board Operate owns — a run, with a step opened inside it (SR72)
 * ([boards-migration § 5](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * This file is the border ([code-shape.md § 4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)):
 * the page host imports the page body and nothing else from here, and
 * the composers, the flow panel and the shared vocabulary stay inside.
 */

export { RunBoardPage } from "@/pages/graphs-detail/features/runs/boards/RunBoardPage";
export type { RunBoardPageProps } from "@/pages/graphs-detail/features/runs/boards/RunBoardPage";
export { useRunStep } from "@/pages/graphs-detail/features/runs/boards/useRunStep";
