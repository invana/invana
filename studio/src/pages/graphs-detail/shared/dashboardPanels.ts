/**
 * Every panel kind a declared board registers, in one map
 * ([B19](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * The same argument as [`dashboardIcons`](./dashboardIcons.ts): the spec carries
 * a **string** and the renderer arrives as a prop, so a document stays JSON and
 * the components it names live in one vocabulary rather than five.
 *
 * A **report** is why this map has to exist. A live page registers only its own
 * panels, which is right — it composes them. A frozen reading has no composer
 * and no kind to branch on ([B16](../../../../../docs/for-developers/building-engine/boards-migration.md)):
 * it renders whatever document was kept, so it needs every renderer any document
 * could name. Without this, a saved run report drew *No renderer for panel kind
 * `flow`* where its Gantt had been.
 *
 * **Every renderer here is pure.** Each one draws its own `options` and fetches
 * nothing, which is what makes it safe to mount from a blob: a panel that read
 * its subject would make a report a live page again, which is the one thing a
 * report must not be ([B13](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 */

import { RunLensPanel } from "@/pages/graphs-detail/features/govern/RunLensPanel";
import { StepTouchPanel } from "@/pages/graphs-detail/features/govern/StepTouchPanel";
import { TaskFlowPanel } from "@/pages/graphs-detail/features/operate/dashboards/TaskFlowPanel";
import { SkillFlowPanel } from "@/pages/graphs-detail/features/skills/dashboards/SkillFlowPanel";
import { RUN_PANELS } from "@invana/dashboard";

export const DECLARED_PANELS = {
	// The run vocabulary the kit ships — `trace · touched · attempts ·
	// artifacts · layers · lens · clarification`. Merged rather than listed,
	// so a kind added to `RUN_PANELS` reaches frozen reports without a second
	// edit here.
	...RUN_PANELS,
	flow: TaskFlowPanel,
	stepTouch: StepTouchPanel,
	skillFlow: SkillFlowPanel,
	// Named by documents frozen before the kit drew a run's lens. Live pages
	// compose `lens`; see the note in the file.
	runLens: RunLensPanel,
};
