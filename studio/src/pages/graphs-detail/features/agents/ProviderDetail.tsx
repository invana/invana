/**
 * A6 · one configured endpoint, and the models it offers.
 *
 * *As the person who configured this endpoint, I want to see what it offers and
 * who casts each model, so that removing one is a decision rather than a
 * surprise.*
 *
 * **A model is a row under the endpoint, not a second endpoint** (PM9): the
 * address `llm/anthropic-prod/claude-opus-5` has a provider segment and a model
 * segment, and one row cannot be both. So this reads as the endpoint's own
 * fields, then its models, each with the address a rule names.
 *
 * **The safe case is visibly safe.** A model no cast names says so on its row;
 * removing one a world casts is refused, and the refusal — which names the
 * worlds (PM11) — is drawn where the click was, never as a toast that leaves
 * the reader looking for what it meant.
 */

import {
	useAddLLMModelMutation,
	useDeleteLLMProviderMutation,
	useRemoveLLMModelMutation,
} from "@/hooks/queries/useLLMProviders";
import { ProviderForm } from "@/pages/graphs-detail/features/agents/ProviderForm";
import { llmProvidersApi } from "@/services/api/llm";
import {
	type LLMModel,
	type LLMProvider,
	LLM_PROVIDER_OPTIONS,
} from "@/types/llm";
import { Input, Label } from "@invana/forms";
import {
	AddressChip,
	Button,
	CannotAnswerCard,
	PropertyList,
	PropertyRow,
	SectionHeader,
	StatusDot,
} from "@invana/ui";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function providerLabel(provider: LLMProvider): string {
	return (
		LLM_PROVIDER_OPTIONS.find((o) => o.value === provider.provider)?.label ??
		provider.provider
	);
}

/** Which worlds cast an address — `address → names`, read off the lens list. */
export type CastBy = Map<string, string[]>;

export interface ProviderDetailProps {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
	/** Worlds and guardrails that name each address in their `cast` (PM11). */
	castBy: CastBy;
	/** The endpoint is gone — the drawer goes back to the list. */
	onGone: () => void;
}

type Ping =
	| { kind: "untested" }
	| { kind: "testing" }
	| { kind: "passed"; latencyMs?: number }
	| { kind: "failed"; error: string };

export function ProviderDetail({
	username,
	graphSlug,
	provider,
	castBy,
	onGone,
}: ProviderDetailProps) {
	const [editing, setEditing] = useState(false);
	const [adding, setAdding] = useState(false);
	const [ping, setPing] = useState<Ping>({ kind: "untested" });
	/** The refusal from the last remove, held against the model it refused. */
	const [refusedId, setRefusedId] = useState<string | null>(null);

	const remove = useDeleteLLMProviderMutation(username, graphSlug);
	const removeModel = useRemoveLLMModelMutation(username, graphSlug);

	const pinger = useMutation({
		mutationFn: () => llmProvidersApi.ping(username, graphSlug, provider.id),
		onMutate: () => setPing({ kind: "testing" }),
		onSuccess: (result) =>
			setPing(
				result.ok
					? { kind: "passed", latencyMs: result.latency_ms }
					: {
							kind: "failed",
							// A provider's own error is shown verbatim (PM5).
							error: result.error ?? "The provider rejected the credentials.",
						},
			),
		onError: (err: Error) => setPing({ kind: "failed", error: err.message }),
	});

	if (editing) {
		return (
			<div className="p-3">
				<ProviderForm
					username={username}
					graphSlug={graphSlug}
					existing={provider}
					onDone={() => setEditing(false)}
					onCancel={() => setEditing(false)}
				/>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-3 p-3">
			<PropertyList>
				<PropertyRow label="Address">
					<span className="font-mono">llm/{provider.name}/…</span>
				</PropertyRow>
				<PropertyRow label="Vendor">{providerLabel(provider)}</PropertyRow>
				<PropertyRow label="Credential">
					{provider.has_api_key
						? provider.credential_kind === "oauth_token"
							? "subscription token, stored"
							: "key, stored"
						: "none — the local Claude Code login answers"}
				</PropertyRow>
				{provider.base_url ? (
					<PropertyRow label="Base URL">
						<span className="truncate font-mono">{provider.base_url}</span>
					</PropertyRow>
				) : null}
			</PropertyList>

			<div className="flex flex-wrap items-center gap-2">
				<Button size="sm" variant="outline" onClick={() => setEditing(true)}>
					Edit
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={ping.kind === "testing"}
					onClick={() => pinger.mutate()}
				>
					{ping.kind === "testing" ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : null}
					Ping
				</Button>
				<span className="flex-1" />
				<Button
					size="sm"
					variant="ghost"
					disabled={remove.isPending}
					onClick={() =>
						remove.mutate(provider.id, {
							onSuccess: () => {
								toast.success("Endpoint removed");
								onGone();
							},
							onError: (err) => toast.error(err.message),
						})
					}
				>
					<Trash2 className="size-3.5" />
					Remove
				</Button>
			</div>

			{/* The ping is a run, and its answer is a fact about this endpoint —
			    so it is stated here rather than thrown as a toast (PM3). */}
			{ping.kind === "passed" ? (
				<p className="flex items-center gap-1.5 text-sm text-success">
					<Check className="size-3.5" />
					answered
					{ping.latencyMs !== undefined ? (
						<span className="text-muted-foreground">· {ping.latencyMs} ms</span>
					) : null}
				</p>
			) : ping.kind === "failed" ? (
				<p className="flex items-start gap-1.5 text-sm text-destructive">
					<X className="mt-0.5 size-3.5 shrink-0" />
					<span>{ping.error}</span>
				</p>
			) : null}

			<SectionHeader
				title="Models"
				actions={
					<Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
						<Plus className="size-3.5" />
						Offer one
					</Button>
				}
			/>

			{adding ? (
				<AddModelForm
					username={username}
					graphSlug={graphSlug}
					provider={provider}
					onDone={() => setAdding(false)}
				/>
			) : null}

			{provider.models.length === 0 ? (
				// A sentence, never an empty table: an endpoint offering nothing is a
				// real state, and it is the one that makes a run refuse.
				<p className="text-sm text-muted-foreground">
					This endpoint offers no model, so nothing resolves to it. Offer one
					and a cast can name it.
				</p>
			) : (
				<div className="flex min-w-0 flex-col gap-2">
					{provider.models.map((model) => (
						<ModelRow
							key={model.id}
							model={model}
							castBy={castBy.get(model.address) ?? []}
							isRemoving={
								removeModel.isPending &&
								removeModel.variables?.modelRowId === model.id
							}
							refusal={
								refusedId === model.id && removeModel.error
									? removeModel.error.message
									: null
							}
							onRemove={() => {
								// Cleared first, so the card under this row is this click's
								// refusal and never the last one's.
								removeModel.reset();
								setRefusedId(model.id);
								removeModel.mutate(
									{ id: provider.id, modelRowId: model.id },
									{
										onSuccess: () => {
											setRefusedId(null);
											toast.success("No longer offered");
										},
									},
								);
							}}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ModelRow({
	model,
	castBy,
	isRemoving,
	refusal,
	onRemove,
}: {
	model: LLMModel;
	castBy: string[];
	isRemoving: boolean;
	refusal: string | null;
	onRemove: () => void;
}) {
	const ranks = model.capabilities;
	const unranked = ranks.cost_rank == null && ranks.power_rank == null;

	return (
		<div className="flex min-w-0 flex-col gap-1 rounded-md border p-2">
			<div className="flex min-w-0 items-center gap-2">
				<StatusDot
					tone={model.status === "active" ? "success" : "muted"}
					label={model.status}
				/>
				<AddressChip address={model.address} className="min-w-0" />
				<span className="flex-1" />
				<Button
					variant="ghost"
					size="icon"
					className="size-6"
					title="Stop offering this model"
					disabled={isRemoving}
					onClick={onRemove}
				>
					<Trash2 className="size-3.5" />
				</Button>
			</div>

			<p className="text-sm text-muted-foreground">
				{castBy.length ? (
					<>cast by {castBy.join(" · ")}</>
				) : (
					// The safe case, visibly safe (PM11).
					<>named by nothing — safe to remove</>
				)}
				{unranked ? (
					<> · unranked, so the shipped cast reads it as mid</>
				) : (
					<>
						{" "}
						· cost {ranks.cost_rank} · power {ranks.power_rank}
					</>
				)}
			</p>

			{refusal ? (
				// The engine's sentence names the bound — the worlds that cast it —
				// so the remedy is where to go, not a second copy of the reason.
				<CannotAnswerCard label="cannot remove" remedy="Govern › Worlds">
					{refusal}
				</CannotAnswerCard>
			) : null}
		</div>
	);
}

function AddModelForm({
	username,
	graphSlug,
	provider,
	onDone,
}: {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
	onDone: () => void;
}) {
	const [modelId, setModelId] = useState("");
	const add = useAddLLMModelMutation(username, graphSlug);
	const example = LLM_PROVIDER_OPTIONS.find(
		(o) => o.value === provider.provider,
	)?.exampleModelId;

	return (
		<form
			className="flex min-w-0 flex-col gap-2 rounded-md border p-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (!modelId.trim()) return;
				add.mutate(
					{ id: provider.id, data: { model_id: modelId.trim() } },
					{
						onSuccess: (model) => {
							toast.success(`Offering ${model.address}`);
							setModelId("");
							onDone();
						},
						onError: (err) => toast.error(err.message),
					},
				);
			}}
		>
			<Label htmlFor="new_model_id">Model ID</Label>
			<Input
				id="new_model_id"
				placeholder={example}
				value={modelId}
				onChange={(e) => setModelId(e.target.value)}
			/>
			{/* The ranks are derived from the published rate at add (PM17), so the
			    form asks for the one thing only the vendor knows. */}
			<p className="text-sm text-muted-foreground">
				It is ranked from its published rate, and a cast can name it as{" "}
				<span className="font-mono">
					llm/{provider.name}/{modelId.trim() || "…"}
				</span>
				.
			</p>
			<div className="flex justify-end gap-2">
				<Button type="button" size="sm" variant="outline" onClick={onDone}>
					Cancel
				</Button>
				<Button
					type="submit"
					size="sm"
					disabled={!modelId.trim() || add.isPending}
				>
					{add.isPending ? "Adding…" : "Offer"}
				</Button>
			</div>
		</form>
	);
}
