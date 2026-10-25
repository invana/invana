/**
 * A run › **Stages** — the plan's functions in plan order, one card per stage
 * on the layered canvas: its calls, lanes and time, with the stage's
 * `out_count` on the edge to the next.
 *
 * Selecting a stage opens its step under the canvas (`&step=`) — Overview
 * (tiles · Input · Output) · Touched · Log, the shell's own step drawing. A
 * stage that fanned out opens on its first lane, with *All lanes* beside it
 * (`&lane=all`), which lists every lane to open.
 *
 * A run whose steps were pruned says so; its tiles keep their stored numbers.
 */

import {
	Button,
	EmptyState,
	SegmentedControl,
	TypographyInlineCode,
} from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { QueryStepBoard } from "@invana-studio/shell";
import type { Tone } from "@invana-studio/ui";
import { useMemo } from "react";
import { TabReadState } from "../../agents/agentParts";
import { ms } from "../../overview/fleetParts";
import { useRunStagesQuery } from "../queries";
import type { RunStage } from "../types";
import { useRunParam } from "./useRunParam";

function stageTone(status: string): Tone {
	switch (status) {
		case "succeeded":
			return "success";
		case "running":
		case "queued":
			return "running";
		case "failed":
			return "error";
		case "awaiting_input":
		case "awaiting_approval":
		case "needs_input":
			return "warning";
		default:
			return "muted";
	}
}

/** `0.6 s · 1 call · 4 lanes` — the card's second line. */
function stageSub(s: RunStage): string {
	return [
		s.summary ||
			[
				s.duration_ms != null ? ms(s.duration_ms) : null,
				`${s.calls} call${s.calls === 1 ? "" : "s"}`,
			]
				.filter(Boolean)
				.join(" · "),
		s.lanes > 1 ? `${s.lanes} lanes` : null,
		s.line,
	]
		.filter(Boolean)
		.join(" · ");
}

export function StagesTab({
	username,
	graphSlug,
	runId,
	live,
	stepId,
	onOpenStep,
	onOpenRun,
}: {
	username: string;
	graphSlug: string;
	runId: string;
	live: boolean;
	stepId: string | null;
	onOpenStep: (id: string | null) => void;
	onOpenRun: (id: string) => void;
}) {
	const stages = useRunStagesQuery(username, graphSlug, runId, live);
	const [lane, setLane] = useRunParam(runId, "lane");
	const list = stages.data?.stages ?? [];

	const { nodes, edges } = useMemo(() => {
		const nodes: LayeredNode[] = list.map((s, i) => ({
			id: s.step_key,
			label: s.function,
			sub: stageSub(s),
			column: i,
			tone: stageTone(s.status),
		}));
		const edges: LayeredEdge[] = list.slice(1).map((s, i) => ({
			id: `${list[i].step_key}->${s.step_key}`,
			source: list[i].step_key,
			target: s.step_key,
			label:
				list[i].out_count != null ? list[i].out_count.toLocaleString() : "",
		}));
		return { nodes, edges };
	}, [list]);

	if (!stages.data)
		return (
			<TabReadState
				loading={stages.isLoading}
				error={stages.error}
				what="this run's stages"
				onRetry={() => void stages.refetch()}
			/>
		);

	if (stages.data.pruned)
		return (
			<EmptyState
				className="h-full"
				title="This run's trace has been pruned"
				description="A run keeps its counts and its outcome; its steps go with retention. The tiles on Overview are its stored numbers."
			/>
		);

	const index = stepId
		? list.findIndex((s) => s.step_ids.includes(stepId))
		: -1;
	const stage = index >= 0 ? list[index] : null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="relative min-h-72 flex-1">
				<LayeredCanvas
					kind="data"
					layout="fixed"
					nodes={nodes}
					edges={edges}
					selectedNodeId={stage?.step_key ?? null}
					onSelectNode={(id) => {
						const picked = list.find((s) => s.step_key === id);
						setLane(null);
						onOpenStep(picked?.step_ids[0] ?? null);
					}}
					emptyHint="No stage has run yet."
				/>
			</div>
			{stage && stepId ? (
				<StepPanel
					username={username}
					graphSlug={graphSlug}
					runId={runId}
					stage={stage}
					index={index}
					stepId={stepId}
					allLanes={lane === "all"}
					onLane={(all) => setLane(all ? "all" : null)}
					onOpenStep={(id) => {
						setLane(null);
						onOpenStep(id);
					}}
					onOpenRun={onOpenRun}
				/>
			) : null}
		</div>
	);
}

function StepPanel({
	username,
	graphSlug,
	runId,
	stage,
	index,
	stepId,
	allLanes,
	onLane,
	onOpenStep,
	onOpenRun,
}: {
	username: string;
	graphSlug: string;
	runId: string;
	stage: RunStage;
	index: number;
	stepId: string;
	allLanes: boolean;
	onLane: (all: boolean) => void;
	onOpenStep: (id: string) => void;
	onOpenRun: (id: string) => void;
}) {
	const lanes = stage.step_ids.length;
	const lane = stage.step_ids.indexOf(stepId) + 1;
	return (
		<div className="flex h-1/2 min-h-72 shrink-0 flex-col border-t">
			<div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5">
				<TypographyInlineCode>{stage.function}</TypographyInlineCode>
				<span className="text-sm text-muted-foreground">
					stage {index + 1}
					{lanes > 1 ? ` · lane ${lane} of ${lanes}` : ""}
				</span>
				{lanes > 1 ? (
					<SegmentedControl
						size="sm"
						className="ml-auto"
						aria-label="Lanes"
						value={allLanes ? "all" : "one"}
						onValueChange={(v) => onLane(v === "all")}
						options={[
							{ value: "one", label: `Lane ${lane}` },
							{ value: "all", label: `All ${lanes} lanes` },
						]}
					/>
				) : null}
			</div>
			{allLanes ? (
				<div className="flex flex-wrap gap-2 border-t p-3">
					{stage.step_ids.map((id, i) => (
						<Button
							key={id}
							size="sm"
							variant={id === stepId ? "secondary" : "outline"}
							onClick={() => onOpenStep(id)}
						>
							Lane {i + 1}
						</Button>
					))}
				</div>
			) : (
				<div className="min-h-0 flex-1 border-t">
					<QueryStepBoard
						username={username}
						graphSlug={graphSlug}
						runId={runId}
						stepId={stepId}
						onOpenRun={onOpenRun}
					/>
				</div>
			)}
		</div>
	);
}
