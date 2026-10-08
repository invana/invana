/**
 * Every panel kind a declared board registers, in one map
 * ([boards-migration.md](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * The same argument as [`dashboardIcons`](./dashboardIcons.ts): the spec carries
 * a **string** and the renderer arrives as a prop, so a document stays JSON and
 * the components it names live in one vocabulary rather than five.
 *
 * A **report** is why this map has to exist. A live page registers only its own
 * panels, which is right — it composes them. A frozen reading has no composer
 * and no kind to branch on ([boards-migration.md](../../../../../docs/for-developers/building-engine/boards-migration.md)):
 * it renders whatever document was kept, so it needs every renderer any document
 * could name. Without this, a saved run report drew *No renderer for panel kind
 * `flow`* where its Gantt had been.
 *
 * **Every renderer here is pure.** Each one draws its own `options` and fetches
 * nothing, which is what makes it safe to mount from a blob: a panel that read
 * its subject would make a report a live page again, which is the one thing a
 * report must not be ([boards-migration.md](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 */

import { RUN_PANELS } from "@invana/boards";
import {
	RunLensWidget,
	StepTouchWidget,
} from "@/pages/graphs-detail/features/lenses";
import { PLAN_CHART_WIDGETS } from "@/pages/graphs-detail/features/plans";
import { SkillFlowWidget } from "@/pages/graphs-detail/features/skills";
import { TaskFlowWidget } from "@/pages/graphs-detail/shared/dashboards/TaskFlowWidget";

export const DECLARED_WIDGETS = {
	// The run vocabulary the kit ships — `trace · touched · attempts ·
	// artifacts · layers · lens · clarification`. Merged rather than listed,
	// so a kind added to `RUN_PANELS` reaches frozen reports without a second
	// edit here.
	...RUN_PANELS,
	flow: TaskFlowWidget,
	stepTouch: StepTouchWidget,
	skillFlow: SkillFlowWidget,
	// A plan's two charts — runs a day, work p50 a day.
	...PLAN_CHART_WIDGETS,
	// Named by documents frozen before the kit drew a run's lens. Live pages
	// compose `lens`; see the note in the file.
	runLens: RunLensWidget,
};
