/**
 * The run's tasks as a flow — the one panel kind `@invana/dashboard` does not ship.
 *
 * The package leaves `canvas`/`flow` out on purpose: a renderer that needed
 * `@invana/canvas` would put PixiJS in the bundle of every consumer that only
 * wanted tiles and a log, so it arrives as a **registry entry** instead. This
 * is Studio's, registered as `flow`, and it renders `TaskFlowCanvas` with the
 * data `taskFlowFromRun` built
 * ([SR32](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 */

import {
	TaskFlowCanvas,
	type TaskFlowData,
	taskFlowSettings,
	taskFlowTemplates,
} from "@/canvases/taskflow";
import type { PanelRendererProps } from "@invana/dashboard";
import { useCallback } from "react";

export interface FlowOptions {
	data: TaskFlowData;
	selectedId?: string | null;
	/** Emitted with `{ itemId }` when a node is picked — opens its step. */
	openAction?: string;
	/** The canvas's height: a dashboard panel body is content-height. */
	height: number;
}

/** The registry type argument both composers are parametrised by. */
export type WithFlow = { flow: FlowOptions };

export function TaskFlowPanel({
	options,
	onAction,
}: PanelRendererProps<FlowOptions>) {
	const { data, selectedId, openAction, height } = options;
	const onOpenNode = useCallback(
		(id: string) => {
			if (openAction) onAction(openAction, { itemId: id });
		},
		[onAction, openAction],
	);

	if (!data.nodes.length) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-base text-muted-foreground">
				No tasks recorded for this run.
			</div>
		);
	}

	return (
		<TaskFlowCanvas
			data={data}
			settings={taskFlowSettings}
			templates={taskFlowTemplates}
			selectedId={selectedId}
			height={height}
			onOpenNode={openAction ? onOpenNode : undefined}
		/>
	);
}
