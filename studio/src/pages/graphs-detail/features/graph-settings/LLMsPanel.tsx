import { FormError } from "@/components/forms/FormError";
import {
	useCreateLLMProviderMutation,
	useDeleteLLMProviderMutation,
	useLLMProvidersQuery,
	useSetDefaultLLMProviderMutation,
	useUpdateLLMProviderMutation,
} from "@/hooks/queries/useLLMProviders";
import {
	ListPanelChrome,
	ListRow,
} from "@/pages/graphs-detail/shared/ListPanel";
import { llmProvidersApi } from "@/services/api/llm";
import {
	type LLMCredentialKind,
	type LLMProvider,
	type LLMProviderCreate,
	type LLMProviderKind,
	LLM_PROVIDER_OPTIONS,
} from "@/types/llm";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
} from "@invana/forms";
import {
	Badge,
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	Skeleton,
} from "@invana/ui";
import { useMutation } from "@tanstack/react-query";
import {
	CheckCircle2,
	ChevronRight,
	Loader2,
	Maximize2,
	Minimize2,
	Plus,
	Sparkles,
	Star,
	Trash2,
	X,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
	/** Collapses the docked panel. */
	onClose?: () => void;
	/** Whether the panel currently fills the main column. */
	expanded?: boolean;
	onToggleExpanded?: () => void;
	/**
	 * Rendered inside the settings panel's `LLMs` tab rather than as a panel of
	 * its own (G29). The tab strip is the header, so the chrome goes and the
	 * trail, **Add** and the rule line move into the body — one panel has one tab
	 * strip and no second header row under it.
	 */
	embedded?: boolean;
}

/** What the panel is showing: the list, the add form, or one provider. */
type View =
	| { kind: "list" }
	| { kind: "new" }
	| { kind: "provider"; id: string };

/**
 * Graph settings → the `LLMs` tab (providers-and-models.md PM6 · G29).
 *
 * A provider is the Graph's own configuration in exactly the way the connection
 * is — one is the database it reads, the other the model it thinks with — so it
 * is a tab of Settings rather than an icon of its own in `leftNav`, which is for
 * things a person *goes to*.
 *
 * The list → detail shape survives the move: `LLM Providers` on the list,
 * `› Add` while adding, `› <provider>` on one, with the root crumb the way back.
 * What changes is where that trail lives — the tab strip is the panel's header
 * now, so the trail and **Add** sit on the tab's own rule line, and search goes
 * with the chrome: a Graph has two or three providers and the status bar already
 * counts them.
 *
 * `embedded={false}` keeps the standalone `ListPanelChrome` rendering, which is
 * what a `?panel=llms` bookmark used to land on.
 */
export function LLMsPanel({
	username,
	graphSlug,
	onClose,
	expanded,
	onToggleExpanded,
	embedded = false,
}: Props) {
	const providers = useLLMProvidersQuery(username, graphSlug);
	const [view, setView] = useState<View>({ kind: "list" });

	const items = providers.data?.items ?? [];
	// Resolve by id, not by holding the row object: a refetch (or a delete from
	// another tab) would otherwise keep an edit form open over a stale provider.
	const selected =
		view.kind === "provider"
			? (items.find((p) => p.id === view.id) ?? null)
			: null;
	const inForm = view.kind === "new" || selected !== null;
	const backToList = () => setView({ kind: "list" });

	const leadingActions = [
		...(inForm
			? []
			: [
					{
						key: "new",
						name: "Add provider",
						icon: Plus,
						onClick: () => setView({ kind: "new" }),
					},
				]),
		...(onToggleExpanded
			? [
					{
						key: "expand",
						name: expanded ? "Collapse to side panel" : "Expand to full width",
						icon: expanded ? Minimize2 : Maximize2,
						onClick: onToggleExpanded,
					},
				]
			: []),
	];

	const body = ({ search }: { search: string }) => {
		if (inForm) {
			return (
				<div className="h-full overflow-y-auto p-4">
					<LLMProviderForm
						username={username}
						graphSlug={graphSlug}
						existing={selected}
						onDone={backToList}
					/>
				</div>
			);
		}

		if (providers.isLoading) {
			return (
				<div className="space-y-3 p-4">
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			);
		}

		const q = search.trim().toLowerCase();
		const shown = q
			? items.filter((p) =>
					`${providerLabel(p)} ${p.model_id} ${p.base_url ?? ""}`
						.toLowerCase()
						.includes(q),
				)
			: items;
		const defaults = items.filter((p) => p.is_default).length;

		return (
			<div className="flex h-full min-h-0 flex-col">
				<div className="min-h-0 flex-1 overflow-y-auto">
					{items.length === 0 ? (
						<p className="p-4 text-muted-foreground">
							No providers configured yet. Add one to enable agent runs — an
							agent binds a provider, and nothing else in the product picks one.
						</p>
					) : shown.length === 0 ? (
						<p className="p-4 text-muted-foreground">
							No provider matches “{search}”.
						</p>
					) : (
						shown.map((p) => (
							<ProviderRow
								key={p.id}
								username={username}
								graphSlug={graphSlug}
								provider={p}
								onOpen={() => setView({ kind: "provider", id: p.id })}
							/>
						))
					)}
				</div>
				<PanelStatusBar
					left={<StatusCrumb active>LLM Providers</StatusCrumb>}
					middle={[
						`${items.length} provider${items.length === 1 ? "" : "s"}`,
						defaults === 0 ? (
							<StatusCount key="d" tone="warning">
								no default
							</StatusCount>
						) : null,
					].filter(Boolean)}
				/>
			</div>
		);
	};

	if (embedded) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<div className="flex items-start justify-between gap-3 px-4 pt-4 text-xs text-muted-foreground">
					{inForm ? (
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={backToList}
						>
							LLM Providers
							<ChevronRight className="size-3.5" />
							<span className="truncate text-foreground">
								{selected ? providerLabel(selected) : "Add"}
							</span>
						</Button>
					) : (
						<>
							<p className="min-w-0">
								An agent binds a provider; nothing else in the product picks
								one.
							</p>
							<Button
								variant="outline"
								size="sm"
								className="shrink-0"
								onClick={() => setView({ kind: "new" })}
							>
								<Plus className="size-3.5" />
								Add
							</Button>
						</>
					)}
				</div>
				<div className="min-h-0 flex-1">{body({ search: "" })}</div>
			</div>
		);
	}

	return (
		<ListPanelChrome
			title={
				inForm ? (
					<Breadcrumb>
						<BreadcrumbList className="gap-1 font-semibold sm:gap-1">
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<button type="button" onClick={backToList}>
										LLM Providers
									</button>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem className="min-w-0">
								<BreadcrumbPage className="truncate font-semibold">
									{selected ? providerLabel(selected) : "Add"}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				) : (
					"LLM Providers"
				)
			}
			icon={Sparkles}
			onRefresh={() => providers.refetch()}
			isRefreshing={providers.isFetching}
			searchable
			searchLabel="Search providers"
			listControls={!inForm}
			onClose={onClose}
			closeLabel="Close panel"
			closeIcon={X}
			leadingActions={leadingActions}
		>
			{body}
		</ListPanelChrome>
	);
}

function providerLabel(provider: LLMProvider) {
	return (
		LLM_PROVIDER_OPTIONS.find((o) => o.value === provider.provider)?.label ??
		provider.provider
	);
}

function ProviderRow({
	username,
	graphSlug,
	provider,
	onOpen,
}: {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
	onOpen: () => void;
}) {
	const setDefault = useSetDefaultLLMProviderMutation(username, graphSlug);
	const remove = useDeleteLLMProviderMutation(username, graphSlug);
	const label = providerLabel(provider);

	return (
		<ListRow
			onClick={onOpen}
			title={
				<span className="flex items-center gap-2">
					<span className="truncate font-medium">{label}</span>
					{provider.is_default && (
						<Badge variant="secondary" className="text-xs">
							default
						</Badge>
					)}
				</span>
			}
			subtitle={
				<span className="truncate font-mono">
					{provider.model_id}
					{provider.base_url ? ` · ${provider.base_url}` : ""}
				</span>
			}
			actions={
				<>
					{!provider.is_default && (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 opacity-0 group-hover:opacity-100"
							title="Set as this Graph's default"
							disabled={setDefault.isPending}
							onClick={(e) => {
								e.stopPropagation();
								setDefault.mutate(provider.id, {
									onError: (err) => toast.error(err.message),
									onSuccess: () => toast.success("Default updated"),
								});
							}}
						>
							<Star className="h-3.5 w-3.5" />
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 opacity-0 group-hover:opacity-100"
						title="Delete this provider"
						disabled={remove.isPending}
						onClick={(e) => {
							e.stopPropagation();
							if (!confirm(`Delete this ${label} provider?`)) return;
							remove.mutate(provider.id, {
								onError: (err) => toast.error(err.message),
								onSuccess: () => toast.success("Provider deleted"),
							});
						}}
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</>
			}
		/>
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
	// claude_agent_sdk only (docs/for-developers/modules/agents/features/providers-and-models.md) — which env var the credential becomes.
	const [credentialKind, setCredentialKind] = useState<LLMCredentialKind>(
		existing?.credential_kind ?? "api_key",
	);
	const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
	const [isDefault, setIsDefault] = useState(existing?.is_default ?? false);
	const [testState, setTestState] = useState<TestState>({ kind: "untested" });

	const meta = LLM_PROVIDER_OPTIONS.find((o) => o.value === providerKind);
	const requiresKey = meta?.requiresApiKey ?? false;
	const keyOptional = meta?.apiKeyOptional ?? false;
	const showsBaseUrl = meta?.usesBaseUrl ?? false;
	const isClaudeAgentSdk = providerKind === "claude_agent_sdk";
	// Selecting "Subscription token" is a commitment, not a fallback — unlike
	// the API-key path there's no "blank means use the CLI's own login" for it.
	const oauthTokenWanted = isClaudeAgentSdk && credentialKind === "oauth_token";

	// On edit, the existing credential is already stored; only require fresh
	// entry when nothing is on file yet, or the row requires one outright.
	const apiKeyNeeded =
		(requiresKey || oauthTokenWanted) && !(isEdit && existing?.has_api_key);
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
		credential_kind: isClaudeAgentSdk ? credentialKind : undefined,
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
				credential_kind: payload.credential_kind,
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
						credential_kind: isClaudeAgentSdk ? credentialKind : undefined,
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

			{/* Credential type (claude_agent_sdk only, docs/for-developers/modules/agents/features/providers-and-models.md) */}
			{isClaudeAgentSdk && (
				<div className="space-y-1.5">
					<Label htmlFor="credential_kind">Credential type</Label>
					<Select
						value={credentialKind}
						onValueChange={(v) => {
							setCredentialKind(v as LLMCredentialKind);
							setApiKey("");
							setTestState({ kind: "untested" });
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
			)}

			{/* API key / subscription token */}
			{(requiresKey || keyOptional) && (
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
								(leave blank to keep stored {oauthTokenWanted ? "token" : "key"}
								)
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
					{oauthTokenWanted && (
						<p className="text-muted-foreground">
							Generate one on your machine with{" "}
							<code className="font-mono">claude setup-token</code> (requires a
							Claude Pro/Max/Team/Enterprise plan).
						</p>
					)}
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

			<FormError error={create.error ?? update.error} />

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
