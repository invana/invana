import {
	Badge,
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Switch,
} from "@invana/ui";
import { useMutation } from "@tanstack/react-query";
import {
	CheckCircle2,
	Loader2,
	Plus,
	Sparkles,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useCreateLLMProviderMutation,
	useDeleteLLMProviderMutation,
	useLLMProvidersQuery,
	useSetDefaultLLMProviderMutation,
	useUpdateLLMProviderMutation,
} from "../../../hooks/queries/useLLMProviders";
import { llmProvidersApi } from "../../../services/api/llm";
import {
	type LLMProvider,
	type LLMProviderCreate,
	type LLMProviderKind,
	LLM_PROVIDER_OPTIONS,
} from "../../../types/llm";

interface Props {
	username: string;
	graphSlug: string;
}

export function LLMsSection({ username, graphSlug }: Props) {
	const { data, isLoading } = useLLMProvidersQuery(username, graphSlug);
	const [editing, setEditing] = useState<"new" | LLMProvider | null>(null);

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		);
	}

	if (editing) {
		return (
			<LLMProviderForm
				username={username}
				graphSlug={graphSlug}
				existing={editing === "new" ? null : editing}
				onDone={() => setEditing(null)}
			/>
		);
	}

	const items = data?.items ?? [];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground">
					Configure LLM providers used by this Graph's agents.
				</p>
				<Button onClick={() => setEditing("new")}>
					<Plus className="w-4 h-4 mr-1" />
					Add provider
				</Button>
			</div>

			{items.length === 0 ? (
				<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-3 text-center">
					<Sparkles className="w-8 h-8 text-muted-foreground opacity-50" />
					<p className="text-muted-foreground">
						No providers configured yet. Add one to enable agent runs.
					</p>
				</div>
			) : (
				<div className="border border-border rounded-lg divide-y divide-border">
					{items.map((p) => (
						<ProviderRow
							key={p.id}
							username={username}
							graphSlug={graphSlug}
							provider={p}
							onEdit={() => setEditing(p)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ProviderRow({
	username,
	graphSlug,
	provider,
	onEdit,
}: {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
	onEdit: () => void;
}) {
	const setDefault = useSetDefaultLLMProviderMutation(username, graphSlug);
	const remove = useDeleteLLMProviderMutation(username, graphSlug);
	const meta = LLM_PROVIDER_OPTIONS.find((o) => o.value === provider.provider);

	return (
		<div className="flex items-center gap-4 px-4 py-3">
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium">
						{meta?.label ?? provider.provider}
					</span>
					{provider.is_default && (
						<Badge variant="secondary" className="text-xs">
							default
						</Badge>
					)}
				</div>
				<p className="text-muted-foreground font-mono mt-0.5">
					{provider.model_id}
					{provider.base_url ? ` · ${provider.base_url}` : ""}
				</p>
			</div>
			<div className="flex items-center gap-1 shrink-0">
				{!provider.is_default && (
					<Button
						variant="ghost"
						size="sm"
						disabled={setDefault.isPending}
						onClick={() =>
							setDefault.mutate(provider.id, {
								onError: (err) => toast.error(err.message),
								onSuccess: () => toast.success("Default updated"),
							})
						}
					>
						Set default
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={onEdit}>
					Edit
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					disabled={remove.isPending}
					onClick={() => {
						if (
							!confirm(
								`Delete this ${meta?.label ?? provider.provider} provider?`,
							)
						)
							return;
						remove.mutate(provider.id, {
							onError: (err) => toast.error(err.message),
							onSuccess: () => toast.success("Provider deleted"),
						});
					}}
				>
					<Trash2 className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
}

type TestState =
	| { kind: "untested" }
	| { kind: "testing" }
	| { kind: "passed"; latencyMs?: number }
	| { kind: "failed"; error: string };

function LLMProviderForm({
	username,
	graphSlug,
	existing,
	onDone,
}: {
	username: string;
	graphSlug: string;
	existing: LLMProvider | null;
	onDone: () => void;
}) {
	const isEdit = !!existing;
	const create = useCreateLLMProviderMutation(username, graphSlug);
	const update = useUpdateLLMProviderMutation(username, graphSlug);

	const [providerKind, setProviderKind] = useState<LLMProviderKind>(
		existing?.provider ?? "anthropic",
	);
	const [modelId, setModelId] = useState(existing?.model_id ?? "");
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
	const [isDefault, setIsDefault] = useState(existing?.is_default ?? false);
	const [testState, setTestState] = useState<TestState>({ kind: "untested" });

	const meta = LLM_PROVIDER_OPTIONS.find((o) => o.value === providerKind);
	const requiresKey = meta?.requiresApiKey ?? false;
	const showsBaseUrl = meta?.usesBaseUrl ?? false;

	// On edit, the existing api key is already stored; only require fresh entry
	// when no key is on file or the user explicitly types a new one.
	const apiKeyNeeded = requiresKey && !(isEdit && existing?.has_api_key);
	const formValid =
		!!modelId.trim() &&
		(!apiKeyNeeded || apiKey.length > 0) &&
		(!showsBaseUrl ||
			providerKind === "openai" ||
			!!baseUrl.trim() ||
			providerKind === "azure");

	const buildPayload = (): LLMProviderCreate => ({
		provider: providerKind,
		model_id: modelId.trim(),
		api_key: apiKey.length > 0 ? apiKey : undefined,
		base_url: showsBaseUrl && baseUrl.trim() ? baseUrl.trim() : undefined,
		is_default: isDefault,
	});

	const testMutation = useMutation({
		mutationFn: async () => {
			// Test by creating-or-updating then pinging. To avoid persisting bad
			// creds, only allow Test when *editing* (we already have the row);
			// for new providers, Save will surface ping errors. Simpler than a
			// transient ping endpoint.
			if (!isEdit || !existing) {
				throw new Error("Save first, then Test on the row.");
			}
			const payload = buildPayload();
			await llmProvidersApi.update(username, graphSlug, existing.id, {
				model_id: payload.model_id,
				api_key: payload.api_key,
				base_url: payload.base_url,
			});
			return llmProvidersApi.ping(username, graphSlug, existing.id);
		},
		onMutate: () => setTestState({ kind: "testing" }),
		onSuccess: (result) => {
			if (result.ok) {
				setTestState({ kind: "passed", latencyMs: result.latency_ms });
			} else {
				setTestState({
					kind: "failed",
					error: result.error ?? "Provider rejected the credentials.",
				});
			}
		},
		onError: (err) =>
			setTestState({
				kind: "failed",
				error: err instanceof Error ? err.message : "Ping failed.",
			}),
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!formValid) return;

		if (isEdit && existing) {
			update.mutate(
				{
					id: existing.id,
					data: {
						model_id: modelId.trim(),
						api_key: apiKey.length > 0 ? apiKey : undefined,
						base_url:
							showsBaseUrl && baseUrl.trim() ? baseUrl.trim() : undefined,
						is_default: isDefault,
					},
				},
				{
					onSuccess: () => {
						toast.success("Provider saved");
						onDone();
					},
					onError: (err) => toast.error(err.message),
				},
			);
		} else {
			create.mutate(buildPayload(), {
				onSuccess: () => {
					toast.success("Provider added");
					onDone();
				},
				onError: (err) => toast.error(err.message),
			});
		}
	};

	const isSubmitting = create.isPending || update.isPending;

	return (
		<form onSubmit={handleSubmit} className="space-y-5" noValidate>
			{/* Provider */}
			<div className="space-y-1.5">
				<Label htmlFor="provider">
					Provider <span className="text-destructive">*</span>
				</Label>
				{isEdit ? (
					<Input id="provider" value={meta?.label ?? providerKind} disabled />
				) : (
					<Select
						value={providerKind}
						onValueChange={(v) => {
							setProviderKind(v as LLMProviderKind);
							setTestState({ kind: "untested" });
						}}
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

			{/* Model id */}
			<div className="space-y-1.5">
				<Label htmlFor="model_id">
					Model ID <span className="text-destructive">*</span>
				</Label>
				<Input
					id="model_id"
					placeholder={meta?.exampleModelId}
					value={modelId}
					onChange={(e) => {
						setModelId(e.target.value);
						setTestState({ kind: "untested" });
					}}
				/>
			</div>

			{/* API key */}
			{requiresKey && (
				<div className="space-y-1.5">
					<Label htmlFor="api_key">
						API key{" "}
						{apiKeyNeeded ? (
							<span className="text-destructive">*</span>
						) : (
							<span className="text-muted-foreground">
								(leave blank to keep stored key)
							</span>
						)}
					</Label>
					<Input
						id="api_key"
						type="password"
						placeholder="••••••••"
						value={apiKey}
						onChange={(e) => {
							setApiKey(e.target.value);
							setTestState({ kind: "untested" });
						}}
						autoComplete="new-password"
					/>
				</div>
			)}

			{/* Base URL */}
			{showsBaseUrl && (
				<div className="space-y-1.5">
					<Label htmlFor="base_url">
						Base URL
						{providerKind === "ollama" && (
							<span className="text-muted-foreground ml-1">
								(e.g. http://localhost:11434)
							</span>
						)}
					</Label>
					<Input
						id="base_url"
						placeholder={
							providerKind === "ollama"
								? "http://localhost:11434"
								: "https://your-endpoint.example.com"
						}
						value={baseUrl}
						onChange={(e) => {
							setBaseUrl(e.target.value);
							setTestState({ kind: "untested" });
						}}
					/>
				</div>
			)}

			{/* Default */}
			<div className="flex items-center gap-3">
				<Switch
					id="is_default"
					checked={isDefault}
					onCheckedChange={setIsDefault}
				/>
				<Label htmlFor="is_default" className="cursor-pointer">
					Use as default for this Graph
				</Label>
			</div>

			{/* Test result (edit only) */}
			{isEdit && testState.kind === "passed" && (
				<div className="flex items-center gap-2 text-green-500">
					<CheckCircle2 className="w-4 h-4" />
					<span>
						Provider responded
						{testState.latencyMs !== undefined && (
							<span className="text-muted-foreground">
								{" "}
								· {testState.latencyMs} ms
							</span>
						)}
					</span>
				</div>
			)}
			{isEdit && testState.kind === "failed" && (
				<div className="flex items-start gap-2 text-destructive">
					<XCircle className="w-4 h-4 mt-0.5 shrink-0" />
					<span>{testState.error}</span>
				</div>
			)}

			{/* Actions */}
			<div className="flex justify-between gap-3 pt-2">
				{isEdit && (
					<Button
						type="button"
						variant="outline"
						onClick={() => testMutation.mutate()}
						disabled={!formValid || testState.kind === "testing"}
					>
						{testState.kind === "testing" ? (
							<>
								<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
								Testing…
							</>
						) : (
							"Test"
						)}
					</Button>
				)}
				<div className="flex gap-3 ml-auto">
					<Button
						type="button"
						variant="outline"
						onClick={onDone}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={!formValid || isSubmitting}>
						{isSubmitting
							? "Saving…"
							: isEdit
								? "Save changes"
								: "Add provider"}
					</Button>
				</div>
			</div>
		</form>
	);
}
