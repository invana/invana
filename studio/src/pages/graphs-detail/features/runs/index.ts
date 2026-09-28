/**
 * The runs module's public surface — the only file another module imports
 * ([code-shape.md § 4.1](../../../../../docs/for-developers/building-studio/code-shape.md)).
 *
 * The Runs panel and its journal, the run's declared board with a step opened
 * inside it, and the records they read. The composers, the flow panel and the
 * shared vocabulary stay inside.
 */

export type {
	ApiTaskRunStep,
	ProjectionTemplateRead,
	RunStreamHandle,
	TraceRead,
	TraceStepRead,
} from "@/pages/graphs-detail/features/runs/api";
export {
	emissionsApi,
	messageFromFrame,
	projectionTemplatesApi,
	runsApi,
	stepFromFrame,
	toRunNode,
	traceApi,
} from "@/pages/graphs-detail/features/runs/api";
export { RunBoardPage } from "@/pages/graphs-detail/features/runs/boards/RunBoardPage";
export { useRunStep } from "@/pages/graphs-detail/features/runs/boards/useRunStep";
export {
	useRunListQuery,
	useRunsQuery,
} from "@/pages/graphs-detail/features/runs/queries";
export { runAddress } from "@/pages/graphs-detail/features/runs/RunDetail";
export { RunsBoardPage } from "@/pages/graphs-detail/features/runs/RunsBoardPage";
export { RunsViewPanel } from "@/pages/graphs-detail/features/runs/RunsViewPanel";
export { TraceIdValue } from "@/pages/graphs-detail/features/runs/TraceIdValue";
export type {
	AskFrame,
	Diagnosis,
	QueryProposed,
	RunNode,
	RunNodeStatus,
	RunStatus,
	RunView,
	TaskRunSummary,
} from "@/pages/graphs-detail/features/runs/types";
export { LIVE_RUN_STATUSES } from "@/pages/graphs-detail/features/runs/types";
