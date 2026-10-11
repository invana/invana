import type * as graph from "@invana/graph";
import { ErrorBoundary } from "@invana/ui";
import type { useConsoleParam, useSessions } from "@invana-studio/assistant";
import { ConsolePanel } from "@invana-studio/assistant";
import { reportBoundaryError } from "@invana-studio/core";
import type { useDataBoards } from "@/pages/graphs-detail/shell/useDataBoards";

/** What the console reads from the page that hosts it. */
export interface ConsoleSectionDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	console: ReturnType<typeof useConsoleParam>;
	sessionState: ReturnType<typeof useSessions>;
	dataBoards: ReturnType<typeof useDataBoards>;
	/** A data canvas is the page in front — the console describes its drawing. */
	dataBoardInFront: boolean;
}

/**
 * The `bottomSection` region — the console under the data canvas in front,
 * holding the open thread's latest reply. `undefined` while it is collapsed,
 * and whenever there is no data canvas in front: it describes a drawing, so it
 * closes with the canvas rather than standing under a page that drew nothing.
 */
export function consoleSection(deps: ConsoleSectionDeps) {
	const {
		username,
		graphSlug,
		console: param,
		sessionState,
		dataBoards,
		dataBoardInFront,
	} = deps;
	const { activeSession, isRunning } = sessionState;
	const { canvas, canvasData, setSelectedId, resultsByMessageId, handleRerun } =
		dataBoards;
	if (!param.tab || !activeSession || !dataBoardInFront) return undefined;
	if (!username || !graphSlug) return undefined;

	// The reply the canvas drew from: the latest that is not a canvas operation.
	const reply =
		[...activeSession.messages]
			.reverse()
			.find((m) => m.role === "assistant" && !m.operation) ?? null;

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
					username={username}
					graphSlug={graphSlug}
					message={reply}
					result={reply ? resultsByMessageId[reply.id] : undefined}
					tab={param.tab}
					onTabChange={param.open}
					onCollapse={param.collapse}
					onRerun={() => {
						if (reply) void handleRerun(reply.id);
					}}
					isRunning={isRunning}
					onSelectElement={selectElement}
				/>
			</ErrorBoundary>
		),
	};
}
