/**
 * `@invana-studio/shell` — what every product shares: `<StudioShell>` (the one
 * `AppLayoutV2` composition, with its header and `leftNav`), the product
 * registry and action registry, sign-in, profile settings, the error page
 * and the theme bridges. It never imports a product; the app hands it the list.
 *
 * Activity and setup live here too: the Activity page (its seven tabs, the
 * journal and a run's page), the Runs panel, the events log (a Graph's and
 * the platform's), the header's bell, and setup's board, lesson,
 * timeline and lock. What they borrow from the graph page arrives through
 * `ActivitySlotsContext` and `SetupSlotsContext`.
 */

export * from "./actions";
export { ActivityPage } from "./activity/ActivityPage";
export type { ActivitySlots } from "./activity/ActivitySlots";
export { ActivitySlotsContext } from "./activity/ActivitySlots";
export { activityOf } from "./activity/activityPath";
export { EventsTab } from "./activity/events/EventsTab";
export type { EventListResponse } from "./activity/events/types";
export { RunBoardPage } from "./activity/runs/boards/RunBoardPage";
export { runAddress } from "./activity/runs/boards/runBoards";
export { useRunStep } from "./activity/runs/boards/useRunStep";
export { useRunsQuery } from "./activity/runs/queries";
export { RunsBoardPage } from "./activity/runs/RunsBoardPage";
export { RunsViewPanel } from "./activity/runs/RunsViewPanel";
export { StepTouchWidget } from "./activity/runs/touches/StepTouchWidget";
// The board record and its versions and reports — what a canvas tab saves.
export { boardsApi } from "./boards/api";
export type { CanvasKind, DeclaredKind, OpenBoard } from "./boards/boardKinds";
export {
	BOARD_KINDS,
	boardPageId,
	CANVAS_KINDS,
	DECLARED_KINDS,
	declaredPage,
	parseBoardPageId,
} from "./boards/boardKinds";
export {
	count,
	omit,
	routedAction,
	specPanel,
	VIEW_ACTION,
	VIEW_BOARD,
	VIEW_SPEC,
} from "./boards/boardSpec";
export { captureBanner, STATE_THUMB_MAX_EDGE } from "./boards/captureBanner";
export {
	boardReportsKey,
	useBoardReportsQuery,
	useBoardsQuery,
	useCanvasBannerQuery,
	useCanvasStateBannerQuery,
	useCanvasStatesQuery,
	useCreateCanvasMutation,
	useCreateCanvasStateMutation,
	useUpdateCanvasMutation,
} from "./boards/queries";
export { boardReportsApi } from "./boards/reportsApi";
export type { FlowOptions } from "./boards/TaskFlowWidget";
export { TaskFlowWidget } from "./boards/TaskFlowWidget";
export type {
	Board,
	BoardVersionCause,
	BoardVersionSummary,
	CanvasStyling,
	CaptureCanvasState,
} from "./boards/types";
export { useBoardVersions } from "./boards/useBoardVersions";
export { boardVersionsApi } from "./boards/versionsApi";
export * from "./components/AppVersion";
export * from "./components/ConfirmDialog";
export * from "./components/ProtectedRoute";
export * from "./components/SaturationBridge";
export * from "./components/ThemeSyncBridge";
export * from "./pages/auth/LoginPage";
export * from "./pages/ErrorPage";
export { PlatformEventsPage } from "./pages/platform/PlatformEventsPage";
export * from "./pages/settings/ProfileSettingsPage";
export * from "./products";
export * from "./StudioShell";
export { OnboardingWizard } from "./setup/OnboardingWizard";
export { SetupLock } from "./setup/SetupLock";
export type { SetupSlots } from "./setup/SetupSlots";
export { SetupSlotsContext } from "./setup/SetupSlots";
export { SetupTimeline } from "./setup/SetupTimeline";
export { useOnboarding } from "./setup/useOnboarding";
