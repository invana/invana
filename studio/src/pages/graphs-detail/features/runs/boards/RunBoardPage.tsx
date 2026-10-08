/**
 * The run page — a report header over tabs, and a step opened **inside** it
 * ([see-what-ran.md](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 *
 * One page in `Workbook`, `run:<id>`. Without a step it reads the
 * run: `Overview · Layers · Flow · Touched`. With `?step=` it keeps the run's
 * header, puts the step in its crumb and swaps the tab strip for the step's
 * own: `Overview · Touched · Log`. The `run:` crumb is the way back, and the
 * run's tab is where it was left.
 *
 * The page fetches and answers actions. It composes nothing and renders no
 * panel: the two composers build the document, `@invana/boards` draws it,
 * and everything a person can do arrives back here as one `onAction(id, ctx)`
 * because a function is not JSON ([see-what-ran.md](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 */

import { Board, type BoardSpec, RUN_PANELS } from "@invana/boards";
import { EmptyState, Spinner } from "@invana/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useReport } from "@/pages/graphs-detail/features/boards";
import {
	CompareDialog,
	StepTouchWidget,
	stepKeyOfTouch,
	useRunTouchesQuery,
} from "@/pages/graphs-detail/features/lenses";
import { runsApi } from "@/pages/graphs-detail/features/runs/api";
import { BOARD_ICONS } from "@/pages/graphs-detail/features/runs/boards/icons";
import {
	RUN_ACTIONS,
	type RunPanels,
	type RunTab,
	runBoardSpec,
} from "@/pages/graphs-detail/features/runs/boards/runBoardSpec";
import {
	groupSteps,
	VIEW_BOARD,
} from "@/pages/graphs-detail/features/runs/boards/runBoards";
import {
	STEP_ACTIONS,
	type StepPanels,
	type StepTab,
	stepBoardSpec,
	stepContext,
} from "@/pages/graphs-detail/features/runs/boards/stepBoardSpec";
import { useRunTrace } from "@/pages/graphs-detail/features/runs/boards/useRunTrace";
import { routedAction } from "@/pages/graphs-detail/shared/boardSpec";
import { TaskFlowWidget } from "@/pages/graphs-detail/shared/boards/TaskFlowWidget";

export interface RunBoardPageProps {
	username: string;
	graphSlug: string;
	runId: string;
	/** The step open inside the run, from `?step=`, or `null` for the run. */
	stepId: string | null;
	/** Open a task inside this run — `null` returns to the run. */
	onOpenStep: (stepId: string | null) => void;
	/**
	 * `Retune` — open Govern beside the run, without closing it
	 * ([see-what-ran.md](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
	 */
	onRetune?: () => void;
	/** Open `compare:<this>:<that>` as a page once the second run is picked. */
	onCompare?: (otherRunId: string) => void;
}

/** A run's panel kinds, and a step's — one page draws both. */
type PagePanels = RunPanels & StepPanels;

const REGISTRY = {
	...RUN_PANELS,
	flow: TaskFlowWidget,
	stepTouch: StepTouchWidget,
};

export function RunBoardPage({
	username,
	graphSlug,
	runId,
	stepId,
	onOpenStep,
	onRetune,
	onCompare,
}: RunBoardPageProps) {
	const trace = useRunTrace(username, graphSlug, runId);
	// A **second** read beside the trace. `run_touches` is a projection of the
	// ledger rather than part of it, and a run that opened before its
	// Graph had a lens has a trace and no touches.
	const touches = useRunTouchesQuery(username, graphSlug, runId);
	const client = useQueryClient();
	const [view, setView] = useState(VIEW_BOARD);
	// Both tabs are held here, so the run's is where it was left when a step
	// closes, and a step's is kept as the reader walks from one to the next.
	const [runTab, setRunTab] = useState<RunTab>("overview");
	const [stepTab, setStepTab] = useState<StepTab>("overview");
	const [comparing, setComparing] = useState(false);

	const engaged = touches.data?.total ? touches.data : undefined;
	// A step from another run — a `?step=` left behind as the reader moved to
	// another page — is not this run's, so the run reads as itself.
	const context = useMemo(
		() => (trace.data && stepId ? stepContext(trace.data, stepId) : null),
		[trace.data, stepId],
	);
	const spec = useMemo((): BoardSpec<PagePanels> | null => {
		if (!trace.data) return null;
		// Each composer types its own panel kinds; the page's registry holds both,
		// so either document widens to the pair. The spec type is not covariant
		// in its kinds (a panel's options are keyed by them), hence the cast.
		const composed = context
			? stepBoardSpec(trace.data, context, {
					view,
					tab: stepTab,
					touches: engaged,
				})
			: runBoardSpec(trace.data, {
					view,
					tab: runTab,
					selectedKey: null,
					touches: engaged,
					lensName: trace.data.lens_name ?? null,
				});
		return composed as unknown as BoardSpec<PagePanels>;
	}, [trace.data, context, view, stepTab, runTab, engaged]);

	// `Save report` on the header, and the act behind it. The document
	// it keeps is `spec` — this page's reading, resolved, every tab included.
	const report = useReport(spec);

	if (trace.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!trace.data || !spec || !report) {
		return (
			<EmptyState
				className="h-full"
				title="This run's trace has been pruned"
				description="A run keeps its counts and its outcome; its steps and emissions go with retention."
			/>
		);
	}

	const data = trace.data;
	// A waterfall row and a strip column name a task by its group key; the
	// page opens its latest attempt.
	const openTask = (key?: string) => {
		const group = groupSteps(data.steps).find((g) => g.key === key);
		if (group) onOpenStep(group.head.id);
	};

	return (
		<>
			<Board
				className="h-full min-h-0"
				spec={report.spec}
				registry={REGISTRY}
				icons={BOARD_ICONS}
				onAction={(action, context_) => {
					const [id, ctx] = routedAction(action, context_);
					if (report.handle(id)) return;
					if (context) {
						switch (id) {
							case STEP_ACTIONS.tab:
								if (ctx?.option) setStepTab(ctx.option as StepTab);
								return;
							case STEP_ACTIONS.view:
								if (ctx?.option) setView(ctx.option);
								return;
							case STEP_ACTIONS.openRun:
								onOpenStep(null);
								return;
							case STEP_ACTIONS.openStep:
								if (ctx?.itemId) onOpenStep(ctx.itemId);
								return;
							case STEP_ACTIONS.prev:
								if (context.prev) onOpenStep(context.prev.head.id);
								return;
							case STEP_ACTIONS.next:
								if (context.next) onOpenStep(context.next.head.id);
								return;
							default:
								// `open-artifact` has nowhere to go until artifacts are
								// stored; the row is still listed.
								return;
						}
					}
					switch (id) {
						case RUN_ACTIONS.tab:
							if (ctx?.option) setRunTab(ctx.option as RunTab);
							return;
						case RUN_ACTIONS.view:
							if (ctx?.option) setView(ctx.option);
							return;
						case RUN_ACTIONS.selectTask:
							openTask(ctx?.itemId);
							return;
						case RUN_ACTIONS.selectTouchStep:
							if (ctx?.itemId) openTask(stepKeyOfTouch(ctx.itemId));
							return;
						case RUN_ACTIONS.openStep:
							if (ctx?.itemId) onOpenStep(ctx.itemId);
							return;
						case RUN_ACTIONS.retune:
							onRetune?.();
							return;
						case RUN_ACTIONS.compare:
							setComparing(true);
							return;
						case RUN_ACTIONS.cancel:
							void runsApi
								.cancel(username, graphSlug, runId)
								.then(() => {
									toast.success("Cancelling this run");
									return client.invalidateQueries({
										queryKey: ["runs", username, graphSlug],
									});
								})
								.catch(() => toast.error("Could not cancel this run"));
							return;
						default:
							// A spec can only emit an id it carries, and every id it
							// carries is answered above.
							return;
					}
				}}
			/>
			<CompareDialog
				open={comparing}
				onOpenChange={setComparing}
				username={username}
				graphSlug={graphSlug}
				runId={runId}
				question={data.body}
				onPick={(other) => {
					setComparing(false);
					onCompare?.(other);
				}}
			/>
		</>
	);
}
