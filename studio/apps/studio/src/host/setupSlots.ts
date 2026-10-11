/**
 * What the graph page lends setup: the Graph's skip-and-take-back write
 * (graphs), and the left column's section setter, which a step uses to open
 * the panel that owns its field. The shell may import neither, so the page
 * hands them in through `SetupSlotsContext`.
 *
 * One module-level object, so the hooks it carries are the same functions on
 * every render.
 */

import { useSetupSectionMutation } from "@invana-studio/core";
import type { SetupSlots } from "@invana-studio/shell";
import { useLeftSection } from "@invana-studio/shell";

/** The left column's `setSection`, and nothing else of it. */
function useOpenSection() {
	return useLeftSection().setSection;
}

export const setupSlots: SetupSlots = {
	useSetupSectionMutation,
	useOpenSection,
};
