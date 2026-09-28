import { AgentBoardPage } from "@/pages/graphs-detail/features/agents";
import {
	BOARD_KINDS,
	FrozenBoardPage,
	type OpenBoard,
	boardPageId,
} from "@/pages/graphs-detail/features/boards";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import {
	CompareBoardPage,
	LensBoardPage,
	parseComparePair,
} from "@/pages/graphs-detail/features/lenses";
import {
	type ModelSelection,
	ModelsPage,
	type useModelsView,
} from "@/pages/graphs-detail/features/models";
import { PlanBoardPage } from "@/pages/graphs-detail/features/plans/boards/PlanBoardPage";
import {
	PlanArgumentsPage,
	PlanExportPage,
	PlanVersionsPage,
} from "@/pages/graphs-detail/features/plans/boards/PlanRecordPages";
import { runAddress } from "@/pages/graphs-detail/features/runs/RunDetail";
import { RunsBoardPage } from "@/pages/graphs-detail/features/runs/RunsBoardPage";
import { RunBoardPage } from "@/pages/graphs-detail/features/runs/boards";
import { SkillBoardPage } from "@/pages/graphs-detail/features/skills/SkillBoardPage";
import {
	RuleBoardPage,
	UsageBoardPage,
} from "@/pages/graphs-detail/features/skills/boards";
import type { useBoardPage } from "@/pages/graphs-detail/shell/useBoardPage";
import type { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import type { useLensesViewPanel } from "@/pages/graphs-detail/shell/useLensesViewPanel";
import { EmptyState, Spinner } from "@invana/ui";
import type { Dispatch, SetStateAction } from "react";

/** What a declared board's body reads from the page that hosts it. */
export interface DeclaredBoardDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	openBoard: (board: OpenBoard) => void;
	setPageId: ReturnType<typeof useBoardPage>["setPageId"];
	/** `&step=` — the task open inside the focused run page. */
	runStep: string | null;
	settingsPanel: Pick<ReturnType<typeof useLeftSection>, "setSection">;
	governPanel: Pick<ReturnType<typeof useLensesViewPanel>, "reveal">;
	openWorkPanel: (
		section: "projects" | "runs" | "library" | "agents" | "skills",
	) => void;
	openAgentPage: (id: string) => void;
	showAgentCanvas: (kind: "envelope" | "lineage", id: string) => void;
	backend: CanvasBackend;
	modelSelection: ModelSelection | null;
	setModelSelection: Dispatch<SetStateAction<ModelSelection | null>>;
}

/**
 * The body of one declared page. A frozen reading branches first, and then
 * the board's kind picks the body — one place, rather than a nested ternary
 * inside the page list.
 */
export function declaredBoardContent(
	board: OpenBoard,
	deps: DeclaredBoardDeps,
) {
	const {
		username,
		graphSlug,
		openBoard,
		setPageId,
		runStep,
		settingsPanel,
		governPanel,
		openWorkPanel,
		openAgentPage,
		showAgentCanvas,
		backend,
		modelSelection,
		setModelSelection,
	} = deps;

	// A task opens inside its run (SR72): the page stays, `&step=` moves.
	const openStep = (stepId: string | null) =>
		setPageId(boardPageId(board.kind, board.subjectId), { step: stepId });

	// **A frozen reading branches before the kind does** (B16). The stored
	// blob is the document, so there is nothing for a composer to do and no
	// kind to pick a body by — one page renders every report.
	if (board.versionId) {
		return (
			<FrozenBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				kind={board.kind}
				subjectId={board.subjectId}
				versionId={board.versionId}
				onOpenLive={() => openBoard({ ...board, versionId: undefined })}
			/>
		);
	}

	if (board.kind === "run" || board.kind === "task_run") {
		// A step board opened cold is still reading which run it is in (SR44).
		// It has no run *yet*, which is not the same as having none.
		if (board.resolvingRun) {
			return (
				<div className="flex h-full items-center justify-center">
					<Spinner />
				</div>
			);
		}
		// The two bodies that read a trace. `runId` is optional on the record
		// because a skill has no run (SD3), so they **check** it rather than
		// cast it — a fifth kind that forgot to pass one refuses here instead
		// of crashing inside the composer (B17).
		const runId = board.runId;
		if (!runId) {
			return (
				<EmptyState
					className="h-full"
					title="This board arrived without a run"
					description="A run and a step dashboard both read one trace. Open it again from the Runs panel."
				/>
			);
		}
		return (
			<RunBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				runId={runId}
				// A live `task_run` board only exists for the moment a cold link
				// takes to resolve; if it is drawn, it draws its step inside.
				stepId={board.kind === "task_run" ? board.subjectId : runStep}
				onOpenStep={
					board.kind === "task_run"
						? (id) =>
								openBoard({
									kind: "run",
									subjectId: runId,
									runId,
									stepId: id ?? undefined,
								})
						: openStep
				}
				// `Retune` — the run stays in `mainSection` while Govern opens
				// beside it, which is the whole reason the section is a stack
				// (SR12 · worlds.md Journey 2).
				onRetune={() => settingsPanel.setSection("govern")}
				// The pair is the subject, and the first half is this run —
				// `compare:<a>:<b>`, which the id parser splits on the first colon.
				onCompare={(other) =>
					openBoard({
						kind: "compare",
						subjectId: `${runId}:${other}`,
						runId,
					})
				}
			/>
		);
	}

	// The skill's page (SK17 · SK36) — it authors, like the agent's, and
	// reads no trace, so it takes no `board.runId` (SD3). Its usage and a
	// rule are readings, and stay boards.
	if (board.kind === "skill") {
		return (
			<SkillBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				skillId={board.subjectId}
				onOpenAgent={(id) => {
					openWorkPanel("agents");
					openAgentPage(id);
				}}
				onOpenUsageDashboard={(id) =>
					openBoard({ kind: "skill_usage", subjectId: id })
				}
			/>
		);
	}

	if (board.kind === "skill_usage") {
		return (
			<UsageBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				skillId={board.subjectId}
				onOpenSkill={(id) => openBoard({ kind: "skill", subjectId: id })}
				onOpenRun={(runId) =>
					openBoard({ kind: "run", subjectId: runId, runId })
				}
			/>
		);
	}

	if (board.kind === "rule") {
		return (
			<RuleBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				ruleId={board.subjectId}
				onEdit={() => settingsPanel.setSection("skills")}
				onOpenRun={(runId) =>
					openBoard({ kind: "run", subjectId: runId, runId })
				}
			/>
		);
	}

	// One page for both kinds, because they are one record separated by
	// `kind` (GV1 · WO15 · GR14). Neither reads a trace, so neither takes
	// `board.runId` (SD3).
	if (board.kind === "world" || board.kind === "guardrail") {
		return (
			<LensBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				kind={board.kind}
				lensId={board.subjectId}
				// `Edit` puts the Govern panel back on this lens, drilled in —
				// the board reads and the acts stay in the section (WO16).
				onEdit={(kind, lensId) => governPanel.reveal(kind, lensId)}
			/>
		);
	}

	// The agent's page (AG23 · AG34) — the one declared page that edits. It
	// reads no trace, so it takes no `board.runId` (SD3).
	// The journal drawn wide (SR70). It binds to the Graph, not to a run,
	// so it takes no `board.runId`.
	if (board.kind === "runs") {
		return (
			<RunsBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
			/>
		);
	}

	if (board.kind === "models") {
		return (
			<ModelsPage
				username={username as string}
				graphSlug={graphSlug as string}
				backend={backend}
				selection={modelSelection}
				onSelect={setModelSelection}
				onOpenRun={(runId) =>
					openBoard({ kind: "run", subjectId: runId, runId })
				}
			/>
		);
	}

	if (board.kind === "agent") {
		return (
			<AgentBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				agentId={board.subjectId}
				onOpenLineage={(id) => showAgentCanvas("lineage", id)}
				onOpenEnvelope={(id) => showAgentCanvas("envelope", id)}
			/>
		);
	}

	if (board.kind === "compare") {
		const pair = parseComparePair(board.subjectId);
		return pair ? (
			<CompareBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				runA={pair.runA}
				runB={pair.runB}
				onOpenRun={(id) => openBoard({ kind: "run", subjectId: id, runId: id })}
			/>
		) : null;
	}

	// What `⋯` opens on the plan page (LB38) — each a record of one
	// version, and its crumb goes back to the plan's page.
	if (
		board.kind === "plan_versions" ||
		board.kind === "plan_arguments" ||
		board.kind === "plan_export"
	) {
		const RecordPage = {
			plan_versions: PlanVersionsPage,
			plan_arguments: PlanArgumentsPage,
			plan_export: PlanExportPage,
		}[board.kind];
		return (
			<RecordPage
				username={username as string}
				graphSlug={graphSlug as string}
				planId={board.subjectId}
				onOpenPlan={(id) => openBoard({ kind: "plan_runs", subjectId: id })}
			/>
		);
	}

	// The plan page (LB24) — Overview · Layers · Flow · Activity, read over
	// a window. A row opens its run page beside it.
	return (
		<PlanBoardPage
			username={username as string}
			graphSlug={graphSlug as string}
			planId={board.subjectId}
			onOpenRun={(id) => openBoard({ kind: "run", subjectId: id, runId: id })}
			onOpenReading={(reading, id) =>
				openBoard({ kind: `plan_${reading}`, subjectId: id })
			}
		/>
	);
}

/** The names a declared tab is titled by, each read off a list the page already holds. */
export interface BoardTitleNames {
	modelsView: ReturnType<typeof useModelsView>["view"];
	modelName: (id: string) => string | undefined;
	lensNameById: Map<string, string>;
	agentNameById: Map<string, string>;
	skillNameById: Map<string, string>;
	planRefById: Map<string, string>;
}

/**
 * A declared tab's title. Most kinds are titled by their kind — one skill
 * board, and the crumb inside says which record. A lens and an agent are titled
 * by name, and a run by its address, `run:3c414b9f`, so two open runs are two
 * readable tabs.
 */
export function boardTitle(board: OpenBoard, names: BoardTitleNames): string {
	const {
		modelsView,
		modelName,
		lensNameById,
		agentNameById,
		skillNameById,
		planRefById,
	} = names;
	return (
		// One board, titled by its scope — `All models` or `AirRoutes` (MP18).
		board.kind === "models"
			? modelsView.scope
				? (modelName(modelsView.scope) ?? BOARD_KINDS.models.label)
				: "All models"
			: board.kind === "world" || board.kind === "guardrail"
				? (lensNameById.get(board.subjectId) ?? BOARD_KINDS[board.kind].label)
				: board.kind === "agent"
					? (agentNameById.get(board.subjectId) ??
						BOARD_KINDS[board.kind].label)
					: board.kind === "skill"
						? (skillNameById.get(board.subjectId) ??
							BOARD_KINDS[board.kind].label)
						: board.kind === "run"
							? runAddress(board.subjectId)
							: board.kind === "plan_runs"
								? (planRefById.get(board.subjectId) ??
									BOARD_KINDS[board.kind].label)
								: board.kind === "plan_versions" ||
										board.kind === "plan_arguments" ||
										board.kind === "plan_export"
									? `${planRefById.get(board.subjectId) ?? "plan"} · ${BOARD_KINDS[board.kind].label.toLowerCase()}`
									: BOARD_KINDS[board.kind].label
	);
}
