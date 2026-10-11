/**
 * What the app lends the Modeller: the page its routes render (today's graph
 * page). The Modeller may not import the app, so the router hands it in
 * through `ModellerSlotsContext`.
 *
 * One module-level object, so the component it carries is the same on every
 * render.
 */

import type { ModellerSlots } from "@invana-studio/modeller";
import { GraphPageRoute } from "./legacyGraph";

export const modellerSlots: ModellerSlots = {
	Page: GraphPageRoute,
};
