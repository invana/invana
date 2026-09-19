/**
 * Declare a stitch — one card, both kinds, the count before the fact.
 *
 * This is the artboard *Declaring* (the-screens.md T5, T9, T10) as a component.
 * Four things about it are the design, not decoration:
 *
 * - **One title, two kinds.** The card says *Declare a stitch* and the kind is a
 *   segmented control inside it (ST11). Naming the kind before the card opens
 *   makes a person choose between two words for the same act; naming it inside
 *   lets them change their mind after seeing the two types side by side.
 * - **A key on each side** (ST26). `Company.ticker = Stock.nse_symbol` is the
 *   ordinary stitch, not the exotic one — the two models were authored apart.
 * - **The count comes back before the stitch exists.** As soon as both keys are
 *   named the preview fires; a rule that matches nothing says the rule is wrong,
 *   not the data, and there is nothing to undo because nothing happened.
 * - **A relationship's endpoints are keys *or* a dataset** (ST27). The choice is
 *   a segmented control and the other side goes dark, because one edge type with
 *   two sources of truth has no rule for which wins.
 *
 * It stages (ST21). The button says so — *Stage this stitch* — because the union
 * is unchanged until somebody commits, and a button that said *Declare* would be
 * promising a change that has not happened.
 */

import {
	useDeclareLinkMutation,
	useModelsQuery,
	usePreviewStitchMutation,
} from "@/hooks/queries/useModels";
import { ApiError } from "@/services/api/client";
import { modelsApi } from "@/services/api/models";
import type {
	AlreadyStitched,
	EndpointSource,
	IdentityMatch,
	LinkKind,
	StitchPreview,
} from "@/types/models";
import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	Button,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
	cn,
} from "@invana/ui";
import { useQueries } from "@tanstack/react-query";
import { HelpCircle, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** One node type on one published version — what either side of a stitch names. */
interface TypeOption {
	/** `${versionId}::${typeName}` — the key both callers pass in. */
	key: string;
	label: string;
	model: string;
	versionId: string;
	type: string;
	/** Every property the type carries, inherited ones included. */
	properties: string[];
}

interface Props {
	username: string;
	graphSlug: string;
	/** Which kind the card opens on. It is the reader's from then on (ST11). */
	initialKind?: LinkKind;
	/** The side the gesture already named, as `${versionId}::${typeName}` (ST19). */
	sourceKey?: string;
	/** The other side, when the drag named it too. */
	targetKey?: string;
	onClose: () => void;
	/** "Open the existing stitch" on the already-stitched refusal. */
	onOpenStitch?: (linkId: string) => void;
	className?: string;
}

const num = (n: number) => n.toLocaleString();

export function DeclareStitchPanel({
	username,
	graphSlug,
	initialKind = "anchor",
	sourceKey: presetSource,
	targetKey: presetTarget,
	onClose,
	onOpenStitch,
	className,
}: Props) {
	const [kind, setKind] = useState<LinkKind>(initialKind);
	const [sourceKey, setSourceKey] = useState(presetSource ?? "");
	const [targetKey, setTargetKey] = useState(presetTarget ?? "");
	const [sourceProperty, setSourceProperty] = useState("");
	const [targetProperty, setTargetProperty] = useState("");
	const [match, setMatch] = useState<IdentityMatch>("exact");
	const [edgeType, setEdgeType] = useState("");
	const [endpoints, setEndpoints] = useState<EndpointSource>("keys");
	const [sourceModelId, setSourceModelId] = useState("");
	const [preview, setPreview] = useState<StitchPreview | null>(null);
	const [showUnresolved, setShowUnresolved] = useState(false);
	// The refusal that names what it refused — its own card, under this one.
	const [alreadyStitched, setAlreadyStitched] =
		useState<AlreadyStitched | null>(null);

	const models = useModelsQuery(username, graphSlug);
	// Only published versions are offered — a draft has nothing immutable to
	// bind (ST8), so it is absent from the pickers rather than refused by them.
	const published = useMemo(
		() =>
			(models.data ?? []).filter(
				(m) => m.origin !== "introspected" && m.active_version,
			),
		[models.data],
	);

	const versions = useQueries({
		queries: published.map((model) => ({
			queryKey: ["models", username, graphSlug, model.id, "active-version"],
			queryFn: () => modelsApi.getActiveVersion(username, graphSlug, model.id),
		})),
		// `useQueries` hands back a new array every render; combining keeps the
		// result structurally shared, so the options below do not churn (ST31).
		combine: (results) => results.map((r) => r.data),
	});

	const options = useMemo(() => {
		const out: TypeOption[] = [];
		published.forEach((model, i) => {
			const version = versions[i];
			if (!version) return;
			for (const nt of version.node_types ?? []) {
				const mappings = nt.effective_property_mappings?.length
					? nt.effective_property_mappings
					: nt.property_mappings;
				out.push({
					key: `${version.id}::${nt.name}`,
					label: `${model.name}.${nt.name}`,
					model: model.name,
					versionId: version.id,
					type: nt.name,
					properties: (mappings ?? []).map((m) => m.property_key.name),
				});
			}
		});
		return out;
	}, [published, versions]);

	const source = options.find((o) => o.key === sourceKey) ?? null;
	const target = options.find((o) => o.key === targetKey) ?? null;

	const declare = useDeclareLinkMutation(username, graphSlug);
	const runPreview = usePreviewStitchMutation(username, graphSlug);

	// Keys are read on an anchor always, and on a relationship only while the
	// endpoints come from them (ST27).
	const usesKeys = kind === "anchor" || endpoints === "keys";
	const rule =
		usesKeys && source && target && sourceProperty && targetProperty
			? `${source.type}.${sourceProperty}|${target.type}.${targetProperty}|${match}`
			: null;

	/**
	 * The count, fired as soon as the rule is complete — before the stitch
	 * exists, never after. Behind a button it is a count nobody asks for.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: `rule` is the signature of every value read below — re-firing on each of them separately would run the same count twice
	useEffect(() => {
		setPreview(null);
		setShowUnresolved(false);
		if (!rule || !source || !target) return;
		let live = true;
		const timer = setTimeout(() => {
			runPreview.mutate(
				{
					source_type: source.type,
					source_property: sourceProperty,
					target_type: target.type,
					target_property: targetProperty,
					identity_match: match,
				},
				{ onSuccess: (result) => live && setPreview(result) },
			);
		}, 250);
		return () => {
			live = false;
			clearTimeout(timer);
		};
		// `runPreview` is a stable mutation object; the rule is what changes.
	}, [rule]);

	// Judged, and found wrong. A count of zero against *no rows* is not a verdict
	// on the rule — it is a graph waiting for data, which is the ordinary state
	// of a model on the day it is authored.
	const ruleIsWrong = !!preview && preview.countable && preview.resolved === 0;

	const sourceModel = published.find((m) => m.id === sourceModelId) ?? null;

	const ready =
		!!source &&
		!!target &&
		(kind === "relationship" ? edgeType.trim().length > 0 : true) &&
		(usesKeys
			? !!sourceProperty && !!targetProperty && !ruleIsWrong
			: !!sourceModelId);

	const stage = () => {
		if (!source || !target) return;
		setAlreadyStitched(null);
		declare.mutate(
			{
				kind,
				source_version_id: source.versionId,
				source_type: source.type,
				target_version_id: target.versionId,
				target_type: target.type,
				source_property: usesKeys ? sourceProperty : null,
				target_property: usesKeys ? targetProperty : null,
				identity_match: match,
				edge_type: kind === "relationship" ? edgeType.trim() : null,
				source_model_id:
					kind === "relationship" && !usesKeys ? sourceModelId : null,
			},
			{
				onSuccess: onClose,
				onError: (error) => {
					const detail = error instanceof ApiError ? error.detail : undefined;
					if (
						detail &&
						typeof detail === "object" &&
						(detail as { error?: string }).error === "link_already_declared"
					) {
						setAlreadyStitched(detail as AlreadyStitched);
					}
				},
			},
		);
	};

	if (models.isLoading) {
		return (
			<Card className={className}>
				<div className="flex justify-center p-4">
					<Spinner />
				</div>
			</Card>
		);
	}

	if (options.length < 2) {
		return (
			<Card className={className}>
				<CardHeader />
				<div className="px-2.5 py-2 text-meta text-muted-foreground">
					A stitch binds two <span className="text-foreground">published</span>{" "}
					versions. Publish at least two models first — a draft has nothing
					immutable to bind.
				</div>
				<CardFooter>
					<Button size="xs" variant="ghost" onClick={onClose}>
						Close
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		<div className={cn("flex w-[292px] flex-col gap-3", className)}>
			<Card>
				<CardHeader />

				<div className="flex flex-col gap-2 p-2.5 text-meta">
					{/* One card, two kinds (ST11). */}
					<Tabs
						size="sm"
						value={kind}
						onValueChange={(v) => {
							setKind(v as LinkKind);
							setPreview(null);
						}}
					>
						<TabsList className="w-full rounded-control border">
							<TabsTrigger value="anchor" className="flex-1">
								Anchor — same entity
							</TabsTrigger>
							<TabsTrigger value="relationship" className="flex-1">
								Relationship
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<SideRow
						label="Source"
						option={source}
						preset={!!presetSource}
						options={options}
						value={sourceKey}
						onChange={(v) => {
							setSourceKey(v);
							setSourceProperty("");
						}}
					/>
					{kind === "anchor" && source ? (
						<KeyRow
							type={source.type}
							properties={source.properties}
							value={sourceProperty}
							onChange={setSourceProperty}
							wrong={ruleIsWrong}
						/>
					) : null}

					<SideRow
						label="Target"
						option={target}
						preset={!!presetTarget}
						options={options}
						value={targetKey}
						onChange={(v) => {
							setTargetKey(v);
							setTargetProperty("");
						}}
					/>
					{kind === "anchor" && target ? (
						<KeyRow
							type={target.type}
							properties={target.properties}
							value={targetProperty}
							onChange={setTargetProperty}
							wrong={ruleIsWrong}
						/>
					) : null}

					{kind === "anchor" ? (
						<Row label="Match">
							<Select
								value={match}
								onValueChange={(v) => setMatch(v as IdentityMatch)}
							>
								<SelectTrigger triggerSize="sm" className="text-meta">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="exact">exact</SelectItem>
									<SelectItem value="case_insensitive">
										case insensitive
									</SelectItem>
								</SelectContent>
							</Select>
						</Row>
					) : (
						<>
							<Row label="Edge">
								<Input
									inputSize="sm"
									className="font-mono text-meta"
									value={edgeType}
									onChange={(e: { target: { value: string } }) =>
										setEdgeType(e.target.value.toUpperCase())
									}
									placeholder="COVERS"
								/>
							</Row>

							<div className="pt-0.5 font-medium text-foreground">
								Endpoints
							</div>
							{/* Keys or a source model, never both (ST27). */}
							<Tabs
								size="sm"
								value={endpoints}
								onValueChange={(v) => {
									setEndpoints(v as EndpointSource);
									setPreview(null);
								}}
							>
								<TabsList className="w-full rounded-control border">
									<TabsTrigger value="keys" className="flex-1">
										These keys
									</TabsTrigger>
									<TabsTrigger value="records" className="flex-1">
										Its own rows
									</TabsTrigger>
								</TabsList>
							</Tabs>

							{endpoints === "keys" ? (
								<>
									{source ? (
										<KeyRow
											type={source.type}
											properties={source.properties}
											value={sourceProperty}
											onChange={setSourceProperty}
											wrong={ruleIsWrong}
										/>
									) : null}
									{target ? (
										<KeyRow
											type={target.type}
											properties={target.properties}
											value={targetProperty}
											onChange={setTargetProperty}
											wrong={ruleIsWrong}
										/>
									) : null}
								</>
							) : (
								<Row label="Rows ship with">
									<Select
										value={sourceModelId}
										onValueChange={setSourceModelId}
									>
										<SelectTrigger triggerSize="sm" className="text-meta">
											<SelectValue placeholder="Pick a model" />
										</SelectTrigger>
										<SelectContent>
											{published.map((m) => (
												<SelectItem key={m.id} value={m.id}>
													{m.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Row>
							)}
						</>
					)}

					{usesKeys ? (
						<PreviewBox
							preview={preview}
							wrong={ruleIsWrong}
							pending={runPreview.isPending}
							ready={!!rule}
							sample={showUnresolved}
							onShowSample={() => setShowUnresolved(true)}
						/>
					) : sourceModelId ? (
						<div className="border border-border bg-muted/40 p-2">
							<div className="font-semibold text-foreground">
								{`${sourceModel?.name} ships the ${edgeType || "edge"} rows`}
							</div>
							<p className="mt-0.5 text-muted-foreground">
								Each row names both ends. A row whose endpoint is missing is
								rejected at import with both endpoints named — it is never
								written half-attached.
							</p>
						</div>
					) : null}

					{/* The footnotes are the design's, and each says what does *not*
					    happen — the half people get wrong. */}
					{kind === "anchor" ? (
						<>
							<p className="text-muted-foreground">
								Both nodes stay. An anchor links; it never merges.
							</p>
							<p className="text-muted-foreground">
								Only <span className="text-foreground">published</span> versions
								are offered — a draft has nothing immutable to bind.
							</p>
						</>
					) : endpoints === "keys" ? (
						<p className="text-muted-foreground">
							The edge is implied by{" "}
							<span className="text-foreground">
								a key the records already carry
							</span>
							. Nothing is imported and no dataset is bound — the endpoints are
							read from the two properties you just named.
						</p>
					) : (
						<>
							<p className="text-muted-foreground">
								The keys are off while a dataset supplies the endpoints. One
								edge type, one source of truth.
							</p>
							<p className="text-muted-foreground">
								Use this when the edge is its own fact — one row per edge,
								decided when the record was written, not derivable from either
								side.
							</p>
						</>
					)}
				</div>

				<CardFooter>
					<Button
						size="xs"
						disabled={!ready || declare.isPending}
						onClick={stage}
					>
						<Link2 />
						Stage this stitch
					</Button>
					<Button size="xs" variant="ghost" onClick={onClose}>
						{ruleIsWrong ? "Try another key" : "Cancel"}
					</Button>
				</CardFooter>
			</Card>

			{alreadyStitched ? (
				<AlreadyStitchedCard
					refusal={alreadyStitched}
					onOpen={onOpenStitch}
					onDismiss={() => setAlreadyStitched(null)}
				/>
			) : null}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// The card's own chrome
// ─────────────────────────────────────────────────────────────────────────────

function Card({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("w-[292px] border bg-card shadow-lg", className)}>
			{children}
		</div>
	);
}

function CardHeader() {
	return (
		<div className="flex items-center gap-1.5 border-b px-2.5 py-2">
			<span className="font-medium text-sm">Declare a stitch</span>
			<span className="flex-1" />
			<Badge variant="outline" size="xs">
				preview
			</Badge>
		</div>
	);
}

function CardFooter({ children }: { children?: React.ReactNode }) {
	return <div className="flex gap-1.5 border-t px-2.5 py-2">{children}</div>;
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-16 shrink-0 text-muted-foreground">{label}</span>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}

/**
 * One side of the stitch.
 *
 * Pre-filled from the gesture it reads as a fact, not a field: the drag already
 * answered this, and re-asking it from an empty dropdown is asking someone to
 * re-answer a question they just answered (ST19).
 */
function SideRow({
	label,
	option,
	preset,
	options,
	value,
	onChange,
}: {
	label: string;
	option: TypeOption | null;
	preset: boolean;
	options: TypeOption[];
	value: string;
	onChange: (value: string) => void;
}) {
	if (preset && option) {
		return (
			<div className="flex items-center gap-2">
				<span className="w-16 shrink-0 text-muted-foreground">{label}</span>
				<span className="truncate font-mono text-meta">{option.label}</span>
			</div>
		);
	}
	return (
		<Row label={label}>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger triggerSize="sm" className="font-mono text-meta">
					<SelectValue placeholder="Pick a published type" />
				</SelectTrigger>
				<SelectContent>
					{options.map((o) => (
						<SelectItem key={o.key} value={o.key}>
							{o.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Row>
	);
}

/** The key on one side, labelled with the type that carries it (ST26). */
function KeyRow({
	type,
	properties,
	value,
	onChange,
	wrong,
}: {
	type: string;
	properties: string[];
	value: string;
	onChange: (value: string) => void;
	/** The rule resolved nothing — the guilty field is marked, not the data. */
	wrong?: boolean;
}) {
	// A type with no properties has no key to offer, and an empty dropdown is a
	// dead end that says nothing. Name the side and what it lacks (Seams).
	if (properties.length === 0) {
		return (
			<div className="flex items-center gap-2 pl-2.5">
				<span className="w-[62px] shrink-0 truncate text-muted-foreground">
					{type}
				</span>
				<span className="min-w-0 flex-1 text-destructive">
					carries no properties — nothing to match on
				</span>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-2 pl-2.5">
			<span className="w-[62px] shrink-0 truncate text-muted-foreground">
				{type}
			</span>
			<div className="min-w-0 flex-1">
				<Select value={value} onValueChange={onChange}>
					<SelectTrigger
						triggerSize="sm"
						className={cn(
							"font-mono text-meta",
							wrong && value && "border-destructive",
						)}
					>
						<SelectValue placeholder="Pick a key" />
					</SelectTrigger>
					<SelectContent>
						{properties.map((p) => (
							<SelectItem key={p} value={p}>
								{p}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

/**
 * How many resolve, and what does not.
 *
 * Zero is not an error — it is a verdict about the rule, and it is reached
 * before anything is declared, which is the whole point of counting here.
 */
function PreviewBox({
	preview,
	wrong,
	pending,
	ready,
	sample,
	onShowSample,
}: {
	preview: StitchPreview | null;
	/** The rule was judged against real rows and matched none of them. */
	wrong: boolean;
	pending: boolean;
	ready: boolean;
	sample: boolean;
	onShowSample: () => void;
}) {
	if (!ready) {
		return (
			<p className="text-muted-foreground">
				Name a key on each side and the count comes back before the stitch
				exists.
			</p>
		);
	}
	if (!preview) {
		return (
			<div className="flex items-center gap-2 border border-border p-2 text-muted-foreground">
				{pending ? <Spinner className="size-3" /> : null}
				Counting what resolves…
			</div>
		);
	}
	// Three states, and the middle one is the one that is easy to get wrong: no
	// rows on a side is not a failed rule, so it does not read as one.
	const tone = wrong
		? "border-destructive/35 bg-destructive/10"
		: preview.countable
			? "border-success/35 bg-success/10"
			: "border-border bg-muted/40";
	const ink = wrong
		? "text-destructive"
		: preview.countable
			? "text-success"
			: "text-foreground";
	return (
		<div className={cn("border p-2", tone)}>
			<div className={cn("font-semibold", ink)}>
				{preview.countable
					? `${num(preview.resolved)} of ${num(preview.source_total)} resolve`
					: "No records to count"}
			</div>
			<p className="mt-0.5 text-muted-foreground">{preview.verdict}</p>
			{preview.countable &&
			preview.resolved > 0 &&
			preview.unresolved_sample.length > 0 ? (
				sample ? (
					<div className="mt-1.5 max-h-24 overflow-y-auto font-mono text-muted-foreground">
						{preview.unresolved_sample.map((v) => (
							<div key={v} className="truncate">
								{v}
							</div>
						))}
					</div>
				) : (
					<button
						type="button"
						className="mt-1.5 text-primary hover:underline"
						onClick={onShowSample}
					>
						Show the {num(preview.unresolved_source)}
					</button>
				)
			) : null}
		</div>
	);
}

/**
 * Refused, and told which stitch already holds the pair.
 *
 * A pair is anchored once. The card names the rule the existing stitch carries
 * so the reader changes *that* one, rather than being told no and left to find
 * it (the *Refused* artboard, T6).
 */
function AlreadyStitchedCard({
	refusal,
	onOpen,
	onDismiss,
}: {
	refusal: AlreadyStitched;
	onOpen?: (linkId: string) => void;
	onDismiss: () => void;
}) {
	const pair = `${refusal.source_type} ${
		refusal.kind === "anchor" ? "≡" : `-[${refusal.edge_type}]->`
	} ${refusal.target_type}`;
	const rule =
		refusal.source_property && refusal.target_property
			? `${refusal.source_type}.${refusal.source_property} = ${refusal.target_type}.${refusal.target_property}`
			: null;
	return (
		<div className="w-[292px] border border-destructive bg-card shadow-lg">
			<div className="flex items-center gap-1.5 border-b px-2.5 py-2">
				<HelpCircle className="size-3.5 text-destructive" />
				<span className="font-medium text-sm">Refused — already stitched</span>
			</div>
			<div className="flex flex-col gap-1.5 px-2.5 py-2 text-meta">
				<div>
					<span className="font-mono">{pair}</span> is already declared
					{rule ? (
						<>
							, on <span className="font-mono">{rule}</span>
						</>
					) : null}
					.
				</div>
				<p className="text-muted-foreground">
					A pair is anchored once. Change the existing stitch rather than
					declaring a second one that disagrees with it.
				</p>
			</div>
			<div className="flex gap-1.5 border-t px-2.5 py-2">
				{onOpen ? (
					<Button
						size="xs"
						variant="outline"
						onClick={() => onOpen(refusal.link_id)}
					>
						Open the existing stitch
					</Button>
				) : null}
				<Button size="xs" variant="ghost" onClick={onDismiss}>
					Dismiss
				</Button>
			</div>
		</div>
	);
}
