import type { GraphCanvas } from "@invana/graph";
import { ErrorBoundary } from "@invana/ui";
import {
	AgentsSettingsViewPanel,
	AgentsViewPanel,
	LibraryViewPanel,
	OverviewViewPanel,
	PerformanceViewPanel,
	PluginsViewPanel,
	SkillsViewPanel,
	taskPlansApi,
} from "@invana-studio/agents";
import type { useSessions } from "@invana-studio/assistant";
import type { LensKind, QueryResultItem } from "@invana-studio/core";
import { reportBoundaryError } from "@invana-studio/core";
import { ExplorerViewPanel } from "@invana-studio/explorer";
import {
	LensesViewPanel,
	type ModelSelection,
	ModelViewPanel,
	RequestsViewPanel,
	RulesViewPanel,
} from "@invana-studio/modeller";
import { ProjectsViewPanel } from "@invana-studio/projects";
import type {
	CanvasStyling,
	OpenBoard,
	useLeftSection,
} from "@invana-studio/shell";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { useLayeredCanvas } from "@/host/useLayeredCanvas";

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
	/** The project's plan canvas, brought in front of any focused page. */
	showPlanCanvas: () => void;
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
function leftSectionContent(deps: LeftSectionDeps): ReactNode {
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
		showPlanCanvas,
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
		selectedStepId,
		selectedSkillId,
		setSelectedSkillId,
		selectedAgentId,
		setSelectedLineageEdge,
		selectedLineageEdge,
		setSelectedTaskId,
	} = layered;
	return settingsPanel.section === "model" ? (
		// The panel lists; the page acts. Its selection is the page's
		// scope, and both are the URL's — so a row picked here reads on the
		// `models` board beside it. A stack with no panel header above its
		// sections, so it takes no `onClose`.
		<ModelViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			selection={modelSelection}
			onSelect={setModelSelection}
			onShowPage={showModelsPage}
		/>
	) : settingsPanel.section === "projects" ? (
		// **Projects owns Todos** — two sections, `Projects` over `Todos`,
		// the same stack shape Library takes. With no project drilled into, the
		// Todos section is every Todo in the Graph: the *No project* bucket.
		<ProjectsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			onProjectChange={(key) => {
				setSelectedProjectKey(key);
				if (!key) setWorkKind(null);
			}}
			onOpenPlanCanvas={showPlanCanvas}
			onOpenAgent={(id) => {
				setSelectedAgentId(id);
				setWorkKind("lineage");
				openWorkPanel("agents");
			}}
			// A statement on a step row opens the rule's board beside the
			// section, the same way `More` does from Rules.
			onOpenRule={(ruleId) => openBoard({ kind: "rule", subjectId: ruleId })}
		/>
	) : settingsPanel.section === "library" ? (
		// **Library is definition** — Plans · Templates, stacked, with no panel
		// header above them: what can be run, and how its output renders.
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
			// `Open` — the skill's page, and the stack stays.
			onOpenSkillPage={(id) => openBoard({ kind: "skill", subjectId: id })}
		/>
	) : settingsPanel.section === "govern" ? (
		// Govern holds Worlds over Guardrails as two sections of one panel,
		// with no panel header above them — the same stack shape Library and
		// Projects take. It opens no canvas: a world is a bound the *other*
		// panels run inside, so it hangs over whatever is already drawn.
		<LensesViewPanel
			username={username}
			graphSlug={graphSlug}
			// A drill-in opens that lens as a page, titled with its own name
			// — the section keeps the picking reading, the board
			// carries the auditing one.
			onOpenBoard={openLensBoard}
		/>
	) : settingsPanel.section === "rules" ? (
		// The Modeller's Rules — the Graph's invariants. `More` opens a rule's
		// board beside the section, as it does from Skills.
		<RulesViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			onOpenRuleBoard={(id) => openBoard({ kind: "rule", subjectId: id })}
		/>
	) : settingsPanel.section === "requests" ? (
		<RequestsViewPanel />
	) : settingsPanel.section === "overview" ? (
		<OverviewViewPanel />
	) : settingsPanel.section === "plugins" ? (
		// The plugin registry over the task catalogue a plan is written in.
		<PluginsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
			onOpenPlugin={(name) => openBoard({ kind: "plugin", subjectId: name })}
		/>
	) : settingsPanel.section === "performance" ? (
		<PerformanceViewPanel />
	) : settingsPanel.section === "concurrency" ? (
		<AgentsSettingsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
		/>
	) : settingsPanel.section === "agents" ? (
		// Agents holds the agents over the LLMs as two sections of one panel
		// — a provider is what an agent's cast resolves against,
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
				// A Todo lives under Projects; the rail's Tasks icon is
				// execution only.
				setSelectedTaskId(id);
				openWorkPanel("projects");
			}}
		/>
	) : settingsPanel.section === "explorer" ? (
		// Sessions is not a left panel; the Explorer's own is the graph's
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
