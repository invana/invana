/**
 * The projects module's public surface — the only file another module imports.
 */

export { PlanCanvas } from "@/pages/graphs-detail/features/projects/PlanCanvas";
export { ProjectsViewPanel } from "@/pages/graphs-detail/features/projects/ProjectsViewPanel";
export {
	useProjectPlanQuery,
	useTodoMutations,
} from "@/pages/graphs-detail/features/projects/queries";
