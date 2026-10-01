/**
 * The run's tasks as a flow — the one panel kind `@invana/dashboard` does not ship.
 *
 * The package leaves `canvas`/`flow` out on purpose: a renderer that needed
 * `@invana/canvas` would put PixiJS in the bundle of every consumer that only
 * wanted tiles and a log, so it arrives as a **registry entry** instead. This
 * is Studio's, registered as `flow`, and it renders `TaskFlowCanvas` with the
 * data `taskFlowFromRun` built
 * ([see-what-ran.md](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 */

import type { PanelRendererProps } from "@invana/dashboard";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
	TaskFlowCanvas,
	type TaskFlowData,
	taskFlowSettings,
	taskFlowTemplates,
} from "@/canvases/taskflow";

export interface FlowOptions {
	data: TaskFlowData;
	selectedId?: string | null;
	/** Emitted with `{ itemId }` when a node is picked — opens its step. */
	openAction?: string;
	/**
	 * The canvas's **least** height. A dashboard panel body is content-height,
	 * so the panel measures the room left in the page and grows into it.
	 */
	height: number;
	/**
	 * The flow is the whole tab: no box, and it bleeds over the dashboard
	 * body's padding to the tab's edges, as the skill page's Flow tab does.
	 * Absent on a report saved while the flow sat in a titled box.
	 */
	bleed?: boolean;
	/** Said once in the canvas's message bar — the hint the box used to carry. */
	message?: string;
}

/** The registry type argument both composers are parametrised by. */
export type WithFlow = { flow: FlowOptions };

export function TaskFlowWidget({
	options,
	onAction,
}: PanelRendererProps<FlowOptions>) {
	const { data, selectedId, openAction, height, bleed, message } = options;
	const ref = useRef<HTMLDivElement>(null);
	const fill = useFillHeight(ref, height, bleed ? 0 : BELOW_BOX);
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
		// `-m-3` is the dashboard body's own `p-3`, cancelled.
		<div ref={ref} className={bleed ? "-m-3" : undefined}>
			<TaskFlowCanvas
				data={data}
				settings={taskFlowSettings}
				templates={taskFlowTemplates}
				message={message}
				selectedId={selectedId}
				height={fill}
				onOpenNode={openAction ? onOpenNode : undefined}
			/>
		</div>
	);
}

/** In a titled box: the body's bottom padding and the box's border. */
const BELOW_BOX = 14;

/**
 * The height from this element's top to the bottom of the page's scroller —
 * the dashboard body, the nearest ancestor that scrolls — never less than
 * `least`. The flow is the whole tab, so it takes the whole page: the kit pins
 * a row in px and has no way to say *the rest*.
 */
function useFillHeight(
	ref: React.RefObject<HTMLDivElement | null>,
	least: number,
	below: number,
): number {
	const [height, setHeight] = useState(least);
	useLayoutEffect(() => {
		const el = ref.current;
		let scroller = el?.parentElement ?? null;
		while (scroller && getComputedStyle(scroller).overflowY !== "auto")
			scroller = scroller.parentElement;
		if (!el || !scroller) return;
		const measure = () => {
			const room =
				scroller.getBoundingClientRect().bottom -
				el.getBoundingClientRect().top -
				below;
			setHeight(Math.max(least, Math.floor(room)));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		return () => observer.disconnect();
	}, [ref, least, below]);
	return height;
}
