/**
 * One step of a run, drawn as the run page draws it — for a place that is not
 * the run page: the Explorer console's query detail
 * ([4.4](../../../../../../docs/for-developers/modules/explore/features/the-console.md)).
 *
 * It composes the run page's own `stepBoardSpec`, so a query read in the
 * console and the same step read on its run are one drawing: tiles, the query
 * generated and executed, its output, Touched and Log. What belongs to walking
 * a run — the previous and next step, the step picker, the spec view — is the
 * run page's; here the run crumb opens that page instead.
 */

import { Board, type BoardSpec, RUN_PANELS } from "@invana/boards";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";
import { routedAction } from "../../../boards/boardSpec";
import { useActivitySlots } from "../../ActivitySlots";
import { StepTouchWidget } from "../touches/StepTouchWidget";
import { BOARD_ICONS } from "./icons";
import { VIEW_BOARD } from "./runBoards";
import {
	STEP_ACTIONS,
	type StepPanels,
	type StepTab,
	stepBoardSpec,
	stepContext,
} from "./stepBoardSpec";
import { useRunTrace } from "./useRunTrace";

const REGISTRY = { ...RUN_PANELS, stepTouch: StepTouchWidget };

export interface QueryStepBoardProps {
	username: string;
	graphSlug: string;
	runId: string;
	stepId: string;
	/** The tab it opens on — a failed query opens on its Log. */
	initialTab?: StepTab;
	/** The run crumb: open the whole run on its own page. */
	onOpenRun?: (runId: string) => void;
}

export function QueryStepBoard({
	username,
	graphSlug,
	runId,
	stepId,
	initialTab = "overview",
	onOpenRun,
}: QueryStepBoardProps) {
	const { useRunTouches } = useActivitySlots();
	const trace = useRunTrace(username, graphSlug, runId);
	const touches = useRunTouches(username, graphSlug, runId);
	const [tab, setTab] = useState<StepTab>(initialTab);
	const engaged = touches.data?.total ? touches.data : undefined;

	const spec = useMemo((): BoardSpec<StepPanels> | null => {
		if (!trace.data) return null;
		const context = stepContext(trace.data, stepId);
		if (!context) return null;
		const full = stepBoardSpec(trace.data, context, {
			view: VIEW_BOARD,
			tab,
			touches: engaged,
		});
		// Walking the run is the run page's: no prev/next, no picker, no spec view.
		const { crumbMenu: _menu, ...header } = full.header ?? {};
		return {
			...full,
			header: {
				...header,
				crumbActions: onOpenRun ? [STEP_ACTIONS.openRun] : [],
				actions: [],
			},
		} as BoardSpec<StepPanels>;
	}, [trace.data, stepId, tab, engaged, onOpenRun]);

	if (trace.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!spec)
		return (
			<EmptyState
				className="h-full"
				title="This query's trace has been pruned"
				description="A run keeps its counts and its outcome; its steps go with retention."
			/>
		);

	return (
		<Board
			className="h-full min-h-0"
			spec={spec}
			registry={REGISTRY}
			icons={BOARD_ICONS}
			onAction={(action, context_) => {
				const [id, ctx] = routedAction(action, context_);
				if (id === STEP_ACTIONS.tab && ctx?.option)
					setTab(ctx.option as StepTab);
				else if (id === STEP_ACTIONS.openRun) onOpenRun?.(runId);
			}}
		/>
	);
}
