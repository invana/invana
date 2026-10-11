/**
 * `@invana-studio/projects` — the Projects product's public surface: projects
 * and the Todos inside them (the Projects stack, a project's plan canvas and
 * its working rules), the Decisions panel, and the product's
 * `ProductDefinition` (projects.md).
 *
 * Nothing outside this package reaches past this file. What the product
 * borrows from its host comes through `ProjectsSlotsContext`.
 */

export { DecisionsViewPanel } from "./decisions/DecisionsViewPanel";
export { PlanCanvas } from "./PlanCanvas";
export { ProjectsSlotsContext } from "./ProjectsSlots";
export { ProjectsViewPanel } from "./ProjectsViewPanel";
export { projects } from "./product";
export { useProjectPlanQuery, useTodoMutations } from "./queries";
