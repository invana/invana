/**
 * **LLMs** — the endpoints this Graph calls and every model version they offer,
 * as a section page at `/agents/llms` ([the-agents-shell.md](../../../../../docs/for-developers/modules/agents/features/the-agents-shell.md) ·
 * [providers-and-models.md](../../../../../docs/for-developers/modules/agents/features/providers-and-models.md)).
 *
 * *As the person who looks after this Graph's models, I want every version it
 * offers beside who pins it, so that I know what a version change would move
 * before I make one.*
 *
 * Top to bottom:
 *
 * - **The warning** — each pinned version no endpoint offers, naming who pins
 *   it: those runs refuse until they move.
 * - **The endpoints** — one card each: its kind, its credential, the versions
 *   it offers by name. *Open* opens its modal.
 * - **Model versions** — one row per version: model · version name · endpoint ·
 *   pinned by · status. A pinned address no endpoint offers is a row too,
 *   because it is the one that refuses runs. A removed version is listed only
 *   while something still pins it.
 *
 * **A status is what the Graph offers, nothing else.** Invana reads no vendor
 * release feed, so the page never says a newer version exists.
 *
 * **The endpoint modal is in the path** — `/agents/llms/<id>` is `detail` —
 * so a link opens it and a reload keeps it. *Add endpoint* is a modal of local
 * state: adding is an act, not a place.
 *
 * The pins are a separate read; if it fails the page still draws, without them.
 */

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	EmptyState,
	PropertyList,
	PropertyRow,
	Spinner,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useLensesQuery } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { BrainCircuit, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useModelPinsQuery } from "../fleet/queries";
import { EVERY } from "../lists";
import { useAgentsOpen } from "../open";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { AddEndpointDialog } from "./AddEndpointDialog";
import { EndpointDialog } from "./EndpointDialog";
import { castByAddress, PinnedBy, type Pinner, pinnersOf } from "./pinnedBy";
import { useLLMProvidersQuery } from "./queries";
import { LLM_PROVIDER_OPTIONS, type LLMProvider } from "./types";

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
	pinnedBy: Pinner[];
}

function versionRows(
	providers: LLMProvider[],
	pinnedAddresses: string[],
	pinnersAt: (address: string) => Pinner[],
): VersionRow[] {
	const rows: VersionRow[] = [];
	const listed = new Set<string>();
	for (const provider of providers) {
		for (const model of provider.models) {
			const pinnedBy = pinnersAt(model.address);
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
	for (const address of pinnedAddresses) {
		if (listed.has(address)) continue;
		const pinnedBy = pinnersAt(address);
		if (!pinnedBy.length) continue;
		const { provider: name, model } = splitAddress(address);
		rows.push({
			address,
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

function kindLabel(provider: LLMProvider): string {
	return (
		LLM_PROVIDER_OPTIONS.find((o) => o.value === provider.provider)?.label ??
		provider.provider
	);
}

/** What the credential is, in words — the engine never returns the secret. */
function credentialWords(provider: LLMProvider): string {
	if (!provider.has_api_key)
		return provider.provider === "claude_agent_sdk"
			? "none — the local Claude Code login answers"
			: "none";
	return provider.credential_kind === "oauth_token"
		? "subscription token, stored"
		: "key, stored";
}

export function LlmsPage({
	username,
	graphSlug,
	detail,
	onDetail,
}: SectionPageProps) {
	const open = useAgentsOpen();
	const [adding, setAdding] = useState(false);
	const providers = useLLMProvidersQuery(username, graphSlug, EVERY);
	const pins = useModelPinsQuery(username, graphSlug);
	const lenses = useLensesQuery(username, graphSlug);

	const items = providers.data?.items ?? [];
	const pinnersAt = useMemo(() => {
		const castBy = castByAddress(lenses.data?.items ?? []);
		const pinOf = new Map((pins.data?.items ?? []).map((p) => [p.address, p]));
		return (address: string) =>
			pinnersOf(pinOf.get(address), castBy.get(address) ?? [], open);
	}, [lenses.data, pins.data, open]);
	// A failed pins read draws the table without them, never an error page.
	const rows = useMemo(
		() =>
			versionRows(
				items,
				(pins.data?.items ?? []).map((p) => p.address),
				pinnersAt,
			),
		[items, pins.data, pinnersAt],
	);
	const stale = rows.filter((r) => !r.offered);
	const openProvider = detail
		? (items.find((p) => p.id === detail) ?? null)
		: null;

	const addAct = (
		<ActButton area="settings" size="sm" onClick={() => setAdding(true)}>
			<Plus />
			Add endpoint
		</ActButton>
	);

	return (
		<SectionPage
			section="llms"
			chips={
				providers.data ? (
					<Badge variant="outline" tone="muted" size="xs">
						{providers.data.total}{" "}
						{providers.data.total === 1 ? "endpoint" : "endpoints"}
					</Badge>
				) : null
			}
			actions={addAct}
		>
			<SectionBody>
				{providers.isLoading ? (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Spinner />
						Reading this Graph's endpoints…
					</div>
				) : providers.error ? (
					<EmptyState
						title="Could not read this Graph's endpoints"
						description={providers.error.message}
					/>
				) : !items.length && !rows.length ? (
					// Nothing configured is the state that makes every NL run refuse,
					// so it says what that costs.
					<EmptyState
						icon={<BrainCircuit className="size-6" />}
						title="No endpoints"
						description="Every question that needs a model is refused until one is configured. Add an endpoint and the cast can name what it offers."
						actions={addAct}
					/>
				) : (
					<>
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
											, and <PinnedBy pinners={r.pinnedBy} /> still{" "}
											{r.pinnedBy.length === 1 ? "pins" : "pin"} it — those runs
											refuse until they move to an offered version.
										</p>
									))}
								</AlertDescription>
							</Alert>
						) : null}

						{items.length ? (
							<div className="grid gap-3 lg:grid-cols-2">
								{items.map((p) => (
									<EndpointCard
										key={p.id}
										provider={p}
										onOpen={() => onDetail(p.id)}
									/>
								))}
							</div>
						) : null}

						<PanelSection card title="Model versions">
							{rows.length ? (
								<VersionsTable rows={rows} onDetail={onDetail} />
							) : (
								<p className="py-2 text-muted-foreground">
									No endpoint offers a version yet — open one and offer it.
								</p>
							)}
						</PanelSection>
					</>
				)}
			</SectionBody>

			<EndpointDialog
				username={username}
				graphSlug={graphSlug}
				id={detail}
				provider={openProvider}
				loading={providers.isLoading}
				pinnersOf={pinnersAt}
				onClose={() => onDetail(null)}
			/>
			<AddEndpointDialog
				username={username}
				graphSlug={graphSlug}
				open={adding}
				onOpenChange={setAdding}
				onAdded={(id) => {
					setAdding(false);
					onDetail(id);
				}}
			/>
		</SectionPage>
	);
}

/** One endpoint: what it is, how it authenticates, the versions it offers. */
function EndpointCard({
	provider,
	onOpen,
}: {
	provider: LLMProvider;
	onOpen: () => void;
}) {
	const offered = provider.models.filter((m) => m.status === "active");
	return (
		<PanelSection
			card
			title={provider.name}
			action={
				<Button
					variant="ghost"
					size="sm"
					aria-label={`Open ${provider.name}`}
					onClick={onOpen}
				>
					Open
				</Button>
			}
		>
			<PropertyList>
				<PropertyRow label="Kind">{kindLabel(provider)}</PropertyRow>
				<PropertyRow label="Credential">
					{credentialWords(provider)}
				</PropertyRow>
				{provider.base_url ? (
					<PropertyRow label="Base URL" mono>
						<span className="truncate">{provider.base_url}</span>
					</PropertyRow>
				) : null}
				<PropertyRow label="Versions">
					{offered.length ? (
						<span className="font-mono">
							{offered.map((m) => m.model_id).join(" · ")}
						</span>
					) : (
						<span className="text-muted-foreground">none offered</span>
					)}
				</PropertyRow>
			</PropertyList>
		</PanelSection>
	);
}

function VersionsTable({
	rows,
	onDetail,
}: {
	rows: VersionRow[];
	onDetail: (id: string) => void;
}) {
	return (
		<Table bordered={false} density="compact">
			<TableHeader>
				<TableRow>
					<TableHead>Model</TableHead>
					<TableHead className="whitespace-nowrap">Version name</TableHead>
					<TableHead>Endpoint</TableHead>
					<TableHead className="whitespace-nowrap">Pinned by</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((r) => (
					<TableRow key={r.address}>
						<TableCell className="whitespace-nowrap">{r.model}</TableCell>
						<TableCell className="whitespace-nowrap font-mono">
							{r.versionName}
						</TableCell>
						<TableCell className="whitespace-nowrap font-mono">
							{r.provider ? (
								<Button
									variant="link"
									size="sm"
									className="h-auto p-0 font-mono"
									onClick={() => r.provider && onDetail(r.provider.id)}
								>
									{r.providerName}
								</Button>
							) : (
								r.providerName
							)}
						</TableCell>
						<TableCell className="w-full">
							<PinnedBy pinners={r.pinnedBy} />
						</TableCell>
						<TableCell className="whitespace-nowrap">
							<span className="flex items-center gap-1.5">
								<StatusDot tone={r.offered ? "success" : "error"} />
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
	);
}
