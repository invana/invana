import type { GraphCanvas } from "@invana/graph";
import { ErrorBoundary } from "@invana/ui";
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
	openAgentPage: (id: string) => void;
	/** The project's plan canvas, brought in front of any focused page. */
	showPlanCanvas: () => void;
	modelSelection: ModelSelection | null;
	setModelSelection: Dispatch<SetStateAction<ModelSelection | null>>;
	showModelsPage: () => Record<string, string | null>;
	/** One model is open — the only Modeller page with a leftSection. */
	modelOpen: boolean;
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
		openAgentPage,
		showPlanCanvas,
		modelSelection,
		setModelSelection,
		showModelsPage,
		modelOpen,
		modelName,
		canvas,
		selected,
		styling,
		threadWorldId,
		activeSessionId,
		sessionTitleById,
	} = deps;
	const { setSelectedProjectKey, setWorkKind } = layered;
	return settingsPanel.section === "model" ? (
		// Only one model's page has a leftSection: the model's outline. The
		// global model, the models board and the stitch list have none.
		modelOpen ? (
			<ModelViewPanel
				username={username as string}
				graphSlug={graphSlug as string}
				selection={modelSelection}
				onSelect={setModelSelection}
				onShowPage={showModelsPage}
			/>
		) : null
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
			onOpenAgent={openAgentPage}
			// A statement on a step row opens the rule's board beside the
			// section, the same way `More` does from Rules.
			onOpenRule={(ruleId) => openBoard({ kind: "rule", subjectId: ruleId })}
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
