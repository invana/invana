/**
 * Fleet's one page — *Workers* — and its tabs, read by the rail
 * (`product.tsx`), the page's frame and the record pages' crumbs, so the
 * name and icon cannot differ between them.
 *
 * A tab's key is the path's last segment under `/fleet`; Pools is the first.
 */
import { ServerCog } from "lucide-react";

export const FLEET_TABS = [
	{ key: "pools", label: "Pools" },
	{ key: "workers", label: "Workers" },
	{ key: "capacity", label: "Capacity" },
	{ key: "tokens", label: "Join tokens" },
] as const;

export type FleetTab = (typeof FLEET_TABS)[number]["key"];

export const WORKERS = {
	label: "Workers",
	icon: ServerCog,
	description:
		"Pools of workers run every agent’s steps — on Docker, Python or Kubernetes; you add them, and you scale them",
	tabs: FLEET_TABS.map((t) => ({ ...t })),
};
