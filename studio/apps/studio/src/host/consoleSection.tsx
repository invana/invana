import type * as graph from "@invana/graph";
import { ErrorBoundary } from "@invana/ui";
import type { useConsoleParam, useSessions } from "@invana-studio/assistant";
import { ConsolePanel } from "@invana-studio/assistant";
import { reportBoundaryError } from "@invana-studio/core";
import { QueryStepBoard } from "@invana-studio/shell";
import type { useDataBoards } from "@/host/useDataBoards";

/** What the console reads from the page that hosts it. */
export interface ConsoleSectionDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	console: ReturnType<typeof useConsoleParam>;
	sessionState: ReturnType<typeof useSessions>;
	dataBoards: ReturnType<typeof useDataBoards>;
	/** A data canvas is the page in front — the console describes its drawing. */
	dataBoardInFront: boolean;
	/** Open a whole run on its own page — a query step's run crumb. */
	onOpenRun: (runId: string, stepId?: string) => void;
}

/**
 * The `bottomSection` region — the console under the data canvas in front:
 * that canvas's data and the open thread's queries. `undefined` while it is
 * collapsed, and whenever there is no data canvas in front: it describes a
 * drawing, so it closes with the canvas rather than standing under a page
 * that drew nothing.
 */
export function consoleSection(deps: ConsoleSectionDeps) {
	const {
		username,
		graphSlug,
		console: param,
		sessionState,
		dataBoards,
		dataBoardInFront,
		onOpenRun,
	} = deps;
	const { activeSession, isRunning } = sessionState;
	const { canvas, canvasData, setSelectedId, handleRerun } = dataBoards;
	if (!param.tab || !activeSession || !dataBoardInFront) return undefined;
	if (!username || !graphSlug) return undefined;

	// A row and a drawn element are two views of one record, so a row selects
	// on the canvas through the same behaviour a click on the element uses.
	const selectElement = (id: string) => {
		const select =
			canvas?.behaviours.get<graph.ClickSelectBehaviour>("click-select");
		const isEdge = canvasData.find((i) => String(i.id) === id)?.type === "edge";
		select?.select(id, isEdge ? "connector" : "shape");
		setSelectedId(id);
	};

	return {
		content: (
			<ErrorBoundary onError={reportBoundaryError}>
				<ConsolePanel
					tab={param.tab}
					data={param.data}
					query={param.query}
					items={canvasData}
					session={activeSession}
					onOpenData={param.openData}
					onOpenQueries={param.openQueries}
					onCollapse={param.collapse}
					onSelectElement={selectElement}
					onRerun={(messageId) => void handleRerun(messageId)}
					isRunning={isRunning}
					renderStep={(q) => (
						<QueryStepBoard
							// A new query is a new board: its tab starts where its status says.
							key={q.messageId}
							username={username}
							graphSlug={graphSlug}
							runId={q.runId as string}
							stepId={q.stepId as string}
							initialTab={q.status === "failed" ? "log" : "overview"}
							onOpenRun={(runId) => onOpenRun(runId, q.stepId)}
						/>
					)}
				/>
			</ErrorBoundary>
		),
	};
}
