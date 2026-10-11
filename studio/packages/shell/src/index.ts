/**
 * `@invana-studio/shell` — what every product shares: `<StudioShell>` (the one
 * `AppLayoutV2` composition, with its header and `leftNav`), the product
 * registry and action registry, sign-in, profile settings, the error page
 * and the theme bridges. It never imports a product; the app hands it the list.
 *
 * Activity and setup live here too: the Activity page (its seven tabs, the
 * journal and a run's page), the events log (a Graph's and
 * the platform's), the header's bell, and setup's board, lesson,
 * timeline and lock. What they borrow from the products arrives through
 * `ActivitySlotsContext` and `SetupSlotsContext`. The Graph's own URL and
 * Activity are the shell's routes (`graphRoutes`).
 *
 * So do the Graph list and the regions every graph-scoped product reads: the
 * open `leftSection` panel and its stack keys, who holds `rightSection`, and
 * the page's params read off its path (`regions/`).
 */

export * from "./actions";
export type { ActivitySlots } from "./activity/ActivitySlots";
export { ActivitySlotsContext } from "./activity/ActivitySlots";
export { activityPath } from "./activity/activityPath";
export type { EventListResponse } from "./activity/events/types";
export { RunBoardPage } from "./activity/runs/boards/RunBoardPage";
export { runAddress } from "./activity/runs/boards/runBoards";
export { useRunStep } from "./activity/runs/boards/useRunStep";
export { useRunsQuery } from "./activity/runs/queries";
export { RunsBoardPage } from "./activity/runs/RunsBoardPage";
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
export { DeclaredBoardContext, useReport } from "./boards/useReport";
export { boardVersionsApi } from "./boards/versionsApi";
export * from "./components/AppVersion";
export * from "./components/ConfirmDialog";
export * from "./components/ProtectedRoute";
export * from "./components/SaturationBridge";
export * from "./components/ThemeSyncBridge";
export { CanonicalRoute, graphRoutes } from "./graphRoutes";
export * from "./pages/auth/LoginPage";
export * from "./pages/ErrorPage";
export { GraphCreatePage } from "./pages/graphs/GraphCreatePage";
export { GraphForm } from "./pages/graphs/GraphForm";
export { GraphsListPage } from "./pages/graphs/GraphsListPage";
export { PlatformEventsPage } from "./pages/platform/PlatformEventsPage";
export * from "./pages/settings/ProfileSettingsPage";
export * from "./products";
export {
	LEGACY_PANEL_PARAM,
	type LeftNavKey,
	PANEL_PARAM,
	STACK_PARAMS,
	TAB_PARAM,
	useLeftSection,
} from "./regions/useLeftSection";
export {
	requestOpenSession,
	useOpenSessionRequest,
} from "./regions/useOpenSessionRequest";
export { usePageParams } from "./regions/usePageParams";
export {
	type RightSectionKey,
	useRightSection,
} from "./regions/useRightSection";
export { SECTION_PARAM, useStackSections } from "./regions/useStackSections";
export * from "./StudioShell";
export { OnboardingWizard } from "./setup/OnboardingWizard";
export { SetupLock } from "./setup/SetupLock";
export type { SetupSlots } from "./setup/SetupSlots";
export { SetupSlotsContext } from "./setup/SetupSlots";
export { SetupTimeline } from "./setup/SetupTimeline";
export { useOnboarding } from "./setup/useOnboarding";
