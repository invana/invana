import type { ProductDefinition } from "@invana-studio/core";
import { legacyGraph } from "./legacyGraph";

/** Every registered product, in launcher order. */
export const products: ProductDefinition[] = [legacyGraph];
