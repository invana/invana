/**
 * A6 · **LLMs is a drawer of the Agents panel**, not a tab of Graph settings
 * ([PM6](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md) ·
 * [GV18](../../../../../docs/for-developers/modules/govern/spec.md)).
 *
 * *As someone reading an agent's cast, I want the endpoints it resolves against
 * one drawer away, so that "which model answers this" and "what is configured"
 * are one reading.*
 *
 * **An endpoint is a group and its models are the rows under it** (PM9). The
 * old panel drew one row per provider because one row *was* one model; now the
 * address has two segments and the list has two levels, so what a rule names —
 * `llm/anthropic-prod/claude-opus-5` — is visible without opening anything.
 *
 * **Nothing here is a default.** `is_default` and its star are gone: the lens
 * `cast` answers *which model when nobody said* (PM4). What a row states
 * instead is who casts it, which is the fact that decides whether it can be
 * removed at all (PM11).
 */

import {
	ProviderDetail,
	providerLabel,
} from "@/pages/graphs-detail/features/agents/ProviderDetail";
import { ProviderForm } from "@/pages/graphs-detail/features/agents/ProviderForm";
import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import type { Lens } from "@/types/govern";
import type { LLMProvider } from "@/types/llm";
import {
	AddressChip,
	EmptyState,
	type PanelStackSection,
	Spinner,
	StatusDot,
} from "@invana/ui";
import { Plus, Sparkles } from "lucide-react";

/** `&provider=new` is the authoring drill-in — a value, not a second param. */
export const NEW_PROVIDER = "new";

/**
 * Which worlds name each address in their `cast`, read off the one lens list
 * the Govern panel already fetches — never a counter, which can disagree with
 * the rows it counts.
 */
export function castByAddress(lenses: Lens[]): Map<string, string[]> {
	const out = new Map<string, string[]>();
	for (const lens of lenses) {
		for (const address of Object.values(lens.cast ?? {})) {
			if (!address) continue;
			const names = out.get(address) ?? [];
			// A world can cast one address in two roles; it is one world either way.
			if (!names.includes(lens.display_name)) names.push(lens.display_name);
			out.set(address, names);
		}
	}
	return out;
}

export interface LlmsDrawerProps {
	ui: TaskDrawerUi;
	username: string;
	graphSlug: string;
	items: LLMProvider[];
	isLoading: boolean;
	error: unknown;
	/** Worlds and guardrails, for *who casts this model* (PM11). */
	lenses: Lens[];
	providerId: string | null;
	onOpenProvider: (id: string | null) => void;
	defaultSize?: number | string;
}

export function llmsDrawerSection({
	ui,
	username,
	graphSlug,
	items,
	isLoading,
	error,
	lenses,
	providerId,
	onOpenProvider,
	defaultSize,
}: LlmsDrawerProps): PanelStackSection {
	const authoring = providerId === NEW_PROVIDER;
	const drilled = authoring
		? null
		: (items.find((p) => p.id === providerId) ?? null);
	const castBy = castByAddress(lenses);
	const models = items.reduce((n, p) => n + p.models.length, 0);

	return taskDrawerSection(
		{
			id: "llms",
			label: "LLMs",
			icon: Sparkles,
			count: isLoading
				? undefined
				: `${items.length} endpoint${items.length === 1 ? "" : "s"} · ${models} model${models === 1 ? "" : "s"}`,
			trail: authoring ? "New endpoint" : drilled?.name,
			onBack: () => onOpenProvider(null),
			headerActions: [
				{
					key: "new",
					name: "Add endpoint",
					icon: Plus,
					onClick: () => onOpenProvider(NEW_PROVIDER),
				},
			],
			defaultSize,
			children: () => {
				if (authoring) {
					return (
						<div className="p-3">
							<ProviderForm
								username={username}
								graphSlug={graphSlug}
								existing={null}
								onDone={(id) => onOpenProvider(id ?? null)}
								onCancel={() => onOpenProvider(null)}
							/>
						</div>
					);
				}

				if (drilled) {
					return (
						<ProviderDetail
							username={username}
							graphSlug={graphSlug}
							provider={drilled}
							castBy={castBy}
							onGone={() => onOpenProvider(null)}
						/>
					);
				}

				if (isLoading) {
					return (
						<div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
							<Spinner className="size-3" />
							reading this Graph's endpoints
						</div>
					);
				}

				if (error) {
					return (
						<EmptyState
							title="Could not read this Graph's endpoints"
							description={
								error instanceof Error ? error.message : "The request failed."
							}
						/>
					);
				}

				// A sentence, never an empty table. *Nothing configured* is the state
				// that makes every NL run refuse, so it says what that costs.
				if (!items.length) {
					return (
						<p className="px-3 py-2 text-sm text-muted-foreground">
							None configured — every question that needs a model is refused
							until one is. Add an endpoint and the cast can name what it
							offers.
						</p>
					);
				}

				return (
					<div className="flex min-w-0 flex-col">
						{items.map((provider) => (
							<ProviderGroup
								key={provider.id}
								provider={provider}
								castBy={castBy}
								onOpen={() => onOpenProvider(provider.id)}
							/>
						))}
					</div>
				);
			},
		},
		ui,
	);
}

/**
 * One endpoint and what it offers. The header opens it; the model rows read
 * their address and who casts them, because that is what decides whether a
 * model can stop being offered (PM11).
 */
function ProviderGroup({
	provider,
	castBy,
	onOpen,
}: {
	provider: LLMProvider;
	castBy: Map<string, string[]>;
	onOpen: () => void;
}) {
	return (
		<div className="flex min-w-0 flex-col border-b last:border-b-0">
			<button
				type="button"
				onClick={onOpen}
				className="flex min-w-0 items-center gap-2 px-3 py-2 text-left hover:bg-accent/50"
			>
				<StatusDot tone={provider.has_api_key ? "success" : "muted"} />
				<span className="truncate font-medium font-mono">{provider.name}</span>
				<span className="truncate text-sm text-muted-foreground">
					{providerLabel(provider)}
				</span>
			</button>

			{provider.models.length === 0 ? (
				<p className="px-3 pb-2 pl-8 text-sm text-muted-foreground">
					offers nothing — nothing resolves here
				</p>
			) : (
				provider.models.map((model) => {
					const names = castBy.get(model.address) ?? [];
					return (
						<div
							key={model.id}
							className="flex min-w-0 items-center gap-2 px-3 pb-2 pl-8"
						>
							<AddressChip address={model.address} className="min-w-0" />
							<span className="truncate text-sm text-muted-foreground">
								{names.length
									? `cast by ${names.join(" · ")}`
									: "named by nothing"}
							</span>
						</div>
					);
				})
			)}
		</div>
	);
}
