/**
 * One configured endpoint, in a modal over the LLMs page — its fields, its
 * ping, the model versions it offers and who pins each.
 *
 * *As the person who configured this endpoint, I want to see what it offers and
 * who pins each version, so that removing one is a decision rather than a
 * surprise.*
 *
 * **The modal is in the path.** `/agents/llms/<id>` opens it, so a link to an
 * endpoint lands on it and a reload keeps it open; closing it clears the id.
 *
 * **A model is a row under the endpoint, not a second endpoint**: the address
 * `llm/anthropic-prod/claude-opus-5` has a provider segment and a model
 * segment, and one row cannot be both.
 *
 * **The safe case is visibly safe.** A version nothing names says so on its
 * row; stopping one a world casts is refused, and the refusal — which names the
 * worlds — is drawn where the click was, never as a toast that leaves the
 * reader looking for what it meant.
 *
 * **The ping is a fact about this endpoint**, stated in the modal rather than
 * thrown as a toast. The engine keeps no ping history, so the line reads only
 * the ping made here.
 */

import { Input } from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	CannotAnswerCard,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	Eyebrow,
	Spinner,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { useMutation } from "@tanstack/react-query";
import { Check, Plus, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EndpointForm } from "./AddEndpointDialog";
import { llmProvidersApi } from "./api";
import { PinnedBy, type Pinner } from "./pinnedBy";
import {
	useAddLLMModelMutation,
	useDeleteLLMProviderMutation,
	useRemoveLLMModelMutation,
} from "./queries";
import { LLM_PROVIDER_OPTIONS, type LLMModel, type LLMProvider } from "./types";

export interface EndpointDialogProps {
	username: string;
	graphSlug: string;
	/** The endpoint id from the path; null keeps the modal closed. */
	id: string | null;
	/** That endpoint, once the endpoints are read; null while reading or gone. */
	provider: LLMProvider | null;
	loading: boolean;
	/** Who pins or casts one address. */
	pinnersOf: (address: string) => Pinner[];
	onClose: () => void;
}

type Ping =
	| { kind: "untested" }
	| { kind: "testing" }
	| { kind: "passed"; latencyMs?: number }
	| { kind: "failed"; error: string };

export function EndpointDialog({
	username,
	graphSlug,
	id,
	provider,
	loading,
	pinnersOf,
	onClose,
}: EndpointDialogProps) {
	return (
		<Dialog open={!!id} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="font-mono">
						{provider?.name ?? id}
					</DialogTitle>
					<DialogDescription>
						An endpoint — its credential, its ping, the versions it offers
					</DialogDescription>
				</DialogHeader>
				{provider ? (
					<EndpointBody
						// A fresh body per endpoint, so one endpoint's ping never reads as
						// another's.
						key={provider.id}
						username={username}
						graphSlug={graphSlug}
						provider={provider}
						pinnersOf={pinnersOf}
						onClose={onClose}
					/>
				) : loading ? (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Spinner />
						Reading this endpoint…
					</div>
				) : (
					<EmptyState
						title="No such endpoint"
						description="This Graph has no endpoint with that id — it may have been removed."
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function EndpointBody({
	username,
	graphSlug,
	provider,
	pinnersOf,
	onClose,
}: {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
	pinnersOf: (address: string) => Pinner[];
	onClose: () => void;
}) {
	const [ping, setPing] = useState<Ping>({ kind: "untested" });
	const remove = useDeleteLLMProviderMutation(username, graphSlug);

	const pinger = useMutation({
		mutationFn: () => llmProvidersApi.ping(username, graphSlug, provider.id),
		onMutate: () => setPing({ kind: "testing" }),
		onSuccess: (result) =>
			setPing(
				result.ok
					? { kind: "passed", latencyMs: result.latency_ms }
					: {
							kind: "failed",
							// A provider's own error is shown verbatim.
							error: result.error ?? "The provider rejected the credentials.",
						},
			),
		onError: (err: Error) => setPing({ kind: "failed", error: err.message }),
	});

	return (
		<EndpointForm
			username={username}
			graphSlug={graphSlug}
			existing={provider}
			onDone={onClose}
			footer={({ valid, pending }) => (
				<DialogFooter className="sm:justify-between">
					<ActButton
						area="settings"
						type="button"
						variant="ghost"
						disabled={remove.isPending}
						onClick={() =>
							remove.mutate(provider.id, {
								onSuccess: () => {
									toast.success("Endpoint removed");
									onClose();
								},
								onError: (err) => toast.error(err.message),
							})
						}
					>
						Remove endpoint
					</ActButton>
					<div className="flex gap-2">
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<ActButton
							area="settings"
							type="submit"
							disabled={!valid || pending}
						>
							<Check />
							{pending ? "Saving…" : "Save changes"}
						</ActButton>
					</div>
				</DialogFooter>
			)}
		>
			<PingLine ping={ping} onPing={() => pinger.mutate()} />
			<Versions
				username={username}
				graphSlug={graphSlug}
				provider={provider}
				pinnersOf={pinnersOf}
			/>
		</EndpointForm>
	);
}

function PingLine({ ping, onPing }: { ping: Ping; onPing: () => void }) {
	const act = (
		<ActButton
			area="settings"
			type="button"
			size="sm"
			variant="ghost"
			disabled={ping.kind === "testing"}
			onClick={onPing}
		>
			{ping.kind === "testing" ? <Spinner /> : <RotateCw />}
			{ping.kind === "untested" ? "Ping" : "Ping again"}
		</ActButton>
	);
	if (ping.kind === "passed" || ping.kind === "failed") {
		const passed = ping.kind === "passed";
		return (
			<Alert tone={passed ? "success" : "destructive"}>
				<AlertDescription className="flex items-center justify-between gap-2">
					<span className="flex min-w-0 items-start gap-1.5">
						{passed ? (
							<Check className="mt-0.5 size-3.5 shrink-0" />
						) : (
							<X className="mt-0.5 size-3.5 shrink-0" />
						)}
						<span>
							{passed
								? `Ping · ok${ping.latencyMs !== undefined ? ` in ${ping.latencyMs} ms` : ""}`
								: `Ping · ${ping.error}`}
						</span>
					</span>
					{act}
				</AlertDescription>
			</Alert>
		);
	}
	return (
		<div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1">
			<span className="text-muted-foreground">
				{ping.kind === "testing"
					? "Pinging…"
					: "Not pinged — a ping asks the endpoint to answer once"}
			</span>
			{act}
		</div>
	);
}

/** What the shipped cast reads off a version — its two ranks, or that it has none. */
function rankWords(model: LLMModel): string {
	const { cost_rank, power_rank } = model.capabilities;
	return cost_rank == null && power_rank == null
		? "unranked — the shipped cast reads it as mid"
		: `tier ${cost_rank ?? "—"} · power ${power_rank ?? "—"}`;
}

/** The versions this endpoint offers, who pins each, and offering one more. */
function Versions({
	username,
	graphSlug,
	provider,
	pinnersOf,
}: {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
	pinnersOf: (address: string) => Pinner[];
}) {
	/** The refusal from the last stop, held against the version it refused. */
	const [refusedId, setRefusedId] = useState<string | null>(null);
	const removeModel = useRemoveLLMModelMutation(username, graphSlug);

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<Eyebrow>Model versions</Eyebrow>
			{provider.models.length === 0 ? (
				// A sentence, never an empty table: an endpoint offering nothing is a
				// real state, and it is the one that makes a run refuse.
				<p className="text-muted-foreground">
					This endpoint offers no version, so nothing resolves to it. Offer one
					and a cast can name it.
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Model version</TableHead>
							<TableHead>Pinned by</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>
								<span className="sr-only">Acts</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{provider.models.map((model) => {
							const pinners = pinnersOf(model.address);
							const offered = model.status === "active";
							const refusal =
								refusedId === model.id && removeModel.error
									? removeModel.error.message
									: null;
							return (
								<TableRow key={model.id}>
									<TableCell className="whitespace-nowrap">
										<span className="block font-mono">{model.model_id}</span>
										<span className="text-sm text-muted-foreground">
											{rankWords(model)}
										</span>
									</TableCell>
									<TableCell className="w-full">
										{pinners.length ? (
											<PinnedBy pinners={pinners} />
										) : (
											// The safe case, visibly safe.
											<span className="text-muted-foreground">
												named by nothing — safe to stop
											</span>
										)}
										{refusal ? (
											// The engine's sentence names the bound — the worlds
											// that cast it — so the remedy is where to go.
											<CannotAnswerCard
												label="cannot stop offering"
												remedy="Govern › Worlds"
											>
												{refusal}
											</CannotAnswerCard>
										) : null}
									</TableCell>
									<TableCell className="whitespace-nowrap">
										<span className="flex items-center gap-1.5">
											<StatusDot tone={offered ? "success" : "muted"} />
											{offered ? "offered" : "not offered"}
										</span>
									</TableCell>
									<TableCell className="whitespace-nowrap text-right">
										{offered ? (
											<ActButton
												area="settings"
												type="button"
												size="sm"
												variant="ghost"
												disabled={
													removeModel.isPending &&
													removeModel.variables?.modelRowId === model.id
												}
												onClick={() => {
													// Cleared first, so the card under this row is this
													// click's refusal and never the last one's.
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
											>
												Stop offering
											</ActButton>
										) : null}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}
			<OfferVersion
				username={username}
				graphSlug={graphSlug}
				provider={provider}
			/>
		</div>
	);
}

/**
 * One more version on this endpoint. It sits inside the endpoint's form, so
 * Enter offers the version rather than saving the form.
 */
function OfferVersion({
	username,
	graphSlug,
	provider,
}: {
	username: string;
	graphSlug: string;
	provider: LLMProvider;
}) {
	const [modelId, setModelId] = useState("");
	const add = useAddLLMModelMutation(username, graphSlug);
	const example = LLM_PROVIDER_OPTIONS.find(
		(o) => o.value === provider.provider,
	)?.exampleModelId;

	const offer = () => {
		const value = modelId.trim();
		if (!value) return;
		add.mutate(
			{ id: provider.id, data: { model_id: value } },
			{
				onSuccess: (model) => {
					toast.success(`Offering ${model.address}`);
					setModelId("");
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<Input
					aria-label="Model version to offer"
					className="max-w-xs font-mono"
					placeholder={example}
					value={modelId}
					onChange={(e) => setModelId(e.target.value)}
					onKeyDown={(e) => {
						if (e.key !== "Enter") return;
						e.preventDefault();
						offer();
					}}
				/>
				<ActButton
					area="settings"
					type="button"
					size="sm"
					variant="outline"
					disabled={!modelId.trim() || add.isPending}
					onClick={offer}
				>
					<Plus />
					{add.isPending ? "Offering…" : "Offer"}
				</ActButton>
			</div>
			{/* The ranks are derived from the published rate at add, so the form
			    asks for the one thing only the vendor knows. */}
			<p className="text-sm text-muted-foreground">
				A version this endpoint serves — ranked from its published rate, and
				named as{" "}
				<span className="font-mono">
					llm/{provider.name}/{modelId.trim() || "…"}
				</span>
			</p>
		</div>
	);
}
