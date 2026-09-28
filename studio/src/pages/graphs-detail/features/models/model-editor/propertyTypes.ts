// The property types a dropdown may offer, resolved from the bound connector.
//
// Named for what it holds, not for the shape of the code — a bag called `utils`
// is the one §4.1c bans.

// Fallback property types — used ONLY when the bound backend reports no
// supported types (no connection attached yet, or an unknown connector). Normally
// the modeller renders the connection's backend+version-resolved
// `supported_property_types` (docs/for-developers/modules/graph-connectors/features/capabilities.md). This is the always-safe universal +
// semantic-overlay subset that every backend can store.
export const FALLBACK_PROPERTY_TYPE_OPTIONS = [
	"string",
	"integer",
	"float",
	"boolean",
	"enum",
	"uuid",
	"json",
	"datetime",
] as const;

/**
 * Resolve the property-type options for a dropdown: the bound backend's
 * supported set when known, else the safe fallback (docs/for-developers/modules/graph-connectors/features/capabilities.md).
 */
export function propertyTypeOptions(
	supported: string[] | undefined,
): readonly string[] {
	return supported && supported.length > 0
		? supported
		: FALLBACK_PROPERTY_TYPE_OPTIONS;
}
