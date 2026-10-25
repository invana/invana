import { agents } from "@invana-studio/agents";
import type { ProductDefinition } from "@invana-studio/core";
import { datasets } from "@invana-studio/datasets";
import { explorer } from "@invana-studio/explorer";
import { iam } from "@invana-studio/iam";
import { modeller } from "@invana-studio/modeller";
import { projects } from "@invana-studio/projects";

/** Every registered product, in launcher order. */
export const products: ProductDefinition[] = [
	datasets,
	explorer,
	modeller,
	projects,
	agents,
	iam,
];
