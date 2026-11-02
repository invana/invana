import { activity } from "@invana-studio/activity";
import { agents } from "@invana-studio/agents";
import type { ProductDefinition } from "@invana-studio/core";
import { datasets } from "@invana-studio/datasets";
import { explorer } from "@invana-studio/explorer";
import { iam } from "@invana-studio/iam";
import { modeller } from "@invana-studio/modeller";
import { fleet, settings } from "@invana-studio/platform";
import { projects } from "@invana-studio/projects";

/**
 * Every registered product, in launcher order: the platform's (*Invana*),
 * then a Graph's (*This Graph*). The launcher groups them by place.
 */
export const products: ProductDefinition[] = [
	datasets,
	agents,
	fleet,
	settings,
	modeller,
	explorer,
	projects,
	activity,
	iam,
];
