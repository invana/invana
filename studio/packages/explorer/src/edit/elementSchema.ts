/**
 * The graph's model as the Element panel reads it — each node and relationship
 * type with its property keys and the data type each key takes (4.7 DE7).
 *
 * It is read from the model's **active version**, the one the engine checks a
 * save against, so the editor offers exactly what the save accepts. Nothing
 * about the model lives in Studio: a type, a key or a data type added in the
 * Modeller reaches the editor the next time the version is read.
 *
 * The input is typed structurally — the fields the panel needs from the
 * modeller's `GraphVersionResponse` — so this package does not depend on the
 * modeller's; the host passes the version it already fetched.
 */
import type { ElementTypeSchema } from "@invana/canvas-ui";
import { isProvenanceKey } from "../ProvenanceBlock";

/** One property key as a model version carries it. */
interface VersionPropertyKey {
	name: string;
	/** Its data type — `string`, `int`, `float`, `datetime`… */
	type: string;
}

/** A type's key mapping, own or inherited. */
interface VersionMapping {
	property_key: VersionPropertyKey;
	sort_order?: number;
}

/** The parts of a model version the Element panel reads. */
export interface ModelVersionLike {
	id: string;
	node_types: Array<{
		name: string;
		is_abstract?: boolean;
		property_mappings: VersionMapping[];
		effective_property_mappings?: VersionMapping[];
	}>;
	edge_types: Array<{ name: string; property_mappings: VersionMapping[] }>;
}

/** The model as `ElementViewPanel`'s `schema`. */
export interface ElementSchema {
	nodeTypes: ElementTypeSchema[];
	edgeTypes: ElementTypeSchema[];
}

function keysOf(
	mappings: VersionMapping[],
	hidden: (key: string) => boolean,
): ElementTypeSchema["keys"] {
	return [...mappings]
		.filter((m) => !hidden(m.property_key.name))
		.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
		.map((m) => ({ key: m.property_key.name, kind: m.property_key.type }));
}

/**
 * `version` as the panel's schema: every concrete node type with its effective
 * keys (its own and inherited — its own when the version carries no effective
 * list), every relationship type with its keys, in the model's order. Keys the
 * engine owns (`hidden`, the `_inv_*` provenance by default) are left out:
 * nobody types them. `null` while there is no version — the panel then has no
 * model to follow.
 */
export function elementSchemaOf(
	version: ModelVersionLike | null | undefined,
	hidden: (key: string) => boolean = isProvenanceKey,
): ElementSchema | null {
	if (!version) return null;
	return {
		nodeTypes: version.node_types
			.filter((t) => !t.is_abstract)
			.map((t) => ({
				type: t.name,
				keys: keysOf(
					t.effective_property_mappings?.length
						? t.effective_property_mappings
						: t.property_mappings,
					hidden,
				),
			})),
		edgeTypes: version.edge_types.map((t) => ({
			type: t.name,
			keys: keysOf(t.property_mappings, hidden),
		})),
	};
}
