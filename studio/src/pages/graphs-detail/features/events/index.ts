/**
 * The events module's public surface — the only file another module imports.
 */

export { matchesEventSearch } from "@/pages/graphs-detail/features/events/eventSearch";
export { EventsTab } from "@/pages/graphs-detail/features/events/EventsTab";
export {
	StatusFilter,
	matchesStatusFilter,
} from "@/pages/graphs-detail/features/events/eventStatus";
export { EventTypeFilter } from "@/pages/graphs-detail/features/events/EventTypeFilter";
export { useGlobalEventsQuery } from "@/pages/graphs-detail/features/events/queries";
export type {
	AuditEvent,
	EventListResponse,
} from "@/pages/graphs-detail/features/events/types";
