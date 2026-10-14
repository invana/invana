/**
 * `explorer` — the Explorer's `ProductDefinition`: ask and look, on one Graph.
 *
 * The product has no `leftNav` and no sections: the board fills the screen,
 * the assistant docks right once a conversation starts, and the canvas tools
 * float top-left, compact until *Tools* is on. Its paths:
 *
 * | Path | Draws |
 * |---|---|
 * | `/u/:user/:graph/explorer` | the board and the assistant |
 * | `/u/:user/:graph/explorer/:session` | the same, with that session's thread open — crumb `Sessions › <title>` |
 *
 * The `:session` level has no element of its own, so opening a session never
 * remounts the canvas. It offers other packages two acts on an answer:
 * `explorer.shareAnswer` (the reply's *Share*) and `explorer.scheduleQuestion`
 * (its *Schedule this*), each opening its dialog.
 *
 * The page itself is the app's product host, which
 * composes every graph product's regions, so the route's element is whatever
 * the app puts in `ExplorerSlotsContext`.
 */
import type { ProductDefinition } from "@invana-studio/core";
import {
	activityPath,
	ErrorPage,
	ScheduleDialog,
	type ShellRouteHandle,
} from "@invana-studio/shell";
import { Telescope } from "lucide-react";
import { type ComponentType, createContext, useContext } from "react";
import { toast } from "sonner";
import { searchExplorer } from "./search";
import { ShareAnswerDialog } from "./share/ShareAnswerDialog";
import type { ScheduleQuestionArgs, ShareAnswerArgs } from "./types";

/** What the Explorer still borrows from the app: the page it draws. */
interface ExplorerSlots {
	/** The page the Explorer's routes render. */
	Page: ComponentType;
}

export const ExplorerSlotsContext = createContext<ExplorerSlots | null>(null);

function ExplorerRoute() {
	const slots = useContext(ExplorerSlotsContext);
	if (!slots) throw new Error("ExplorerSlotsContext is not provided");
	return <slots.Page />;
}

export const explorer: ProductDefinition = {
	id: "explorer",
	name: "Explorer",
	tagline: "Ask and look",
	icon: Telescope,
	scope: "graph",
	landing: "",
	nav: null,
	search: searchExplorer,
	commands: [
		{
			id: "new-conversation",
			label: "New conversation",
			keywords: ["ask", "chat", "board"],
			to: "",
		},
	],
	routes: [
		{
			path: "u/:username/:graphSlug/explorer",
			// No crumb: the wordmark already reads `Invana Explorer`.
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <ExplorerRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				{
					// `airways ▾ › Sessions › <the session's title>` — the title is
					// the page's object, so this level names where it lives.
					path: ":session",
					handle: { crumb: () => "Sessions" } satisfies ShellRouteHandle,
				},
			],
		},
	],
	actions: {
		// Share an answer with members — a live link or a frozen snapshot — or
		// export it as a file for anyone else.
		"explorer.shareAnswer": {
			label: "Share",
			run: ({ args, openDialog }) => {
				openDialog((close) => (
					<ShareAnswerDialog args={args as ShareAnswerArgs} onClose={close} />
				));
			},
		},
		// Ask the same question on a schedule — a shared schedule, filled in
		// with the question; Activity › Schedules holds it afterwards.
		"explorer.scheduleQuestion": {
			label: "Schedule this",
			run: ({ args, openDialog, navigate }) => {
				const { username, graphSlug, question } = args as ScheduleQuestionArgs;
				const graph = { username, graphSlug };
				openDialog((close) => (
					<ScheduleDialog
						graph={graph}
						open
						onClose={close}
						prefill={{ name: question, instructions: question }}
						onSaved={(schedule) => {
							close();
							// Confirmed where it was asked, with the way to the
							// schedule it made.
							toast.success("Scheduled", {
								description: schedule.name,
								action: {
									label: "Open in Activity",
									onClick: () =>
										navigate(activityPath(graph, "schedules", schedule.id)),
								},
							});
						}}
					/>
				));
			},
		},
	},
	// Answers need a Graph that can answer — the set-up step the assistant's
	// lock names today.
	gate: (setup) =>
		setup.isGateOpen("answering")
			? null
			: {
					reason: "Asking opens once a model is published",
					detail:
						"This Graph is connected, but nothing is modelled yet. Publish a model in the Modeller and you can ask about it here.",
					to: "modeller",
					action: "Open the Modeller",
				},
};
