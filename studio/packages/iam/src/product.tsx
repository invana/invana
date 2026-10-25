/**
 * `iam` — the IAM product's `ProductDefinition`: who may do what in a Graph,
 * read in one place (the-iam-product.md, iam.md).
 *
 * It sits on the Agents shell — a rail and a workbook, with no leftSection.
 * Every rail item is a section page that opens as a tab of the workbook; a
 * policy, an agent or a group opens as a tab of its own (`?page=`):
 *
 * | Rail | Path | Opens |
 * |---|---|---|
 * | Home | `/iam/home` | — the workbook with nothing open |
 * | People | `/iam/people` | — |
 * | Groups | `/iam/groups` | a group (`?page=iam_group:<name>`) |
 * | Agents | `/iam/agents` | an agent's access (`?page=iam_agent:<id>`) |
 * | Policies | `/iam/policies` | a policy (`?page=policy:<name>`) |
 * | Tokens | `/iam/tokens` | — |
 * | Settings | `/iam/settings` | — the Graph's settings, at the rail's foot |
 *
 * The page itself is the app's product host, which composes every graph
 * product's regions, so the route's element is whatever the app puts in
 * `IamSlotsContext`.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { Fingerprint } from "lucide-react";
import type { RouteObject } from "react-router-dom";
import { useIamSlots } from "./IamSlots";
import { type IamSectionKey, SECTIONS } from "./sections/spec";

function IamRoute() {
	const { Page } = useIamSlots();
	return <Page />;
}

/** A section's level of the trail. Home has no crumb: it is the product. */
const level = (key: IamSectionKey): RouteObject => ({
	path: key,
	handle:
		key === "home"
			? undefined
			: ({ crumb: SECTIONS[key].label } satisfies ShellRouteHandle),
});

const rail = (id: IamSectionKey) => ({
	id,
	label: SECTIONS[id].label,
	icon: SECTIONS[id].icon,
	to: id,
});

export const iam: ProductDefinition = {
	id: "iam",
	name: "IAM",
	tagline: "Who may do what",
	icon: Fingerprint,
	scope: "graph",
	landing: "home",
	nav: {
		groups: [
			[rail("home")],
			[rail("people"), rail("groups"), rail("agents")],
			[rail("policies"), rail("tokens")],
		],
		bottom: [rail("settings")],
	},
	routes: [
		{
			path: "u/:username/:graphSlug/iam",
			// No crumb: the wordmark already reads `Invana IAM`.
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <IamRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				...(Object.keys(SECTIONS) as IamSectionKey[]).map(level),
			],
		},
	],
};
