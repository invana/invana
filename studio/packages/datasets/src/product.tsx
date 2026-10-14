/**
 * `datasets` — the Datasets product's `ProductDefinition`: gather the data
 * (datasets.md).
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Catalogue | `/datasets/catalogue` | every readable dataset; `…/:publisher/:name/<tab>` is one dataset |
 * | Validation | `/datasets/validation` | the standard-violation queue; `…/:publisher/:name/:key/:term` is one item |
 * | Standards | `/datasets/standards` | the library; `…/:publisher/:name` is one standard |
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
import { Navigate, type Params, type RouteObject } from "react-router-dom";
import { CataloguePage } from "./catalogue/CataloguePage";
import { ConformanceTab } from "./dataset/ConformanceTab";
import { DatasetPage, TabOutlet } from "./dataset/DatasetPage";
import { OverviewTab } from "./dataset/OverviewTab";
import { ProvenanceTab } from "./dataset/ProvenanceTab";
import { RecordPage, RecordsTab } from "./dataset/RecordsTab";
import { UsedByTab } from "./dataset/UsedByTab";
import { VersionsTab } from "./dataset/VersionsTab";
import { ImportsPage } from "./imports/ImportsPage";
import { StandardPage } from "./standards/StandardPage";
import { StandardsPage } from "./standards/StandardsPage";
import { ValidationItemPage } from "./validation/ValidationItemPage";
import { ValidationPage } from "./validation/ValidationPage";

/** A crumbed route; with children, `element` is its index page. */
function section(
	path: string,
	crumb: ShellRouteHandle["crumb"],
	element: RouteObject["element"],
	children?: RouteObject[],
): RouteObject {
	const handle: ShellRouteHandle = { crumb };
	return children
		? { path, handle, children: [{ index: true, element }, ...children] }
		: { path, handle, element };
}

const byName = (p: Params) => p.name;

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
	commands: [
		{
			id: "bring-data-in",
			label: "Bring data in",
			keywords: ["import", "load", "bulk", "upload"],
			to: "imports",
		},
	],
	routes: [
		{
			path: "datasets",
			errorElement: <ErrorPage />,
			children: [
				{ index: true, element: <Navigate to="catalogue" replace /> },
				section("catalogue", "Catalogue", <CataloguePage />, [
					{
						path: ":publisher/:name",
						handle: { crumb: byName } satisfies ShellRouteHandle,
						element: <DatasetPage />,
						// Tabs are path levels but not crumbs: switching keeps the trail.
						children: [
							{ index: true, element: <OverviewTab /> },
							{ path: "provenance", element: <ProvenanceTab /> },
							{
								path: "records",
								element: <TabOutlet />,
								children: [
									{ index: true, element: <RecordsTab /> },
									section(":key", (p) => p.key, <RecordPage />),
								],
							},
							{ path: "versions", element: <VersionsTab /> },
							{ path: "conformance", element: <ConformanceTab /> },
							{ path: "used", element: <UsedByTab /> },
						],
					},
				]),
				section("validation", "Validation", <ValidationPage />, [
					section(
						":publisher/:name/:key/:term",
						(p) => `${p.key} · ${p.term}`,
						<ValidationItemPage />,
					),
				]),
				section("standards", "Standards", <StandardsPage />, [
					section(":publisher/:name", byName, <StandardPage />),
				]),
				section("imports", "Imports", <ImportsPage />),
			],
		},
	],
};
