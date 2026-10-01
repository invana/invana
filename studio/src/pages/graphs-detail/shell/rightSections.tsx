import { ErrorBoundary } from "@invana/ui";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { useSessions } from "@/pages/graphs-detail/features/assistant";
import { attachmentFor } from "@/pages/graphs-detail/features/assistant";
import { InspectorViewPanel } from "@/pages/graphs-detail/features/explorer";
import type { useGraphQuery } from "@/pages/graphs-detail/features/graphs";
import type { LLMProvider } from "@/pages/graphs-detail/features/llms";
import type { useLeftSection } from "@/pages/graphs-detail/shared/useLeftSection";
import type {
	RightSectionKey,
	useRightSection,
} from "@/pages/graphs-detail/shared/useRightSection";
import { AssistantHost } from "@/pages/graphs-detail/shell/AssistantHost";
import type { useDataBoards } from "@/pages/graphs-detail/shell/useDataBoards";
import { reportBoundaryError } from "@/services/telemetry/errors";

/** What the right side's occupants read from the page that hosts them. */
export interface RightSectionDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	right: ReturnType<typeof useRightSection>;
	sessionState: ReturnType<typeof useSessions>;
	dataBoards: ReturnType<typeof useDataBoards>;
	/** The Graph has no connection, so the assistant has nothing to ask. */
	connectionMissing: boolean;
	/** The answering gate is shut. */
	cannotAnswer: boolean;
	graphContainer: ReturnType<typeof useGraphQuery>["data"];
	settingsPanel: ReturnType<typeof useLeftSection>;
	llmProviders: LLMProvider[];
	/** The canvas selection was taken off the next ask. */
	attachmentDetached: boolean;
	setAttachmentDetached: Dispatch<SetStateAction<boolean>>;
	closeInspector: () => void;
	/** A model's name by id, for an element's provenance line. */
	modelName: (id: string) => string | undefined;
}

/**
 * The `rightSection` region — its occupant for the open `?right=` key, sized
 * by that occupant, inside an error boundary keyed on the key so opening the
 * other occupant starts it afresh. `undefined` when the region is closed.
 */
export function rightSection(deps: RightSectionDeps) {
	const {
		username,
		graphSlug,
		right,
		sessionState,
		dataBoards,
		connectionMissing,
		cannotAnswer,
		graphContainer,
		settingsPanel,
		llmProviders,
		attachmentDetached,
		setAttachmentDetached,
		closeInspector,
		modelName,
	} = deps;
	const {
		sessions,
		activeSession,
		isRunning,
		isRefreshing,
		sort,
		setSort,
		showArchived,
		setShowArchived,
		fetchContext,
		setFeedback,
		stop,
		refresh,
		setPinned,
		setArchived,
		world,
		setSpendPerRun,
	} = sessionState;
	const {
		resultsByMessageId,
		canvasData,
		missingIds,
		bannerCanvasIdBySession,
		selected,
		availableLanguages,
		defaultLanguage,
		handleOpenSession,
		handleLoadToCanvasClick,
		handleRun,
		handleRerun,
		handleBack,
	} = dataBoards;

	// The assistant, as the right side's `assistant` occupant. Its close closes
	// the region.
	const assistantContent = (
		<AssistantHost
			connectionMissing={connectionMissing}
			cannotAnswer={cannotAnswer}
			graph={graphContainer}
			world={world}
			onManageWorlds={() => settingsPanel.setSection("govern")}
			availableLanguages={availableLanguages}
			defaultLanguage={defaultLanguage}
			llmProviders={llmProviders}
			onRun={handleRun}
			onStop={stop}
			isRunning={isRunning}
			sessions={sessions}
			activeSession={activeSession}
			username={username}
			graphSlug={graphSlug}
			bannerCanvasIdBySession={bannerCanvasIdBySession}
			onOpenSession={handleOpenSession}
			onBack={handleBack}
			onRerun={handleRerun}
			onFetchContext={fetchContext}
			onSetFeedback={setFeedback}
			results={resultsByMessageId}
			onLoadToCanvas={handleLoadToCanvasClick}
			onRefresh={refresh}
			isRefreshing={isRefreshing}
			onClose={right.close}
			// The chip rides above the composer's input, not above the panel
			// (the-assistant.md).
			attachment={attachmentDetached ? null : attachmentFor(selected)}
			onRemoveAttachment={() => setAttachmentDetached(true)}
			sort={sort}
			onSortChange={setSort}
			showArchived={showArchived}
			onShowArchivedChange={setShowArchived}
			onPin={setPinned}
			onArchive={setArchived}
			onSetSpendPerRun={setSpendPerRun}
		/>
	);

	// The occupants of `rightSection`, keyed by `?right=`. Inspecting and asking
	// stopped competing for the side the moment one param named which of them
	// holds it; closing it closes the region rather than restoring the other
	// (the-assistant.md).
	const rightSections: Record<RightSectionKey, { content: ReactNode }> = {
		assistant: {
			content: assistantContent,
		},
		inspector: {
			content: (
				<InspectorViewPanel
					selected={selected}
					allItems={canvasData}
					missingIds={missingIds}
					onClose={closeInspector}
					modelName={modelName}
					onOpenModel={() => {
						// A node's provenance line opens the journal that holds the run
						// that wrote it — the Runs panel, not an Imports panel of its own.
						// There is no model facet to narrow to: the journal
						// is filtered by kind, never by subject.
						settingsPanel.setSection("runs");
					}}
				/>
			),
		},
	};

	// One region, one occupant, looked up by `?right=`. A third occupant
	// is one more entry here — not another branch (graph-detail-page.md
	// ). Each entry carries its own size triple, because the size
	// belongs to what is in the region rather than to the region.
	return right.key
		? {
				...rightSections[right.key],
				content: (
					<ErrorBoundary key={right.key} onError={reportBoundaryError}>
						{rightSections[right.key].content}
					</ErrorBoundary>
				),
			}
		: undefined;
}
