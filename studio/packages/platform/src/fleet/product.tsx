/**
 * `fleet` — the Fleet product's `ProductDefinition`: the machines every
 * Graph's agents run on (platform.md, workers.md).
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Pools | `/fleet/pools` | every pool, the workers chart and the worker events |
 * | Workers | `/fleet/workers` | every worker and the step it runs |
 * | Capacity | `/fleet/capacity` | where steps wait for want of workers |
 * | Join tokens | `/fleet/tokens` | the service-account tokens workers join with |
 *
 * A platform product: its routes start at `/fleet` and the header shows no
 * Graph. The shell draws the rail as `leftNav`; the page fills `mainSection`
 * with the Workers page and the pools and workers opened beside it. The
 * product root lands on Pools.
 */
import type { NavItem, ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { Boxes, Cpu, Gauge, KeyRound, Server } from "lucide-react";
import { Navigate } from "react-router-dom";
import { FleetPage } from "./FleetPage";
import { FLEET_TABS } from "./section";

const ICONS = {
	pools: Boxes,
	workers: Server,
	capacity: Gauge,
	tokens: KeyRound,
};

const rail: NavItem[] = FLEET_TABS.map((t) => ({
	id: t.key,
	label: t.label,
	icon: ICONS[t.key],
	to: t.key,
}));

export const fleet: ProductDefinition = {
	id: "fleet",
	name: "Fleet",
	tagline: "Worker pools shared by every Graph",
	icon: Cpu,
	scope: "platform",
	landing: "pools",
	nav: { groups: [rail], bottom: [] },
	commands: [
		{
			id: "add-workers",
			label: "Add workers",
			keywords: ["pool", "docker", "kubernetes", "python"],
			to: "pools?add=where",
		},
	],
	routes: [
		{
			path: "fleet",
			errorElement: <ErrorPage />,
			children: [
				{ index: true, element: <Navigate to="pools" replace /> },
				// One route for the four tabs, so a rail move keeps the open tabs.
				{
					path: ":tab",
					handle: {
						crumb: (p) => FLEET_TABS.find((t) => t.key === p.tab)?.label,
					} satisfies ShellRouteHandle,
					element: <FleetPage />,
				},
			],
		},
	],
};
