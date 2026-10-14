/**
 * What the graph page lends the assistant: a rule's board (boards), a step's rules (skills), the worlds a thread can be set to
 * (lenses), keeping an answer as a finding (projects), sharing it and
 * scheduling its question (explorer), all through the action registry. The assistant package may
 * import none of these modules, so the page hands them in through
 * `AssistantSlotsContext`.
 *
 * One module-level object, so the hooks it carries are the same functions on
 * every render.
 */

import type { AssistantSlots, SharedAnswer } from "@invana-studio/assistant";
import { useLensesQuery } from "@invana-studio/core";
import type {
	ScheduleQuestionArgs,
	ShareAnswerArgs,
} from "@invana-studio/explorer";
import { matches, useParticipantsQuery } from "@invana-studio/modeller";
import { useAction } from "@invana-studio/shell";
import { StepRules } from "@invana-studio/ui";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useOpenBoard } from "@/host/boards";

interface AddFindingArgs {
	username: string;
	graphSlug: string;
	runId: string;
	statement: string;
}

/** `projects.addFinding`, bound to the open Graph — null when nothing offers it. */
function useAddToProject() {
	const { username, graphSlug } = useParams();
	const action = useAction<AddFindingArgs>("projects.addFinding");
	const invoke = action?.invoke;
	const add = useCallback(
		(answer: { runId: string; statement: string }) =>
			invoke?.({
				username: username as string,
				graphSlug: graphSlug as string,
				...answer,
			}),
		[invoke, username, graphSlug],
	);
	return invoke && username && graphSlug ? add : null;
}

/** `explorer.shareAnswer`, bound to the open Graph — null when nothing offers it. */
function useShareAnswer() {
	const { username, graphSlug } = useParams();
	const action = useAction<ShareAnswerArgs>("explorer.shareAnswer");
	const invoke = action?.invoke;
	const share = useCallback(
		(answer: SharedAnswer) =>
			invoke?.({
				username: username as string,
				graphSlug: graphSlug as string,
				...answer,
			}),
		[invoke, username, graphSlug],
	);
	return invoke && username && graphSlug ? share : null;
}

/** `explorer.scheduleQuestion`, bound to the open Graph — null when nothing offers it. */
function useScheduleQuestion() {
	const { username, graphSlug } = useParams();
	const action = useAction<ScheduleQuestionArgs>("explorer.scheduleQuestion");
	const invoke = action?.invoke;
	const schedule = useCallback(
		(question: string) =>
			invoke?.({
				username: username as string,
				graphSlug: graphSlug as string,
				question,
			}),
		[invoke, username, graphSlug],
	);
	return invoke && username && graphSlug ? schedule : null;
}

export const assistantSlots: AssistantSlots = {
	useOpenBoard,
	StepRules,
	useWorlds: useLensesQuery,
	useParticipants: useParticipantsQuery,
	matches,
	useAddToProject,
	useShareAnswer,
	useScheduleQuestion,
};
