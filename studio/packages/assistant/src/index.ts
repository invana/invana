/**
 * `@invana-studio/assistant` — the chat: sessions, the composer, the answer
 * surface and the trace, the bridge that paints an ask onto a data canvas, and
 * the graph info panel's recent sessions. Session, run and emission records
 * live in `@invana-studio/core`.
 *
 * It imports no shell and no product. What it borrows from the page that hosts
 * it — a board's banner, a rule's board, the Graph's worlds, a step's rules,
 * the set-up lock — comes in through `AssistantSlotsContext` and props.
 */

export { AssistantHost } from "./AssistantHost";
export {
	type AssistantSlots,
	AssistantSlotsContext,
} from "./AssistantSlots";
export { sessionsApi } from "./api";
export { RecentSessions } from "./RecentSessions";
export { attachmentFor } from "./SessionComposer";
export { StepList, totalDuration } from "./SessionSteps";
export {
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
	SessionTutorialModal,
} from "./SessionTutorialModal";
export { useAssistantCanvasBridge } from "./useAssistantCanvasBridge";
export { useSessions } from "./useSessions";
