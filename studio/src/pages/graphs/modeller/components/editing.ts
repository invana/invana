// Shared context threaded through the modeller's authoring UI: which model +
// draft version the edit mutations should target. Only meaningful while a draft
// is open; published versions are read-only.
export interface ModelEditCtx {
	username: string;
	graphSlug: string;
	modelId: string;
	versionId: string;
}

export const PROPERTY_TYPE_OPTIONS = [
	"string",
	"integer",
	"float",
	"boolean",
	"date",
	"datetime",
] as const;
