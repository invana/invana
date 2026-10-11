/**
 * The assistant module's public surface — the only file another module imports.
 */

export type { AssistantViewPanelProps } from "@/pages/graphs-detail/features/assistant/AssistantViewPanel";
export { AssistantViewPanel } from "@/pages/graphs-detail/features/assistant/AssistantViewPanel";
export type {
	Emission,
	EmissionKind,
	TemplateOffer,
} from "@/pages/graphs-detail/features/assistant/answer-surface/types";
export { sessionsApi } from "@/pages/graphs-detail/features/assistant/api";
export { attachmentFor } from "@/pages/graphs-detail/features/assistant/SessionComposer";
export {
	StepList,
	totalDuration,
} from "@/pages/graphs-detail/features/assistant/SessionSteps";
export {
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
	SessionTutorialModal,
} from "@/pages/graphs-detail/features/assistant/SessionTutorialModal";
export type {
	Session,
	SessionMessage,
} from "@/pages/graphs-detail/features/assistant/types";
export { useAssistantCanvasBridge } from "@/pages/graphs-detail/features/assistant/useAssistantCanvasBridge";
export {
	sessionsListKey,
	useSessions,
} from "@/pages/graphs-detail/features/assistant/useSessions";
export { WorldPicker } from "@/pages/graphs-detail/features/assistant/WorldPicker";
