import { AgentsViewPanel } from "@/pages/graphs-detail/features/agents";
import type { useSessions } from "@/pages/graphs-detail/features/assistant";
import type { OpenBoard } from "@/pages/graphs-detail/features/boards";
import type { CanvasStyling } from "@/pages/graphs-detail/features/boards";
import { ExplorerViewPanel } from "@/pages/graphs-detail/features/explorer";
import { LensesViewPanel } from "@/pages/graphs-detail/features/lenses";
import type { LensKind } from "@/pages/graphs-detail/features/lenses";
import {
	type ModelSelection,
	ModelViewPanel,
} from "@/pages/graphs-detail/features/models";
import { LibraryViewPanel } from "@/pages/graphs-detail/features/plans";
import { taskPlansApi } from "@/pages/graphs-detail/features/plans";
import { ProjectsViewPanel } from "@/pages/graphs-detail/features/projects";
import { RunsViewPanel } from "@/pages/graphs-detail/features/runs";
import { SkillsViewPanel } from "@/pages/graphs-detail/features/skills/SkillsViewPanel";
import type { useLayeredCanvas } from "@/pages/graphs-detail/shell/useLayeredCanvas";
import type { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import { reportBoundaryError } from "@/services/telemetry/errors";
import type { QueryResultItem } from "@/types/query";
import type { GraphCanvas } from "@invana/graph";
import { ErrorBoundary } from "@invana/ui";
import type { Dispatch, ReactNode, SetStateAction } from "react";

type Sessions = ReturnType<typeof useSessions>;

/** What the `leftSection` occupant reads from the page that hosts it. */
export interface LeftSectionDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	settingsPanel: ReturnType<typeof useLeftSection>;
	closeLeftPanel: () => void;
	layered: ReturnType<typeof useLayeredCanvas>;
	openBoard: (board: OpenBoard) => void;
	openLensBoard: (kind: LensKind, lensId: string) => void;
	openWorkPanel: (
		section: "projects" | "runs" | "library" | "agents" | "skills",
	) => void;
	openAgentPage: (id: string) => void;
	showAgentCanvas: (kind: "envelope" | "lineage", id: string) => void;
	modelSelection: ModelSelection | null;
	setModelSelection: Dispatch<SetStateAction<ModelSelection | null>>;
	showModelsPage: () => Record<string, string | null>;
	modelName: (id: string) => string | undefined;
	canvas: GraphCanvas | null;
	selected: QueryResultItem | null;
	styling: CanvasStyling;
	threadWorldId: Sessions["world"]["threadLensId"];
	activeSessionId: Sessions["activeSessionId"];
	sessionTitleById: Map<string, string>;
}

/**
 * The `leftSection` occupant for the open `?panel` key, or null when the page
 * draws nothing there. Each panel owns the canvas kind it opens, which is why
 * the selection it drives lives above it, in `useLayeredCanvas`.
 */
export function leftSectionContent(deps: LeftSectionDeps): ReactNode {
	const {
		username,
		graphSlug,
		settingsPanel,
		closeLeftPanel,
		layered,
		openBoard,
		openLensBoard,
		openWorkPanel,
		openAgentPage,
		showAgentCanvas,
		modelSelection,
		setModelSelection,
		showModelsPage,
		modelName,
		canvas,
		selected,
		styling,
		threadWorldId,
		activeSessionId,
		sessionTitleById,
	} = deps;
	const {
		setSelectedProjectKey,
		setWorkKind,
		setSelectedAgentId,
		setSelectedWorkflowKey,
		selectedStepId,
		selectedSkillId,
		setSelectedSkillId,
		selectedAgentId,
		setSelectedLineageEdge,
		selectedLineageEdge,
		setSelectedTaskId,
	} = layered;
	return settingsPanel.section === "model" ? (
		// The panel lists; the page acts (MP4). Its selection is the page's
		// scope, and both are the URL's — so a row picked here reads on the
		// `models` board beside it. A stack with no panel header above its
		// sections (G33 · ME17), so it takes no `onClose`.
		<ModelViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			selection={modelSelection}
			onSelect={setModelSelection}
			onShowPage={showModelsPage}
		/>
	) : settingsPanel.section === "projects" ? (
		// **Projects owns Todos** (PT7) — two sections, `Projects` over `Todos`,
		// the same stack shape Library takes. With no project drilled into, the
		// Todos section is every Todo in the Graph: the *No project* bucket.
		<ProjectsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			onProjectChange={(key) => {
				setSelectedProjectKey(key);
				if (!key) setWorkKind(null);
			}}
			onOpenPlanCanvas={() => setWorkKind("plan")}
			onOpenAgent={(id) => {
				setSelectedAgentId(id);
				setWorkKind("lineage");
				openWorkPanel("agents");
			}}
			// A statement on a step row opens the rule's board beside the
			// section, the same way `More` does from Rules (RU11 · RU12).
			onOpenRule={(ruleId) => openBoard({ kind: "rule", subjectId: ruleId })}
		/>
	) : settingsPanel.section === "runs" ? (
		// **Runs is execution** — the journal, and nothing else, as one list
		// (G41 · SR1). Todos are not here: they live under Projects, because a
		// Todo without its project is a to-do list (PT7).
		<RunsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			onClose={closeLeftPanel}
			onOpenRunDashboard={(runId, stepId) =>
				openBoard({ kind: "run", subjectId: runId, runId, stepId })
			}
			// The journal drawn wide, beside the list (SR70).
			onOpenRunsBoard={() =>
				openBoard({ kind: "runs", subjectId: graphSlug as string })
			}
			// The run stays in the section; the plan it ran is drawn beside it.
			onOpenPlan={(key) => {
				setSelectedWorkflowKey(key);
				setWorkKind("workflow");
			}}
		/>
	) : settingsPanel.section === "library" ? (
		// **Library is definition** — Plans · Catalogue · Templates, stacked,
		// with no panel header above them (G33 · G41): what can be run, the
		// closed vocabulary it is written in, and how its output renders.
		<LibraryViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			selectedStepId={selectedStepId}
			onOpenAgent={(id) => {
				openWorkPanel("agents");
				openAgentPage(id);
			}}
			planExportUrl={(key) =>
				taskPlansApi.exportUrl(username as string, graphSlug as string, key)
			}
		/>
	) : settingsPanel.section === "skills" ? (
		// A skill is a setting that hangs over the work, so its panel opens
		// beside whatever canvas is already there — it takes no kind of its own.
		<SkillsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			onClose={closeLeftPanel}
			selectedSkillId={selectedSkillId}
			onSelectSkill={setSelectedSkillId}
			// `Open` — the skill's page, and the stack stays (SK17 · SK37).
			onOpenSkillPage={(id) => openBoard({ kind: "skill", subjectId: id })}
			onOpenRuleDashboard={(id) => openBoard({ kind: "rule", subjectId: id })}
		/>
	) : settingsPanel.section === "govern" ? (
		// Govern holds Worlds over Guardrails as two sections of one panel (GV17),
		// with no panel header above them — the same stack shape Library and
		// Projects take. It opens no canvas: a world is a bound the *other*
		// panels run inside, so it hangs over whatever is already drawn.
		<LensesViewPanel
			username={username}
			graphSlug={graphSlug}
			// A drill-in opens that lens as a page, titled with its own name
			// (WO15 · GR14) — the section keeps the picking reading, the board
			// carries the auditing one.
			onOpenBoard={openLensBoard}
		/>
	) : settingsPanel.section === "agents" ? (
		// Agents holds the agents over the LLMs as two sections of one panel
		// (PM6 · GV18) — a provider is what an agent's cast resolves against,
		// so it is read where agents are rather than in a tab of Settings.
		<AgentsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			selectedAgentId={selectedAgentId}
			onSelectAgent={(id) => {
				setSelectedAgentId(id);
				setSelectedLineageEdge(null);
			}}
			onOpenAgentPage={openAgentPage}
			selectedEdge={selectedLineageEdge}
			onOpenLineage={(id) => showAgentCanvas("lineage", id)}
			onOpenTask={(id) => {
				// A Todo lives under Projects (PT7); the rail's Tasks icon is
				// execution only.
				setSelectedTaskId(id);
				openWorkPanel("projects");
			}}
		/>
	) : settingsPanel.section === "explorer" ? (
		// Sessions is not a left panel (AD1); the Explorer's own is the graph's
		// type list and the selection (selection-and-the-panel.md) — the legend
		// for the drawing beside it. It is a `?panel` key like every other, so
		// closing it leaves the column empty rather than falling back here.
		<ExplorerViewPanel
			username={username}
			graphSlug={graphSlug}
			canvas={canvas}
			selected={selected}
			styling={styling}
			lensId={threadWorldId}
			canvasName={
				activeSessionId ? sessionTitleById.get(activeSessionId) : undefined
			}
			modelName={modelName}
			onClose={closeLeftPanel}
		/>
	) : null;
}

/**
 * The `leftSection` region — the occupant for the open `?panel` key, sized for
 * long queries, inside an error boundary keyed on the key so opening another
 * panel starts it afresh. `undefined` when there is no occupant.
 */
export function leftSection(deps: LeftSectionDeps) {
	const { settingsPanel } = deps;
	// One rail, one page: the `leftSection` occupant for the open `?panel` key.
	const leftContent = leftSectionContent(deps);
	// One column, one open `?panel` key. With no key open — or one this
	// page draws nothing for — there is no left column at all.
	return leftContent
		? {
				// Generous max so long Cypher/Gremlin queries can spread out.
				// mainSection.minSize below still keeps the canvas usable when
				// the user drags the divider far right.
				defaultSize: "300px",
				minSize: "240px",
				maxSize: "900px",
				collapsible: false,
				// A broken panel shows the kit's notice in its column and
				// is reported; opening another panel starts it afresh.
				content: (
					<ErrorBoundary
						key={settingsPanel.section}
						onError={reportBoundaryError}
					>
						{leftContent}
					</ErrorBoundary>
				),
			}
		: undefined;
}
