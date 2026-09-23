// ─────────────────────────────────────────────────────────────────────────────
// LLM provider types — mirrors engine/src/invana/apps/llm_providers/schemas.py
//
// **A provider row is a configured endpoint, not a model** (PM9): a name
// somebody chose, a vendor kind, a base URL and one credential; `models` holds
// what it offers. The `name` is the address segment (PM10), so it is the word a
// rule names and a refusal reads back — never a uuid.
//
// There is no `is_default` anywhere here. The lens `cast` answers *which model
// when nobody said* (PM4), and two mechanisms picking a model is the
// duplication Govern exists to remove.
// ─────────────────────────────────────────────────────────────────────────────

export type LLMProviderKind =
	| "anthropic"
	| "openai"
	| "google"
	| "azure"
	| "ollama"
	| "local"
	| "claude_agent_sdk";

// claude_agent_sdk only (docs/for-developers/modules/agents/features/providers-and-models.md) — disambiguates what the credential field
// holds: a Claude API key, or a `claude setup-token` subscription token.
export type LLMCredentialKind = "api_key" | "oauth_token";

export const LLM_PROVIDER_OPTIONS: ReadonlyArray<{
	value: LLMProviderKind;
	label: string;
	requiresApiKey: boolean;
	// Key accepted but not required — the engine falls back to the local Claude
	// Code CLI login when blank (claude_agent_sdk, docs/for-developers/modules/agents/features/providers-and-models.md).
	apiKeyOptional?: boolean;
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
	{
		value: "claude_agent_sdk",
		label: "Claude Agent SDK",
		requiresApiKey: false,
		apiKeyOptional: true,
		usesBaseUrl: false,
		exampleModelId: "claude-opus-5",
	},
];

/** Whether this endpoint still offers the model (PM11). */
export type LLMModelStatus = "active" | "removed";

/**
 * What the **shipped cast** reads, and nothing a vendor merely states (PM12).
 * A model added without ranks is never auto-cast, so the drawer asks for them.
 */
export interface LLMModelCapabilities {
	context_window?: number | null;
	supports_tools?: boolean;
	embedding?: boolean;
	cost_rank?: number;
	power_rank?: number;
	local?: boolean;
}

export interface LLMModelPricing {
	input_per_mtok?: number;
	output_per_mtok?: number;
}

/** One model this endpoint offers. `address` is `llm/<provider name>/<model id>`. */
export interface LLMModel {
	id: string;
	provider_id: string;
	model_id: string;
	display_name: string | null;
	capabilities: LLMModelCapabilities;
	pricing: LLMModelPricing;
	status: LLMModelStatus;
	/** What a rule names and a touch records — the row's own address. */
	address: string;
	created_at: string;
	updated_at: string;
}

export interface LLMModelCreate {
	model_id: string;
	display_name?: string;
	capabilities?: LLMModelCapabilities;
	pricing?: LLMModelPricing;
}

export interface LLMProvider {
	id: string;
	graph_id: string;
	/** The address segment, chosen by a person (PM10). */
	name: string;
	provider: LLMProviderKind;
	has_api_key: boolean;
	credential_kind: LLMCredentialKind | null;
	base_url: string | null;
	guardrails: Record<string, unknown>;
	/** A provider row alone answers nothing — these are what it offers (PM9). */
	models: LLMModel[];
	created_at: string;
	updated_at: string;
}

export interface LLMProviderCreate {
	name: string;
	provider: LLMProviderKind;
	api_key?: string;
	credential_kind?: LLMCredentialKind;
	base_url?: string;
	guardrails?: Record<string, unknown>;
	/** Sent with the endpoint, so configuring one is still one round trip. */
	models?: LLMModelCreate[];
}

export interface LLMProviderUpdate {
	name?: string;
	// Send only if rotating the key; omitting leaves the stored value.
	api_key?: string;
	credential_kind?: LLMCredentialKind;
	base_url?: string;
	guardrails?: Record<string, unknown>;
}

export interface LLMProviderListResponse {
	items: LLMProvider[];
	total: number;
}

export interface LLMModelListResponse {
	items: LLMModel[];
	total: number;
}

export interface LLMPingResponse {
	ok: boolean;
	latency_ms?: number;
	error?: string;
}

/**
 * The address segment is a slug — lowercase words, digits and hyphens — because
 * a rule is written against it and a refusal reads it back (PM10).
 */
export const PROVIDER_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** `anthropic` → `anthropic`, `Claude Agent SDK` → `claude-agent-sdk`. */
export function suggestProviderName(from: string): string {
	return from
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
