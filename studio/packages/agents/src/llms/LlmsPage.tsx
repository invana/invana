/**
 * **LLMs** — the model versions this Graph offers, as a page of its own at
 * `/agents/llms` ([fleet-performance.md](../../../../../docs/for-developers/modules/agents/features/fleet-performance.md) ·
 * [providers-and-models.md](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)).
 *
 * *As the person who looks after this Graph's models, I want every version it
 * offers beside who pins it, so that I know what a version change would move
 * before I make one.*
 *
 * **One row per model version.** Each endpoint's models are rows — model ·
 * version name · endpoint · pinned by · status — and a pinned address that no
 * endpoint offers is a row too, because it is the one that refuses runs. A
 * removed model is listed only while something still pins it.
 *
 * **A status is what the Graph offers, nothing else.** `offered`, or `no longer
 * offered`. Invana reads no vendor release feed, so the page never says a newer
 * version exists; the notice above the table names each pinned version that is
 * no longer offered and who pins it.
 *
 * **Pinned by is read where pins live** — agents, the current published skill
 * versions, eval judges — plus the worlds whose `cast` names the address. The
 * pins are a separate read; if it fails the table still draws, without them.
 *
 * **An endpoint opens in a sheet over the page.** `provider` is the page's one
 * URL key: `/agents/llms/<id>` is that endpoint's detail, `/agents/llms/new` the
 * form that configures one. Closing the sheet clears it.
 */

import {
	Alert,
	AlertDescription,
	Badge,
	EmptyState,
	RecordHeader,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Spinner,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { type Lens, useLensesQuery } from "@invana-studio/core";
import { ActButton, usePageParams } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { FleetPageProps } from "../fleet/FleetPageProps";
import { useModelPinsQuery } from "../fleet/queries";
import type { ModelPin } from "../fleet/types";
import { ProviderDetail } from "./ProviderDetail";
import { ProviderForm } from "./ProviderForm";
import { useLLMProvidersQuery } from "./queries";
import type { LLMProvider } from "./types";

/** `provider=new` is the form, a value of the one key rather than a second key. */
const NEW_PROVIDER = "new";
const PROVIDER_PARAM = "provider";

/**
 * Which worlds name each address in their `cast`, read off the lens list —
 * never a counter, which can disagree with the rows it counts.
 */
function castByAddress(lenses: Lens[]): Map<string, string[]> {
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

/** `llm/<provider>/<model_id>` → its two segments; a model id may hold `/`. */
function splitAddress(address: string): { provider: string; model: string } {
	const [, provider = "", ...rest] = address.split("/");
	return { provider, model: rest.join("/") };
}

/** One row of the table: a version an endpoint offers, or one only a pin names. */
interface VersionRow {
	address: string;
	model: string;
	versionName: string;
	provider: LLMProvider | null;
	/** The endpoint segment, for a row no endpoint offers. */
	providerName: string;
	offered: boolean;
	/** An endpoint once offered it; false for an address nothing offers. */
	removed: boolean;
	pinnedBy: string[];
}

/** Who pins an address, in the words the cell reads. */
function pinnedByWords(pin: ModelPin | undefined, worlds: string[]): string[] {
	return [
		...(pin?.agents ?? []).map((a) => a.name),
		...(pin?.skills ?? []).map((s) => `${s.name} v${s.version}`),
		...(pin?.judges ?? []).map((j) => `${j.name} evals judge`),
		...worlds.map((w) => `the ${w} world`),
	];
}

function versionRows(
	providers: LLMProvider[],
	pins: ModelPin[],
	castBy: Map<string, string[]>,
): VersionRow[] {
	const pinOf = new Map(pins.map((p) => [p.address, p]));
	const rows: VersionRow[] = [];
	const listed = new Set<string>();
	for (const provider of providers) {
		for (const model of provider.models) {
			const pinnedBy = pinnedByWords(
				pinOf.get(model.address),
				castBy.get(model.address) ?? [],
			);
			const offered = model.status === "active";
			// A version nobody pins and nobody is offered is not the Graph's any more.
			if (!offered && !pinnedBy.length) continue;
			listed.add(model.address);
			rows.push({
				address: model.address,
				model: model.display_name || model.model_id,
				versionName: model.model_id,
				provider,
				providerName: provider.name,
				offered,
				removed: !offered,
				pinnedBy,
			});
		}
	}
	for (const pin of pins) {
		if (listed.has(pin.address)) continue;
		const pinnedBy = pinnedByWords(pin, []);
		if (!pinnedBy.length) continue;
		const { provider: name, model } = splitAddress(pin.address);
		rows.push({
			address: pin.address,
			model,
			versionName: model,
			provider: providers.find((p) => p.name === name) ?? null,
			providerName: name,
			offered: false,
			removed: false,
			pinnedBy,
		});
	}
	return rows;
}

/** `ollama · local` — the endpoint's name, and its kind where that differs. */
function endpointWords(row: VersionRow): string {
	const kind = row.provider?.provider;
	return kind && kind !== row.providerName
		? `${row.providerName} · ${kind}`
		: row.providerName;
}

function plural(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** The page's one URL key, read and written as a path segment. */
function useProviderParam(): [string | null, (id: string | null) => void] {
	const [params, setParams] = usePageParams();
	const set = useCallback(
		(id: string | null) =>
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (id) next.set(PROVIDER_PARAM, id);
					else next.delete(PROVIDER_PARAM);
					return next;
				},
				{ replace: true },
			),
		[setParams],
	);
	return [params.get(PROVIDER_PARAM), set];
}

export function LlmsPage({ username, graphSlug }: FleetPageProps) {
	const [providerId, openProvider] = useProviderParam();
	const providers = useLLMProvidersQuery(username, graphSlug);
	const pins = useModelPinsQuery(username, graphSlug);
	const lenses = useLensesQuery(username, graphSlug);

	const items = providers.data?.items ?? [];
	const castBy = useMemo(
		() => castByAddress(lenses.data?.items ?? []),
		[lenses.data],
	);
	// A failed pins read draws the table without them, never an error page.
	const rows = useMemo(
		() => versionRows(items, pins.data?.items ?? [], castBy),
		[items, pins.data, castBy],
	);
	const stale = rows.filter((r) => !r.offered);

	const authoring = providerId === NEW_PROVIDER;
	const open = authoring
		? null
		: (items.find((p) => p.id === providerId) ?? null);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto">
			<RecordHeader
				size="lg"
				crumbs={["LLMs"]}
				chips={
					providers.data ? (
						<Badge variant="outline" tone="muted" size="xs">
							{plural(providers.data.total, "endpoint")} ·{" "}
							{plural(rows.length, "model version")}
						</Badge>
					) : null
				}
				actions={
					<ActButton
						area="settings"
						size="sm"
						onClick={() => openProvider(NEW_PROVIDER)}
					>
						<Plus />
						Add endpoint
					</ActButton>
				}
			/>
			<div className="flex flex-col gap-3 p-3">
				<p className="text-sm text-muted-foreground">
					A run records the version it used; moving an agent to a new version is
					a change, with evals, in its History
				</p>

				{stale.length ? (
					<Alert tone="warning">
						<AlertDescription className="flex flex-col gap-1">
							{stale.map((r) => (
								<p key={r.address}>
									<span className="font-mono font-semibold">
										{r.versionName}
									</span>{" "}
									{r.removed
										? `is no longer offered by ${r.providerName}`
										: "is not offered by any endpoint of this Graph"}
									. Pinned by {r.pinnedBy.join(" · ")} — their runs refuse until
									they are moved to an offered version.
								</p>
							))}
						</AlertDescription>
					</Alert>
				) : null}

				<PanelSection
					card
					title="Model versions"
					action={
						providers.data ? (
							<span className="text-sm text-muted-foreground">
								{rows.length}
							</span>
						) : null
					}
				>
					{providers.isLoading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Spinner className="size-3" />
							reading this Graph's endpoints
						</div>
					) : providers.error ? (
						<EmptyState
							title="Could not read this Graph's endpoints"
							description={
								providers.error instanceof Error
									? providers.error.message
									: "The request failed."
							}
						/>
					) : !items.length && !rows.length ? (
						// A sentence, never an empty table: nothing configured is the state
						// that makes every NL run refuse, so it says what that costs.
						<div className="flex flex-col items-start gap-2">
							<p className="text-muted-foreground">
								None configured — every question that needs a model is refused
								until one is. Add an endpoint and the cast can name what it
								offers.
							</p>
							<ActButton
								area="settings"
								size="sm"
								variant="outline"
								onClick={() => openProvider(NEW_PROVIDER)}
							>
								<Plus />
								Add endpoint
							</ActButton>
						</div>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Model</TableHead>
									<TableHead className="whitespace-nowrap">
										Version name
									</TableHead>
									<TableHead>Endpoint</TableHead>
									<TableHead className="whitespace-nowrap">Pinned by</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((r) => (
									<TableRow
										key={r.address}
										className={r.provider ? "cursor-pointer" : undefined}
										onClick={
											r.provider
												? () => openProvider(r.provider?.id ?? null)
												: undefined
										}
									>
										<TableCell className="whitespace-nowrap">
											{r.model}
										</TableCell>
										<TableCell className="whitespace-nowrap font-mono">
											{r.versionName}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{endpointWords(r)}
										</TableCell>
										<TableCell className="w-full">
											{r.pinnedBy.length ? (
												r.pinnedBy.join(" · ")
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											<span className="flex items-center gap-1.5">
												<StatusDot tone={r.offered ? "success" : "warning"} />
												{r.offered
													? "offered"
													: r.removed
														? "no longer offered"
														: "not offered"}
											</span>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</div>

			<Sheet
				open={authoring || !!open}
				onOpenChange={(next) => {
					if (!next) openProvider(null);
				}}
			>
				<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
					<SheetHeader className="border-b p-3">
						<SheetTitle className="font-mono">
							{authoring ? "New endpoint" : open?.name}
						</SheetTitle>
						<SheetDescription>
							{authoring
								? "A name a rule can write against, a vendor and one credential."
								: "What this endpoint offers, and who casts or pins each model."}
						</SheetDescription>
					</SheetHeader>
					{authoring ? (
						<div className="p-3">
							<ProviderForm
								username={username}
								graphSlug={graphSlug}
								existing={null}
								onDone={(id) => openProvider(id ?? null)}
								onCancel={() => openProvider(null)}
							/>
						</div>
					) : open ? (
						<ProviderDetail
							username={username}
							graphSlug={graphSlug}
							provider={open}
							castBy={castBy}
							onGone={() => openProvider(null)}
						/>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
