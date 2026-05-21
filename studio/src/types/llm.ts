// ─────────────────────────────────────────────────────────────────────────────
// LLM provider types — mirrors engine/src/invana/llm_providers/schemas.py
//
// Per-Graph LLM bindings (MVP § 2.6). Configured under
// /u/:username/:graphSlug/settings (Settings panel → LLMs section) or
// directly via the full-page /settings/llms route.
// ─────────────────────────────────────────────────────────────────────────────

export type LLMProviderKind =
	| "anthropic"
	| "openai"
	| "google"
	| "azure"
	| "ollama"
	| "local";

export const LLM_PROVIDER_OPTIONS: ReadonlyArray<{
	value: LLMProviderKind;
	label: string;
	requiresApiKey: boolean;
	usesBaseUrl: boolean;
	exampleModelId: string;
}> = [
	{
		value: "anthropic",
		label: "Anthropic",
		requiresApiKey: true,
		usesBaseUrl: false,
		exampleModelId: "claude-opus-4-7",
	},
	{
		value: "openai",
		label: "OpenAI",
		requiresApiKey: true,
		usesBaseUrl: true,
		exampleModelId: "gpt-4.1",
	},
	{
		value: "google",
		label: "Google",
		requiresApiKey: true,
		usesBaseUrl: false,
		exampleModelId: "gemini-2.0-pro",
	},
	{
		value: "azure",
		label: "Azure OpenAI",
		requiresApiKey: true,
		usesBaseUrl: true,
		exampleModelId: "gpt-4o",
	},
	{
		value: "ollama",
		label: "Ollama",
		requiresApiKey: false,
		usesBaseUrl: true,
		exampleModelId: "llama3.2",
	},
	{
		value: "local",
		label: "Local",
		requiresApiKey: false,
		usesBaseUrl: true,
		exampleModelId: "custom",
	},
];

export interface LLMProvider {
	id: string;
	graph_id: string;
	provider: LLMProviderKind;
	model_id: string;
	has_api_key: boolean;
	base_url: string | null;
	guardrails: Record<string, unknown>;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface LLMProviderCreate {
	provider: LLMProviderKind;
	model_id: string;
	api_key?: string;
	base_url?: string;
	guardrails?: Record<string, unknown>;
	is_default?: boolean;
}

export interface LLMProviderUpdate {
	model_id?: string;
	// Send only if rotating the key; omitting leaves the stored value.
	api_key?: string;
	base_url?: string;
	guardrails?: Record<string, unknown>;
	is_default?: boolean;
}

export interface LLMProviderListResponse {
	items: LLMProvider[];
	total: number;
}

export interface LLMPingResponse {
	ok: boolean;
	latency_ms?: number;
	error?: string;
}
