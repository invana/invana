/**
 * `@invana-studio/assistant` — the chat: its centred start, the docked panel
 * and the pill that reopens it, sessions, the composer (Ask · Cypher ·
 * Gremlin), the answer surface and the trace, the console under the canvas,
 * the bridge that paints an ask onto a data canvas, and the graph info
 * panel's recent sessions. Session, run and emission records live in
 * `@invana-studio/core`.
 *
 * It imports no shell and no product. What it borrows from the page that hosts
 * it — a board's banner, a rule's board, the Graph's worlds, a step's rules,
 * the set-up lock — comes in through `AssistantSlotsContext` and props.
 */

export { AssistantHost } from "./AssistantHost";
export { AssistantReopenPill } from "./AssistantReopenPill";
export {
	type AssistantSlots,
	AssistantSlotsContext,
	type SharedAnswer,
} from "./AssistantSlots";
export { AssistantStart } from "./AssistantStart";
export { sessionsApi } from "./api";
export { ConsolePanel } from "./console/ConsolePanel";
export {
	type ConsoleTab,
	countsOf,
	queryStepsOf,
} from "./console/consoleRecords";
export {
	useConsoleParam,
	useOpenConsoleOnSettle,
} from "./console/useConsoleParam";
export { attachmentFor } from "./SessionComposer";
export { StepList } from "./SessionSteps";
export {
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
	SessionTutorialModal,
} from "./SessionTutorialModal";
export { useAssistantCanvasBridge } from "./useAssistantCanvasBridge";
export { useSessions } from "./useSessions";
