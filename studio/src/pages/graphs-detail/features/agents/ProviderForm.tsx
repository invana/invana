/**
 * A6 · configuring one endpoint — **a name somebody chose, a vendor kind, a
 * base URL and one credential** ([PM9](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)).
 *
 * *As the person who pays for the models, I want to configure an endpoint by a
 * name I will recognise in a refusal, so that a rule names a word rather than a
 * uuid.*
 *
 * **The name is the address segment** (PM10). `llm/anthropic-prod/*` is what a
 * rule is written against and what a ledger line carries, so it is a slug and
 * the field says so — `anthropic-prod` and `anthropic-research` are two
 * participants with two keys, which is the whole reason the row is not a model.
 *
 * **There is no default switch.** `is_default` is gone: the lens `cast` answers
 * *which model when nobody said* (PM4), and a second mechanism picking a model
 * is the duplication Govern exists to remove.
 *
 * On create the form takes the first model with the endpoint, so configuring
 * one is still one round trip; more are offered from the detail.
 */

import { FormError } from "@/components/forms/FormError";
import {
	useCreateLLMProviderMutation,
	useUpdateLLMProviderMutation,
} from "@/hooks/queries/useLLMProviders";
import {
	type LLMCredentialKind,
	type LLMProvider,
	type LLMProviderKind,
	LLM_PROVIDER_OPTIONS,
	PROVIDER_NAME_PATTERN,
	suggestProviderName,
} from "@/types/llm";
import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Button } from "@invana/ui";
import { useState } from "react";
import { toast } from "sonner";

export interface ProviderFormProps {
	username: string;
	graphSlug: string;
	/** Absent is *configure a new endpoint*. */
	existing: LLMProvider | null;
	onDone: (providerId?: string) => void;
	onCancel: () => void;
}

export function ProviderForm({
	username,
	graphSlug,
	existing,
	onDone,
	onCancel,
}: ProviderFormProps) {
	const isEdit = !!existing;
	const create = useCreateLLMProviderMutation(username, graphSlug);
	const update = useUpdateLLMProviderMutation(username, graphSlug);

	const [providerKind, setProviderKind] = useState<LLMProviderKind>(
		existing?.provider ?? "anthropic",
	);
	const [name, setName] = useState(existing?.name ?? "anthropic");
	// True until somebody types in the name field: the suggestion follows the
	// vendor until it is a decision rather than a default.
	const [nameUntouched, setNameUntouched] = useState(!isEdit);
	const [modelId, setModelId] = useState("");
	const [apiKey, setApiKey] = useState("");
	// claude_agent_sdk only (PM2) — which env var the credential becomes.
	const [credentialKind, setCredentialKind] = useState<LLMCredentialKind>(
		existing?.credential_kind ?? "api_key",
	);
	const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");

	const meta = LLM_PROVIDER_OPTIONS.find((o) => o.value === providerKind);
	const requiresKey = meta?.requiresApiKey ?? false;
	const keyOptional = meta?.apiKeyOptional ?? false;
	const showsBaseUrl = meta?.usesBaseUrl ?? false;
	const isClaudeAgentSdk = providerKind === "claude_agent_sdk";
	// Selecting "Subscription token" is a commitment, not a fallback — unlike
	// the API-key path there's no "blank means use the CLI's own login" for it.
	const oauthTokenWanted = isClaudeAgentSdk && credentialKind === "oauth_token";

	const nameOk = PROVIDER_NAME_PATTERN.test(name.trim());
	// On edit the credential is already stored; only require a fresh one when
	// nothing is on file yet, or the kind requires one outright.
	const apiKeyNeeded =
		(requiresKey || oauthTokenWanted) && !(isEdit && existing?.has_api_key);
	const formValid =
		nameOk &&
		(isEdit || !!modelId.trim()) &&
		(!apiKeyNeeded || apiKey.length > 0) &&
		(!showsBaseUrl ||
			providerKind === "openai" ||
			providerKind === "azure" ||
			!!baseUrl.trim());

	const pickKind = (v: LLMProviderKind) => {
		setProviderKind(v);
		if (nameUntouched) setName(suggestProviderName(v));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!formValid) return;

		const shared = {
			name: name.trim(),
			api_key: apiKey.length > 0 ? apiKey : undefined,
			credential_kind: isClaudeAgentSdk ? credentialKind : undefined,
			base_url: showsBaseUrl && baseUrl.trim() ? baseUrl.trim() : undefined,
		};

		if (isEdit && existing) {
			update.mutate(
				{ id: existing.id, data: shared },
				{
					onSuccess: () => {
						toast.success("Endpoint saved");
						onDone(existing.id);
					},
					onError: (err) => toast.error(err.message),
				},
			);
			return;
		}

		create.mutate(
			{
				...shared,
				provider: providerKind,
				// One round trip configures an endpoint that can answer: a provider
				// row offering nothing answers nothing (PM9).
				models: [{ model_id: modelId.trim() }],
			},
			{
				onSuccess: (provider) => {
					toast.success("Endpoint added");
					onDone(provider.id);
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const isSubmitting = create.isPending || update.isPending;

	return (
		<form onSubmit={handleSubmit} className="space-y-4" noValidate>
			<div className="space-y-1.5">
				<Label htmlFor="provider">
					Vendor <span className="text-destructive">*</span>
				</Label>
				{isEdit ? (
					// Immutable once set: the vendor decides how the credential is
					// dispatched, and changing it would silently re-point every rule.
					<Input id="provider" value={meta?.label ?? providerKind} disabled />
				) : (
					<Select
						value={providerKind}
						onValueChange={(v) => pickKind(v as LLMProviderKind)}
					>
						<SelectTrigger id="provider">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LLM_PROVIDER_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="endpoint_name">
					Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="endpoint_name"
					value={name}
					placeholder="anthropic-prod"
					onChange={(e) => {
						setNameUntouched(false);
						setName(e.target.value);
					}}
				/>
				<p className="text-sm text-muted-foreground">
					The address segment —{" "}
					<code className="font-mono">llm/{name || "…"}/…</code>. Lowercase
					words, digits, hyphens and underscores: it is the word a rule names
					and a refusal reads back.
				</p>
				{isEdit ? (
					// Renaming moves `llm/<name>/*` in one write, so it is refused while
					// a world names it and the refusal says which (PM18). Saying so here
					// is cheaper than finding out at save.
					<p className="text-sm text-muted-foreground">
						Renaming moves every address under this endpoint. It is refused
						while a world or a guardrail names one.
					</p>
				) : null}
				{!nameOk && name.trim() ? (
					<p className="text-sm text-destructive">
						Lowercase letters, digits, hyphens and underscores only, starting
						with a letter or a digit.
					</p>
				) : null}
			</div>

			{!isEdit ? (
				<div className="space-y-1.5">
					<Label htmlFor="model_id">
						First model <span className="text-destructive">*</span>
					</Label>
					<Input
						id="model_id"
						placeholder={meta?.exampleModelId}
						value={modelId}
						onChange={(e) => setModelId(e.target.value)}
					/>
					<p className="text-sm text-muted-foreground">
						An endpoint that offers nothing answers nothing. More are added on
						the endpoint itself.
					</p>
				</div>
			) : null}

			{isClaudeAgentSdk ? (
				<div className="space-y-1.5">
					<Label htmlFor="credential_kind">Credential type</Label>
					<Select
						value={credentialKind}
						onValueChange={(v) => {
							setCredentialKind(v as LLMCredentialKind);
							setApiKey("");
						}}
					>
						<SelectTrigger id="credential_kind">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="api_key">API key</SelectItem>
							<SelectItem value="oauth_token">
								Subscription token (claude setup-token)
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			) : null}

			{requiresKey || keyOptional ? (
				<div className="space-y-1.5">
					<Label htmlFor="api_key">
						{oauthTokenWanted ? "Subscription token" : "API key"}{" "}
						{apiKeyNeeded ? (
							<span className="text-destructive">*</span>
						) : keyOptional && !oauthTokenWanted && !existing?.has_api_key ? (
							<span className="text-muted-foreground">
								(optional — uses your Claude Code login if blank)
							</span>
						) : (
							<span className="text-muted-foreground">
								(leave blank to keep the stored{" "}
								{oauthTokenWanted ? "token" : "key"})
							</span>
						)}
					</Label>
					<Input
						id="api_key"
						type="password"
						placeholder="••••••••"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						autoComplete="new-password"
					/>
					{oauthTokenWanted ? (
						<p className="text-sm text-muted-foreground">
							Generate one with{" "}
							<code className="font-mono">claude setup-token</code> (requires a
							Claude Pro/Max/Team/Enterprise plan).
						</p>
					) : null}
				</div>
			) : null}

			{showsBaseUrl ? (
				<div className="space-y-1.5">
					<Label htmlFor="base_url">Base URL</Label>
					<Input
						id="base_url"
						placeholder={
							providerKind === "ollama"
								? "http://localhost:11434"
								: "https://your-endpoint.example.com"
						}
						value={baseUrl}
						onChange={(e) => setBaseUrl(e.target.value)}
					/>
				</div>
			) : null}

			<FormError error={create.error ?? update.error} />

			<div className="flex justify-end gap-2 pt-1">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={!formValid || isSubmitting}>
					{isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add endpoint"}
				</Button>
			</div>
		</form>
	);
}
