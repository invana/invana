/**
 * The shapes this module authors with — its own, not the engine's.
 *
 * Engine response shapes stay in `@/types/models` and `@/types/schemas`. What
 * collects here is what the Model screen invents to talk to itself: which model
 * and draft an edit targets, and what is selected — on the canvas, and in the
 * panel ([code-shape.md](docs/for-developers/building-studio/code-shape.md) §4.1d).
 */

/**
 * Which model + draft version the edit mutations should target. Only meaningful
 * while a draft is open; published versions are read-only.
 */
export interface ModelEditCtx {
	username: string;
	graphSlug: string;
	modelId: string;
	versionId: string;
}

/**
 * What the canvas has selected, and therefore what the detail column draws.
 * `null` is the model's own overview, not an empty screen.
 */
export type SelectedItem =
	| { kind: "node-type"; id: string }
	| { kind: "edge-type"; id: string }
	| { kind: "property-keys" }
	| { kind: "constraints" }
	| { kind: "indexes" }
	| null;

/**
 * What the panel has selected — by name, because the panel lists types the
 * version declares and the canvas draws the same set by id.
 */
export interface ModelSelection {
	kind: "node_type" | "edge_type";
	name: string;
}
