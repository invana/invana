/**
 * `datasets` — the Datasets product's `ProductDefinition`: gather the data
 * (datasets.md).
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Catalogue | `/datasets/catalogue` | an empty state until the engine records datasets |
 * | Validation | `/datasets/validation` | the same |
 * | Standards | `/datasets/standards` | the same, and until it records standards |
 * | Imports | `/datasets/imports` | the journal of every Graph's loads |
 *
 * Install-wide: the product sits above Graphs, so its routes start at
 * `/datasets` and the header shows no Graph. It does not own its regions — the
 * shell draws the `leftNav` from `nav` and the page fills `mainSection`. The
 * product root lands on Catalogue.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { Database, History, Library, ShieldCheck, Table2 } from "lucide-react";
import { Navigate, type RouteObject } from "react-router-dom";
import { ImportsPage } from "./imports/ImportsPage";
import { NotYetPage } from "./NotYetPage";

function section(
	path: string,
	crumb: string,
	element: RouteObject["element"],
): RouteObject {
	const handle: ShellRouteHandle = { crumb };
	return { path, handle, element };
}

export const datasets: ProductDefinition = {
	id: "datasets",
	name: "Datasets",
	tagline: "Gather the data",
	icon: Database,
	scope: "install",
	landing: "catalogue",
	nav: {
		groups: [
			[
				{
					id: "catalogue",
					label: "Catalogue",
					icon: Table2,
					to: "catalogue",
				},
				{
					id: "validation",
					label: "Validation",
					icon: ShieldCheck,
					to: "validation",
				},
				{
					id: "standards",
					label: "Standards",
					icon: Library,
					to: "standards",
				},
			],
			[{ id: "imports", label: "Imports", icon: History, to: "imports" }],
		],
		bottom: [],
	},
	routes: [
		{
			path: "datasets",
			errorElement: <ErrorPage />,
			children: [
				{ index: true, element: <Navigate to="catalogue" replace /> },
				section("catalogue", "Catalogue", <NotYetPage section="catalogue" />),
				section(
					"validation",
					"Validation",
					<NotYetPage section="validation" />,
				),
				section("standards", "Standards", <NotYetPage section="standards" />),
				section("imports", "Imports", <ImportsPage />),
			],
		},
	],
};
