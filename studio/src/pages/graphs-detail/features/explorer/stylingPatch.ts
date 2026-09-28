/**
 * A board's stored styling, read and written through canvas-ui's
 * `StylingViewPanel`.
 *
 * The board record keeps `labelProperty` as a bare property key (`name`); the
 * kit panel speaks `labelKey`, a root-relative dot path (`data.name`). These two
 * functions are the whole translation, applied at the panel boundary so the
 * stored format never changes.
 *
 * The kit also offers the two root fields, `id` and `type`, as label choices.
 * They have no stored form, so choosing one reads back as the default label.
 * Everything else — colour, size, edge width, and any field the kit does not
 * know about — passes through untouched.
 */

import type { NodeTypeStyling, TypeStylingPatch } from "@invana/canvas-ui";
import type {
	CanvasStyling,
	NodeTypeStyle,
} from "@/pages/graphs-detail/features/boards";

const DATA_PREFIX = "data.";

/** The kit panel's `value` for a stored styling. */
export function toTypeStylingPatch(styling: CanvasStyling): TypeStylingPatch {
	const nodeTypes: Record<string, NodeTypeStyling> = {};
	for (const [type, style] of Object.entries(styling.nodeTypes ?? {})) {
		const { labelProperty, ...rest } = style;
		nodeTypes[type] = labelProperty
			? { ...rest, labelKey: `${DATA_PREFIX}${labelProperty}` }
			: rest;
	}
	return { ...styling, nodeTypes };
}

/** The stored styling for a patch the kit panel emitted. */
export function fromTypeStylingPatch(patch: TypeStylingPatch): CanvasStyling {
	const nodeTypes: Record<string, NodeTypeStyle> = {};
	for (const [type, style] of Object.entries(patch.nodeTypes ?? {})) {
		const { labelKey, ...rest } = style;
		nodeTypes[type] = labelKey?.startsWith(DATA_PREFIX)
			? { ...rest, labelProperty: labelKey.slice(DATA_PREFIX.length) }
			: rest;
	}
	return { ...patch, nodeTypes };
}
