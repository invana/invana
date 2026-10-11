/**
 * What the graph page lends the Modeller: the Graph's connection read and the
 * re-read of the database's schema, both from the graphs feature. The Modeller
 * may not import the app, so the page hands them in through
 * `ModellerSlotsContext`.
 *
 * One module-level object, so the hooks it carries are the same functions on
 * every render.
 */

import type { ModellerSlots } from "@invana-studio/modeller";
import {
	graphsApi,
	useGraphConnectionQuery,
} from "@/pages/graphs-detail/features/graphs";

export const modellerSlots: ModellerSlots = {
	useGraphConnectionQuery,
	introspectConnection: graphsApi.introspectConnection,
};
