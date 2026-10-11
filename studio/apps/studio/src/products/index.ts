import type { ProductDefinition } from "@invana-studio/core";
import { explorer } from "@invana-studio/explorer";
import { modeller } from "@invana-studio/modeller";
import { legacyGraph } from "./legacyGraph";

/** Every registered product, in launcher order. */
export const products: ProductDefinition[] = [explorer, modeller, legacyGraph];
