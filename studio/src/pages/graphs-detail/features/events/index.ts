/**
 * The events module's public surface — the only file another module imports.
 */

export { EventsTab } from "@/pages/graphs-detail/features/events/EventsTab";
export { EventTypeFilter } from "@/pages/graphs-detail/features/events/EventTypeFilter";
export { matchesEventSearch } from "@/pages/graphs-detail/features/events/eventSearch";
export {
	matchesStatusFilter,
	StatusFilter,
} from "@/pages/graphs-detail/features/events/eventStatus";
export { useGlobalEventsQuery } from "@/pages/graphs-detail/features/events/queries";
export type {
	AuditEvent,
	EventListResponse,
} from "@/pages/graphs-detail/features/events/types";
