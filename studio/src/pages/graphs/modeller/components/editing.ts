// Shared context threaded through the modeller's authoring UI: which model +
// draft version the edit mutations should target. Only meaningful while a draft
// is open; published versions are read-only.
export interface ModelEditCtx {
	username: string;
	graphSlug: string;
	modelId: string;
	versionId: string;
}

// Fallback property types — used ONLY when the bound backend reports no
// supported types (no connection attached yet, or an unknown connector). Normally
// the modeller renders the connection's backend+version-resolved
// `supported_property_types` (RFC-022). This is the always-safe universal +
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
 * supported set when known, else the safe fallback (RFC-022).
 */
export function propertyTypeOptions(
	supported: string[] | undefined,
): readonly string[] {
	return supported && supported.length > 0
		? supported
		: FALLBACK_PROPERTY_TYPE_OPTIONS;
}
