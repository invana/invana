/**
 * What the assistant borrows from the page that hosts it.
 *
 * A turn links a trace's rule to its board, a session row shows its board's
 * banner, the world picker reads the Graph's worlds, and a trace step lists the
 * rules it was offered. Each of those belongs to another part of Studio, and
 * the assistant may import none of them — so the host hands them in once,
 * through `AssistantSlotsContext.Provider`, and the components deep in a turn
 * read them with `useAssistantSlots()`.
 *
 * The hooks are called like any hook, so the host passes the same functions on
 * every render: a module-level object, not one built inline.
 */

import type { OfferedRule } from "@invana-studio/core";
import { type ComponentType, createContext, useContext } from "react";

/** One world, as the picker reads it. */
interface AssistantWorld {
	id: string;
	kind: string;
	display_name: string;
	usage?: { runs: number } | null;
	rules?: readonly { allow: boolean; match: string }[] | null;
}

export interface AssistantSlots {
	/** A board's banner image, for a session row's preview. */
	useBoardBanner: (
		username: string | undefined,
		graphSlug: string | undefined,
		boardId: string | null | undefined,
	) => { data: string | null | undefined; isLoading: boolean };
	/** Opens a rule's board from a trace, or `null` where nothing can open one. */
	useOpenBoard: () => ((kind: "rule", subjectId: string) => void) | null;
	/** The rules a step was offered, and the ones it says it followed. */
	StepRules: ComponentType<{
		offered: OfferedRule[];
		cited: OfferedRule[];
		onOpenRule?: (ruleId: string) => void;
	}>;
	/** The Graph's lenses; the picker keeps the worlds. */
	useWorlds: (
		username: string | undefined,
		graphSlug: string | undefined,
	) => { data?: { items: readonly AssistantWorld[] } };
	/** Every address the Graph holds, which a world's rules resolve against. */
	useParticipants: (
		username: string | undefined,
		graphSlug: string | undefined,
	) => { data?: { items: readonly { address: string }[] } };
	/** Whether a world's rule pattern names an address. */
	matches: (pattern: string, address: string) => boolean;
	/**
	 * Keeps an answer as a finding on a project's branch, its run cited — or
	 * `null` where no product offers it, and the turn draws no button.
	 */
	useAddToProject: () =>
		| ((answer: { runId: string; statement: string }) => void)
		| null;
}

export const AssistantSlotsContext = createContext<AssistantSlots | null>(null);

/** The host's slots. Throws outside a host, where a turn could not render. */
export function useAssistantSlots(): AssistantSlots {
	const slots = useContext(AssistantSlotsContext);
	if (!slots)
		throw new Error("The assistant renders inside AssistantSlotsContext.");
	return slots;
}
