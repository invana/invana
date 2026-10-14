/**
 * `@invana-studio/projects` — the Projects product's public surface: projects
 * and the Todos inside them (the Projects stack, a project's plan canvas and
 * its working rules), a project's page and the Decisions page that
 * `mainSection` draws, and the product's `ProductDefinition`, whose
 * `projects.addFinding` action lets other products add a finding
 * (projects.md).
 *
 * Nothing outside this package reaches past this file. What the product
 * borrows from its host comes through `ProjectsSlotsContext`.
 */

export { PlanCanvas } from "./PlanCanvas";
export { ProjectsSlotsContext } from "./ProjectsSlots";
export { ProjectsViewPanel } from "./ProjectsViewPanel";
export { projects } from "./product";
export { DecisionsPage } from "./project/DecisionsPage";
export { ProjectPage } from "./project/ProjectPage";
export { useProjectTrail } from "./project/useProjectTrail";
export {
	useProjectPlanQuery,
	useProjectsQuery,
	useTodoMutations,
} from "./queries";
export { useProjectsViewPanel } from "./useProjectsViewPanel";
