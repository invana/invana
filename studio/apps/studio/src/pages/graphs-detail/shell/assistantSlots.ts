/**
 * What the graph page lends the assistant: a board's banner and a rule's board
 * (boards), a step's rules (skills), and the worlds a thread can be set to
 * (lenses). The assistant package may import none of these modules, so the
 * page hands them in through `AssistantSlotsContext`.
 *
 * One module-level object, so the hooks it carries are the same functions on
 * every render.
 */

import type { AssistantSlots } from "@invana-studio/assistant";
import {
	useCanvasBannerQuery,
	useOpenBoard,
} from "@/pages/graphs-detail/features/boards";
import {
	matches,
	useLensesQuery,
	useParticipantsQuery,
} from "@/pages/graphs-detail/features/lenses";
import { StepRules } from "@/pages/graphs-detail/features/skills";

export const assistantSlots: AssistantSlots = {
	useBoardBanner: useCanvasBannerQuery,
	useOpenBoard,
	StepRules,
	useWorlds: useLensesQuery,
	useParticipants: useParticipantsQuery,
	matches,
};
