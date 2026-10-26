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
 * | Requests | `/modeller/requests` | the inbox of what analysts and agents asked for; the rail badge is its open count |
 * | Worlds | `/modeller/worlds[/:world]` | the Govern panel and the lens canvas with the world inspector |
 * | Guardrails | `/modeller/guardrails[/:guardrail]` | the Govern panel and the lens canvas with the guardrail inspector |
 * | Rules | `/modeller/rules[/:rule]` | every rule in force — install, Graph and project — and the rule dialog |
 * | Graph settings | `/modeller/settings` | Basic · Graph · Agents (`?tab=`; `?tab=info` is the Graph's info) |
 *
 * The levels under the product's route have no element of their own, so
 * moving along the rail never remounts the page. The page itself is the app's
 * product host, which composes every graph product's regions, so the route's
 * element is whatever the app puts in `ModellerSlotsContext`.
 */
import type { Lens, ProductDefinition, Rule } from "@invana-studio/core";
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
import { type Params, type RouteObject, useParams } from "react-router-dom";
import { guardrailDetailKey, lensDetailKey } from "./govern/queries";
import type { GuardrailDetail } from "./govern/types";
import { useModellerSlots } from "./ModellerSlots";
import { useOpenRequestsCount } from "./requests/queries";
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
const drillable = (
	path: string,
	label: string,
	param: string,
	from: (
		u: string,
		g: string,
		id: string,
	) => {
		queryKey: readonly unknown[];
		label: (data: unknown) => string | undefined;
	},
) =>
	level(path, label, [
		{
			path: `:${param}`,
			handle: {
				crumb: (p) => p[param],
				crumbFrom: (p) =>
					p.username && p.graphSlug && p[param]
						? from(p.username, p.graphSlug, p[param])
						: undefined,
			} satisfies ShellRouteHandle,
		},
	]);

const worldCrumb = (u: string, g: string, id: string) => ({
	queryKey: lensDetailKey(u, g, id),
	label: (data: unknown) => (data as Lens).display_name ?? undefined,
});

const guardrailCrumb = (u: string, g: string, id: string) => ({
	queryKey: guardrailDetailKey(u, g, id),
	label: (data: unknown) => (data as GuardrailDetail).name ?? undefined,
});

/** A rule's crumb is its statement, from the read the dialog made. */
const ruleCrumb = (u: string, g: string, id: string) => ({
	queryKey: ["rules", u, g, id] as const,
	label: (data: unknown) => (data as Rule).statement ?? undefined,
});

/** The Requests rail item carries the engine's open count. */
function useModellerNavBadges(): Partial<Record<string, number>> {
	const { username, graphSlug } = useParams();
	return { requests: useOpenRequestsCount(username, graphSlug) || undefined };
}

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
	useNavBadges: useModellerNavBadges,
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
				drillable("worlds", "Worlds", "world", worldCrumb),
				drillable("guardrails", "Guardrails", "guardrail", guardrailCrumb),
				drillable("rules", "Rules", "rule", ruleCrumb),
				level("settings", "Graph settings"),
			],
		},
	],
};
