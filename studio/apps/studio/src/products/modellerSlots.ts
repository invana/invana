/**
 * What the app lends the Modeller: the page its routes render (today's graph
 * page) and the Agents tab of Graph settings, whose fields still live in the
 * app's graphs module. The Modeller may not import the app, so the router hands
 * both in through `ModellerSlotsContext`.
 *
 * One module-level object, so the components it carries are the same on every
 * render.
 */

import type { ModellerSlots } from "@invana-studio/modeller";
import { ConcurrencyFields } from "@/pages/graphs-detail/features/graphs";
import { GraphPageRoute } from "./legacyGraph";

export const modellerSlots: ModellerSlots = {
	Page: GraphPageRoute,
	AgentsSettings: ConcurrencyFields,
};
