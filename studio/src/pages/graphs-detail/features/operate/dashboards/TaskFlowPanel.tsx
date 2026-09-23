/**
 * The run's tasks as a flow — the one panel kind `@invana/dashboard` does not ship.
 *
 * The package leaves `canvas`/`flow` out on purpose: a renderer that needed
 * `@invana/canvas` would put PixiJS in the bundle of every consumer that only
 * wanted tiles and a log, so it arrives as a **registry entry** instead. This
 * is Studio's, registered as `flow`, and it is the same seam the kit's own
 * `Dashboard/D1 Run` story uses.
 *
 * **It lays cards out in `seq` order, not as a graph** ([SR32](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)):
 * a `TaskRun` records order and a `lane`, not dependencies, so a drawn branch
 * would be invented. Steps that fanned out share a row with their lane
 * siblings; everything else wraps. When `plan_snapshot` reaches the trace this
 * panel reads the plan's real edges — and if that wants a pannable surface it
 * becomes an `@invana/canvas` layer registered at the same key, which is the
 * whole point of the kind being a registry entry.
 */

import type { PanelRendererProps } from "@invana/dashboard";
import {
	type Bound,
	type StatusDotProps,
	TaskNode,
	type TaskNodeTag,
} from "@invana/ui";

export interface FlowNodeSpec {
	/** The step run's id — what `openAction` hands back. */
	id: string;
	taskKey: string;
	bound: Bound;
	status?: StatusDotProps["tone"];
	tags?: TaskNodeTag[];
	meta?: string;
	/** Present in the plan, absent from this pass. */
	dim?: boolean;
	/** Waits for an approval before it writes. */
	gate?: boolean;
	/** 1-based grid position, decided by the composer. */
	col: number;
	row: number;
}

export interface FlowOptions {
	nodes: FlowNodeSpec[];
	/** How many columns the composer laid the nodes into. */
	columns?: number;
	selectedId?: string | null;
	/** Emitted with `{ itemId }` when a card is picked — opens its step dashboard. */
	openAction?: string;
}

/** The registry type argument both composers are parametrised by. */
export type WithFlow = { flow: FlowOptions };

export function TaskFlowPanel({
	options,
	onAction,
}: PanelRendererProps<FlowOptions>) {
	const { nodes, columns = 4, selectedId, openAction } = options;

	if (!nodes.length) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-base text-muted-foreground">
				No tasks recorded for this run.
			</div>
		);
	}

	return (
		<div
			className="grid h-full content-start gap-x-3 gap-y-4 overflow-auto bg-background p-3
				[background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)]
				[background-size:28px_28px]"
			style={{ gridTemplateColumns: `repeat(${columns}, 146px)` }}
		>
			{nodes.map((node) => (
				<div key={node.id} style={{ gridColumn: node.col, gridRow: node.row }}>
					<TaskNode
						taskKey={node.taskKey}
						bound={node.bound}
						status={node.status}
						tags={node.tags}
						meta={node.meta}
						dim={node.dim}
						gate={node.gate}
						selected={node.id === selectedId}
						// A card is how a task's own dashboard is reached (SR36); the
						// card itself is the kit's, so the affordance is here.
						role={openAction ? "button" : undefined}
						tabIndex={openAction ? 0 : undefined}
						className={openAction ? "cursor-pointer" : undefined}
						onClick={
							openAction
								? () => onAction(openAction, { itemId: node.id })
								: undefined
						}
						onKeyDown={
							openAction
								? (event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onAction(openAction, { itemId: node.id });
										}
									}
								: undefined
						}
					/>
				</div>
			))}
		</div>
	);
}
