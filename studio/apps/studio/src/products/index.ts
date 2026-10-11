import type { ProductDefinition } from "@invana-studio/core";
import { explorer } from "@invana-studio/explorer";
import { legacyGraph } from "./legacyGraph";

/** Every registered product, in launcher order. */
export const products: ProductDefinition[] = [explorer, legacyGraph];
