/**
 * The graphs module's public surface — the only file another module imports.
 *
 * The Graph record, its setup state and the gates over it are wire types in
 * `@invana-studio/core`.
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
