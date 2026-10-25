import { EmptyState, Spinner } from "@invana/ui";
import {
	AgentBoardPage,
	FunctionPage,
	PlanArgumentsPage,
	PlanBoardPage,
	PlanExportPage,
	PlanVersionsPage,
	PluginPage,
	RunPage,
	SkillBoardPage,
	TemplatePage,
} from "@invana-studio/agents";
import type { CanvasBackend } from "@invana-studio/canvases";
import type { useLensesViewPanel } from "@invana-studio/modeller";
import {
	CompareBoardPage,
	LensBoardPage,
	type ModelSelection,
	ModelsPage,
	parseComparePair,
	type useModelsView,
} from "@invana-studio/modeller";
import { DecisionsPage, ProjectPage } from "@invana-studio/projects";
import type { useLeftSection } from "@invana-studio/shell";
import {
	BOARD_KINDS,
	boardPageId,
	type OpenBoard,
	RunsBoardPage,
	runAddress,
} from "@invana-studio/shell";
import type { Dispatch, SetStateAction } from "react";
import { FrozenBoardPage } from "@/host/boards";
import { RuleBoardPage } from "@/host/rules";
import type { useBoardPage } from "@/host/useBoardPage";

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
	openAgentPage: (id: string) => void;
	showAgentCanvas: (kind: "envelope" | "lineage", id: string) => void;
	backend: CanvasBackend;
	modelSelection: ModelSelection | null;
	setModelSelection: Dispatch<SetStateAction<ModelSelection | null>>;
	/** A project's page, on a branch when one is named. */
	openProjectPage: (key: string, branch?: number | null) => void;
	/** Leave the graph's products for a dataset in Datasets. */
	openDataset: (address: string) => void;
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
		openAgentPage,
		showAgentCanvas,
		backend,
		modelSelection,
		setModelSelection,
		openProjectPage,
		openDataset,
	} = deps;

	// A task opens inside its run: the page stays, `&step=` moves.
	const openStep = (stepId: string | null) =>
		setPageId(boardPageId(board.kind, board.subjectId), { step: stepId });

	// **A frozen reading branches before the kind does**. The stored
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
		// A step board opened cold is still reading which run it is in.
		// It has no run *yet*, which is not the same as having none.
		if (board.resolvingRun) {
			return (
				<div className="flex h-full items-center justify-center">
					<Spinner />
				</div>
			);
		}
		// The two bodies that read a trace. `runId` is optional on the record
		// because a skill has no run, so they **check** it rather than
		// cast it — a fifth kind that forgot to pass one refuses here instead
		// of crashing inside the composer.
		const runId = board.runId;
		if (!runId) {
			return (
				<EmptyState
					className="h-full"
					title="This board arrived without a run"
					description="A run and a step board both read one trace. Open it again from the Runs panel."
				/>
			);
		}
		return (
			<RunPage
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
				// The pair is the subject, and the first half is this run —
				// `compare:<a>:<b>`, which the id parser splits on the first colon.
				onCompare={(other) =>
					openBoard({
						kind: "compare",
						subjectId: `${runId}:${other}`,
						runId,
					})
				}
				// A re-run opens as its own run page, beside this one.
				onOpenRun={(id) => openBoard({ kind: "run", subjectId: id, runId: id })}
			/>
		);
	}

	// The skill's page — it authors, like the agent's, and
	// reads no trace, so it takes no `board.runId`. A rule is a reading,
	// and stays a board.
	if (board.kind === "skill") {
		return (
			<SkillBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				skillId={board.subjectId}
				onOpenAgent={openAgentPage}
			/>
		);
	}

	if (board.kind === "rule") {
		return (
			<RuleBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				ruleId={board.subjectId}
				onEdit={() => settingsPanel.setSection("rules")}
				onOpenRun={(runId) =>
					openBoard({ kind: "run", subjectId: runId, runId })
				}
			/>
		);
	}

	// One page for both kinds, because they are one record separated by
	// `kind`. Neither reads a trace, so neither takes
	// `board.runId`.
	if (board.kind === "world" || board.kind === "guardrail") {
		return (
			<LensBoardPage
				username={username as string}
				graphSlug={graphSlug as string}
				kind={board.kind}
				lensId={board.subjectId}
				// `Edit` puts the Govern panel back on this lens, drilled in —
				// the board reads and the acts stay in the section.
				onEdit={(kind, lensId) => governPanel.reveal(kind, lensId)}
			/>
		);
	}

	// The agent's page — the one declared page that edits. It
	// reads no trace, so it takes no `board.runId`.
	// The journal drawn wide. It binds to the Graph, not to a run,
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

	// A project's page — its tabs, a branch and a finding. What it cites
	// opens where it lives: a run as its board, a dataset in Datasets.
	if (board.kind === "project") {
		return (
			<ProjectPage
				username={username as string}
				graphSlug={graphSlug as string}
				projectKey={board.subjectId}
				onOpenRun={(id) => openBoard({ kind: "run", subjectId: id, runId: id })}
				onOpenDataset={openDataset}
			/>
		);
	}

	if (board.kind === "decisions") {
		return (
			<DecisionsPage
				username={username as string}
				graphSlug={graphSlug as string}
				onOpenProject={openProjectPage}
			/>
		);
	}

	// The plugin registry's pages are install-level; a function's page also
	// reads the Graph's catalogue for who uses it and how it fans out. A
	// function on a plugin opens beside it, and back.
	if (board.kind === "plugin") {
		return (
			<PluginPage
				name={board.subjectId}
				onOpenFunction={(key) =>
					openBoard({ kind: "function", subjectId: key })
				}
			/>
		);
	}

	if (board.kind === "function") {
		return (
			<FunctionPage
				taskKey={board.subjectId}
				username={username as string}
				graphSlug={graphSlug as string}
				onOpenPlugin={(name) => openBoard({ kind: "plugin", subjectId: name })}
				onOpenFunction={(key) =>
					openBoard({ kind: "function", subjectId: key })
				}
			/>
		);
	}

	if (board.kind === "template") {
		return (
			<TemplatePage
				username={username as string}
				graphSlug={graphSlug as string}
				templateId={board.subjectId}
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

	// What `⋯` opens on the plan page — each a record of one
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

	// The plan page — Overview · Layers · Flow · Activity, read over
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

/** `Run #1002`, or the run's address until its number is read. */
function runTitle(runId: string, numbers: Map<string, number>): string {
	const n = numbers.get(runId);
	return n == null ? runAddress(runId) : `Run #${n}`;
}

/** The names a declared tab is titled by, each read off a list the page already holds. */
export interface BoardTitleNames {
	modelsView: ReturnType<typeof useModelsView>["view"];
	modelName: (id: string) => string | undefined;
	lensNameById: Map<string, string>;
	agentNameById: Map<string, string>;
	skillNameById: Map<string, string>;
	runNumberById: Map<string, number>;
	planRefById: Map<string, string>;
	projectNameByKey: Map<string, string>;
}

/**
 * A declared tab's title. Most kinds are titled by their kind — one skill
 * board, and the crumb inside says which record. A lens, an agent and a project are titled
 * by name, and a run by its number, `Run #1002` — its address, `run:3c414b9f`,
 * only until the number is read — so two open runs are two readable tabs.
 */
export function boardTitle(board: OpenBoard, names: BoardTitleNames): string {
	const {
		modelsView,
		modelName,
		lensNameById,
		agentNameById,
		skillNameById,
		runNumberById,
		planRefById,
		projectNameByKey,
	} = names;
	return (
		// One board, titled by its scope — `All models` or `AirRoutes`.
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
						: board.kind === "project"
							? (projectNameByKey.get(board.subjectId) ?? board.subjectId)
							: board.kind === "plugin" || board.kind === "function"
								? board.subjectId
								: board.kind === "run"
									? runTitle(board.subjectId, runNumberById)
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
