import { ErrorBoundary } from "@invana/ui";
import type { LLMProvider } from "@invana-studio/agents";
import type { useSessions } from "@invana-studio/assistant";
import { AssistantHost, attachmentFor } from "@invana-studio/assistant";
import type { useGraphQuery } from "@invana-studio/core";
import { ASSISTANT_SECTION, reportBoundaryError } from "@invana-studio/core";
import type {
	RightSectionKey,
	useLeftSection,
	useRightSection,
} from "@invana-studio/shell";
import { SetupLock } from "@invana-studio/shell";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { useDataBoards } from "@/host/useDataBoards";

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
	/** Open the console — Records from a reply's count, Log from a failure. */
	openConsoleTab: (tab: "records" | "log") => void;
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
		openConsoleTab,
	} = deps;
	const {
		sessions,
		activeSession,
		isRunning,
		fetchContext,
		stop,
		setPinned,
		setArchived,
		world,
		setTokensPerRun,
	} = sessionState;
	const {
		resultsByMessageId,
		selected,
		availableLanguages,
		defaultLanguage,
		handleOpenSession,
		handleLoadToCanvasClick,
		handleRun,
		handleRerun,
		handleBack,
		handleSaveState,
	} = dataBoards;

	// The assistant, as the right side's `assistant` occupant. Its close closes
	// the region.
	const assistantContent = (
		<AssistantHost
			connectionMissing={connectionMissing}
			cannotAnswer={cannotAnswer}
			renderLock={(gate, surface) => (
				<SetupLock graph={graphContainer} gate={gate} surface={surface} />
			)}
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
			onOpenSession={handleOpenSession}
			onBack={handleBack}
			onRerun={handleRerun}
			onFetchContext={fetchContext}
			results={resultsByMessageId}
			onLoadToCanvas={handleLoadToCanvasClick}
			onOpenConsole={openConsoleTab}
			onSaveView={() => void handleSaveState()}
			onClose={right.close}
			// The chip rides above the composer's input, not above the panel
			// (the-assistant.md).
			attachment={attachmentDetached ? null : attachmentFor(selected)}
			onRemoveAttachment={() => setAttachmentDetached(true)}
			onPin={setPinned}
			onArchive={setArchived}
			onSetTokensPerRun={setTokensPerRun}
		/>
	);

	// The occupants of `rightSection`, keyed by `?right=`. Inspecting and asking
	// stopped competing for the side the moment one param named which of them
	// holds it; closing it closes the region rather than restoring the other
	// (the-assistant.md).
	const rightSections: Record<
		RightSectionKey,
		{ content: ReactNode; size?: typeof ASSISTANT_SECTION }
	> = {
		assistant: {
			content: assistantContent,
			size: ASSISTANT_SECTION,
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
