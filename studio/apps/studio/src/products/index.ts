import { agents } from "@invana-studio/agents";
import type { ProductDefinition } from "@invana-studio/core";
import { explorer } from "@invana-studio/explorer";
import { modeller } from "@invana-studio/modeller";
import { projects } from "@invana-studio/projects";

/** Every registered product, in launcher order. */
export const products: ProductDefinition[] = [
	explorer,
	modeller,
	projects,
	agents,
];
