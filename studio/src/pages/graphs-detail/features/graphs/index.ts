/**
 * The graphs module's public surface — the only file another module imports.
 */

export { graphsApi } from "@/pages/graphs-detail/features/graphs/api";
export {
	useCreateGraphMutation,
	useDeleteGraphMutation,
	useGraphConnectionQuery,
	useGraphQuery,
	useGraphsQuery,
	useSetupSectionMutation,
} from "@/pages/graphs-detail/features/graphs/queries";
export { SettingsViewPanel } from "@/pages/graphs-detail/features/graphs/SettingsViewPanel";
export type {
	Graph,
	GraphConnectionCreate,
	GraphConnectionRead,
	QueryLanguage,
	SetupGate,
	SetupSection,
	SetupSectionState,
} from "@/pages/graphs-detail/features/graphs/types";
export {
	CONNECTOR_OPTIONS,
	hasOutstandingSetup,
	isGateOpen,
	isSetupComplete,
	missingForGate,
	SETUP_REQUIRED,
	SETUP_SKIPPABLE,
	setupSectionStatus,
} from "@/pages/graphs-detail/features/graphs/types";
