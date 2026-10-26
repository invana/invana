/**
 * `modeller` — the Modeller's `ProductDefinition`: give a Graph meaning
 * (modeller.md).
 *
 * The rail is three groups — what the Graph is modelled as, what bounds it,
 * and its settings at the bottom:
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Global model | `/modeller/global-model` | the Models panel, and the models board on its Model tab: every published model on one canvas, stitches dashed |
 * | Models | `/modeller/models` | the same panel, and the models board on Overview |
 * | Stitches | `/modeller/stitches` | the same panel, and the global canvas, where a stitch is declared and read |
 * | Requests | `/modeller/requests` | what analysts and agents asked for — empty until the engine records requests |
 * | Worlds | `/modeller/worlds[/:world]` | the Govern stack on Worlds |
 * | Guardrails | `/modeller/guardrails[/:guardrail]` | the Govern stack on Guardrails |
 * | Rules | `/modeller/rules` | the Graph's invariants |
 * | Graph settings | `/modeller/settings` | Basic · Graph · Agents (`?tab=`; `?tab=info` is the Graph's info) |
 *
 * The levels under the product's route have no element of their own, so
 * moving along the rail never remounts the page. The page itself is the app's
 * product host, which composes every graph product's regions, so the route's
 * element is whatever the app puts in `ModellerSlotsContext`.
 */
import type { Lens, ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import {
	Boxes,
	Globe,
	Link2,
	MessageSquarePlus,
	Orbit,
	ScrollText,
	Settings,
	Shapes,
	Shield,
} from "lucide-react";
import type { Params, RouteObject } from "react-router-dom";
import { lensDetailKey } from "./govern/queries";
import { useModellerSlots } from "./ModellerSlots";
import { searchModeller } from "./search";

function ModellerRoute() {
	const { Page } = useModellerSlots();
	return <Page />;
}

/** A level of the trail: a fixed label, or the drill-in's id. */
function level(
	path: string,
	crumb: string | ((params: Params) => string | undefined),
	children?: RouteObject[],
): RouteObject {
	const handle: ShellRouteHandle = { crumb };
	return children
		? { path, handle, children: [{ index: true }, ...children] }
		: { path, handle };
}

/**
 * A section whose records drill in one level down: `worlds` › `<world>`. The
 * record's crumb is its name once its page has read it; its id until then.
 */
const drillable = (path: string, label: string, param: string) =>
	level(path, label, [
		{
			path: `:${param}`,
			handle: {
				crumb: (p) => p[param],
				crumbFrom: (p) =>
					p.username && p.graphSlug && p[param]
						? {
								queryKey: lensDetailKey(p.username, p.graphSlug, p[param]),
								label: (data) => (data as Lens).display_name ?? undefined,
							}
						: undefined,
			} satisfies ShellRouteHandle,
		},
	]);

export const modeller: ProductDefinition = {
	id: "modeller",
	name: "Modeller",
	tagline: "Give it meaning",
	icon: Shapes,
	scope: "graph",
	landing: "global-model",
	nav: {
		groups: [
			[
				{
					id: "global-model",
					label: "Global model",
					icon: Orbit,
					to: "global-model",
				},
				{ id: "models", label: "Models", icon: Boxes, to: "models" },
				{ id: "stitches", label: "Stitches", icon: Link2, to: "stitches" },
				{
					id: "requests",
					label: "Requests",
					icon: MessageSquarePlus,
					to: "requests",
				},
			],
			[
				{ id: "worlds", label: "Worlds", icon: Globe, to: "worlds" },
				{
					id: "guardrails",
					label: "Guardrails",
					icon: Shield,
					to: "guardrails",
				},
				{ id: "rules", label: "Rules", icon: ScrollText, to: "rules" },
			],
		],
		bottom: [
			{
				id: "settings",
				label: "Graph settings",
				icon: Settings,
				to: "settings",
			},
		],
	},
	search: searchModeller,
	commands: [
		{
			id: "graph-info",
			label: "Graph info",
			keywords: ["connection", "database", "about"],
			to: "settings?tab=info",
		},
	],
	routes: [
		{
			path: "u/:username/:graphSlug/modeller",
			// No crumb: the wordmark already reads `Invana Modeller`.
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <ModellerRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				level("global-model", "Global model"),
				level("models", "Models"),
				level("stitches", "Stitches"),
				level("requests", "Requests"),
				drillable("worlds", "Worlds", "world"),
				drillable("guardrails", "Guardrails", "guardrail"),
				level("rules", "Rules"),
				level("settings", "Graph settings"),
			],
		},
	],
};
