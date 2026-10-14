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
 * | `/u/:user/:graph/explorer/:session` | the same, with that session's thread open |
 *
 * The `:session` level has no element of its own, so opening a session never
 * remounts the canvas. `explorer.shareAnswer` is the one act it offers other
 * packages: the assistant's *Share* on a reply opens its dialog.
 *
 * The page itself is the app's product host, which
 * composes every graph product's regions, so the route's element is whatever
 * the app puts in `ExplorerSlotsContext`.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { Telescope } from "lucide-react";
import { type ComponentType, createContext, useContext } from "react";
import { searchExplorer } from "./search";
import { ShareAnswerDialog } from "./share/ShareAnswerDialog";
import type { ShareAnswerArgs } from "./types";

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

/** A session's crumb: its id, shortened; the full id stays on hover. */
const sessionCrumb = (id: string) => `session:${id.slice(0, 8)}`;

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
					path: ":session",
					handle: {
						crumb: (p) => (p.session ? sessionCrumb(p.session) : undefined),
						crumbTitle: (p) => p.session,
					} satisfies ShellRouteHandle,
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
	},
	// Answers need a Graph that can answer — the set-up step the assistant's
	// lock names today.
	gate: (setup) =>
		setup.isGateOpen("answering")
			? null
			: {
					reason: "Explorer opens once the Graph can answer questions",
					to: "modeller/settings?tab=info",
				},
};
