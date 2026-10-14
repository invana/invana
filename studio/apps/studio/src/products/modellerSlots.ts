/**
 * What the app lends the Modeller: the page its routes render (the product
 * host). The Modeller may not import the app, so the router hands it in
 * through `ModellerSlotsContext`.
 *
 * One module-level object, so the component it carries is the same on every
 * render.
 */

import type { ModellerSlots } from "@invana-studio/modeller";
import { ProductHostRoute } from "@/host/ProductHostRoute";

export const modellerSlots: ModellerSlots = {
	Page: ProductHostRoute,
};
