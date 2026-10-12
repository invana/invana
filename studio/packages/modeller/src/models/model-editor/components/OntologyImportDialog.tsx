/**
 * Start a model from an ontology — schema.org, RDFS or OWL (ontology-import.md).
 *
 * Two steps in one dialog:
 *
 * 1. **Pick** — read the document (a preset, a URL or a file; the browser
 *    reads it, the engine never fetches), then pick the classes you need from
 *    an all-classes preview. None picked imports every class. Types a picked
 *    one points at come with it — the engine decides which, and the preview
 *    says so.
 * 2. **Preview** — the dry run with those picks: what each source construct
 *    becomes (node type, edge type, stitch suggestion) and what was skipped and
 *    why. *Open as a draft* writes the model; nothing publishes until a person
 *    reviews the draft.
 *
 * The document's text lives only in this dialog's memory — nothing survives a
 * reload. *Back* returns to the picks, kept.
 *
 * The seams the dialog states rather than swallows:
 *
 * - **Above 500 classes the engine will not list them**, so the picker turns
 *   into a field where the types are named by hand.
 * - **A name already in use is named**, beside the name field — never merged.
 * - **A type this database cannot hold** still lands in the draft; the dialog
 *   says it cannot publish here until the database can hold it.
 *
 * ```tsx
 * <OntologyImportDialog open username={u} graphSlug={g}
 *   onClose={close} onImported={(modelId) => openModel(modelId)} />
 * ```
 */

import { Checkbox, Input, Label } from "@invana/forms";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	SearchInput,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	ApiError,
	fetchRdfText,
	type RdfSource,
	readRdfFile,
	SCHEMA_ORG_URL,
} from "@invana-studio/core";
import { FormError, RdfSourceField } from "@invana-studio/ui";
import { useId, useMemo, useState } from "react";
import {
	useImportOntologyMutation,
	usePreviewOntologyMutation,
} from "../../queries";
import {
	mappingRows,
	matchesSearch,
	namespaceLabel,
	parseTypeNames,
	pickerRows,
	previewDescription,
	summaryCounts,
} from "./ontologyPreview";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	onClose: () => void;
	onImported: (modelId: string) => void;
}

const PRESETS = [
	{ value: "schema.org", label: "schema.org", url: SCHEMA_ORG_URL },
];

/** The engine's refusal of an all-classes import above its class cap. */
const TOO_MANY = /node types, over \d+/;

export function OntologyImportDialog({
	open,
	username,
	graphSlug,
	onClose,
	onImported,
}: Props) {
	const id = useId();
	const [source, setSource] = useState<RdfSource | null>(null);
	const [reading, setReading] = useState(false);
	const [readError, setReadError] = useState<string | null>(null);
	const [step, setStep] = useState<"pick" | "preview">("pick");
	const [picked, setPicked] = useState<string[]>([]);
	const [search, setSearch] = useState("");
	const [manual, setManual] = useState(false);
	const [typed, setTyped] = useState("");
	const [name, setName] = useState("");

	const catalogue = usePreviewOntologyMutation(username, graphSlug);
	const preview = usePreviewOntologyMutation(username, graphSlug);
	const importer = useImportOntologyMutation(username, graphSlug);

	const read = async (load: () => Promise<RdfSource>) => {
		setReading(true);
		setReadError(null);
		catalogue.reset();
		preview.reset();
		importer.reset();
		setPicked([]);
		setManual(false);
		setTyped("");
		setSearch("");
		try {
			const next = await load();
			setSource(next);
			catalogue.mutate(
				{ content: next.text },
				{
					onError: (err) => {
						if (err instanceof ApiError && TOO_MANY.test(err.message))
							setManual(true);
					},
				},
			);
		} catch (err) {
			setSource(null);
			setReadError(err instanceof Error ? err.message : String(err));
		} finally {
			setReading(false);
		}
	};

	const rows = useMemo(
		() => (catalogue.data ? pickerRows(catalogue.data.report) : []),
		[catalogue.data],
	);
	const shown = useMemo(
		() => rows.filter((r) => matchesSearch(r, search)),
		[rows, search],
	);
	const label =
		source?.label === SCHEMA_ORG_URL ? "schema.org" : (source?.label ?? "");
	const types = manual ? parseTypeNames(typed) : picked;

	const runPreview = () => {
		if (!source) return;
		importer.reset();
		preview.mutate(
			{ content: source.text, types: types.length ? types : undefined },
			{
				onSuccess: (result) => {
					setName(result.draft.schema_name);
					setStep("preview");
				},
			},
		);
	};

	const runImport = () => {
		if (!source) return;
		importer.mutate(
			{
				content: source.text,
				types: types.length ? types : undefined,
				name: name.trim() || undefined,
			},
			{
				onSuccess: (result) => {
					if (result.model) onImported(result.model.id);
				},
			},
		);
	};

	const refusal =
		importer.error instanceof ApiError
			? (importer.error.detail as { error?: string; name?: string } | undefined)
			: undefined;
	const nameTaken =
		refusal?.error === "model_name_taken"
			? (refusal.name ?? name.trim())
			: null;

	const toggle = (typeName: string, on: boolean) =>
		setPicked((prev) =>
			on ? [...prev, typeName] : prev.filter((p) => p !== typeName),
		);

	const canPreview =
		!!source &&
		!preview.isPending &&
		!catalogue.isPending &&
		(manual ? types.length > 0 : !!catalogue.data);

	const result = step === "preview" ? preview.data : undefined;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent className="max-w-3xl">
				{result ? (
					<PreviewStep
						id={id}
						label={label}
						picked={types}
						result={result}
						name={name}
						onName={setName}
						nameTaken={nameTaken}
						error={nameTaken !== null ? null : importer.error}
					/>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>New model from an ontology</DialogTitle>
							<DialogDescription>
								{catalogue.data
									? `${label} · ${rows.length} types`
									: "RDFS or OWL — schema.org included. It lands as a draft."}
							</DialogDescription>
						</DialogHeader>

						<div className="flex min-w-0 flex-col gap-4">
							<RdfSourceField
								presets={PRESETS}
								hint="RDFS / OWL in JSON-LD, Turtle or RDF/XML"
								placeholder="https://…/ontology.ttl"
								busy={reading || catalogue.isPending}
								loaded={source?.label}
								onReadUrl={(url) => void read(() => fetchRdfText(url))}
								onReadFile={(file) => void read(() => readRdfFile(file))}
							/>
							<FormError error={readError} />
							{manual ? null : <FormError error={catalogue.error} />}

							{manual ? (
								<div className="flex flex-col gap-1.5">
									<Label htmlFor={`${id}-types`}>Types</Label>
									<Input
										id={`${id}-types`}
										value={typed}
										onChange={(e: { target: { value: string } }) =>
											setTyped(e.target.value)
										}
										placeholder="Person, Organization, Product"
									/>
									<span className="text-sm text-muted-foreground">
										This ontology has more classes than the picker lists — name
										the types you need by name, label or IRI. Types they depend
										on come with them.
									</span>
								</div>
							) : catalogue.data ? (
								<div className="flex min-w-0 flex-col gap-1.5">
									<div className="flex items-center justify-between gap-2">
										<Label>Pick the types you need</Label>
										<SearchInput
											inputSize="sm"
											className="max-w-60"
											value={search}
											onChange={setSearch}
											placeholder="Search types…"
										/>
									</div>
									<div className="max-h-80 overflow-auto rounded-md border">
										<Table density="compact">
											<TableHeader>
												<TableRow>
													<TableHead className="w-8" />
													<TableHead>Type</TableHead>
													<TableHead>From</TableHead>
													<TableHead>Properties</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{shown.map((t) => (
													<TableRow key={t.name}>
														<TableCell>
															<Checkbox
																aria-label={`Pick ${t.name}`}
																checked={picked.includes(t.name)}
																onCheckedChange={(on) =>
																	toggle(t.name, on === true)
																}
															/>
														</TableCell>
														<TableCell className="font-mono">
															{t.name}
														</TableCell>
														<TableCell className="text-muted-foreground">
															{namespaceLabel(t.iri)}
														</TableCell>
														<TableCell>{t.properties.length}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
									<span className="text-sm text-muted-foreground">
										{picked.length
											? `${picked.length} picked · types they depend on come with them`
											: `None picked — all ${rows.length} types import`}
									</span>
								</div>
							) : catalogue.isPending ? (
								<Spinner />
							) : null}

							<FormError error={preview.error} />
						</div>
					</>
				)}

				<DialogFooter>
					{result ? (
						<>
							<Button
								variant="ghost"
								onClick={() => {
									importer.reset();
									setStep("pick");
								}}
							>
								Back
							</Button>
							<Button
								disabled={importer.isPending || !name.trim()}
								onClick={runImport}
							>
								{importer.isPending ? "Opening…" : "Open as a draft"}
							</Button>
						</>
					) : (
						<>
							<Button variant="ghost" onClick={onClose}>
								Cancel
							</Button>
							<Button disabled={!canPreview} onClick={runPreview}>
								{preview.isPending ? "Previewing…" : "Preview"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PreviewStep({
	id,
	label,
	picked,
	result,
	name,
	onName,
	nameTaken,
	error,
}: {
	id: string;
	label: string;
	picked: string[];
	result: NonNullable<ReturnType<typeof usePreviewOntologyMutation>["data"]>;
	name: string;
	onName: (name: string) => void;
	nameTaken: string | null;
	error: Error | null;
}) {
	const { report } = result;
	const counts = summaryCounts(report);
	const mapping = mappingRows(result);
	const unsupported = result.unsupported_property_types;

	return (
		<>
			<DialogHeader>
				<DialogTitle>Import preview</DialogTitle>
				<DialogDescription>
					{label} · {previewDescription(picked, report)}
				</DialogDescription>
			</DialogHeader>

			<div className="flex min-w-0 flex-col gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="soft" tone="primary">
						{counts.types}
					</Badge>
					{counts.skipped > 0 ? (
						<Badge variant="soft" tone="warning">
							{counts.skipped} skipped
						</Badge>
					) : null}
				</div>

				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>Mapping — source → Invana</Label>
					<div className="max-h-80 overflow-auto rounded-md border">
						<Table density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Source</TableHead>
									<TableHead>Becomes</TableHead>
									<TableHead>Note</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{mapping.map((row) => (
									<TableRow key={row.key}>
										<TableCell className="font-mono">{row.source}</TableCell>
										<TableCell className="whitespace-nowrap">
											{row.kind === "skipped" ? (
												<Badge variant="soft" tone="warning">
													skipped
												</Badge>
											) : row.kind === "stitch" ? (
												"stitch suggestion"
											) : (
												<>
													{row.kind === "node" ? "node type " : "edge type "}
													<span className="font-mono">{row.name}</span>
												</>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{row.note}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					{counts.moreSkipped > 0 ? (
						<span className="text-sm text-muted-foreground">
							and {counts.moreSkipped} more skipped
						</span>
					) : null}
					{report.notes.map((n) => (
						<span
							key={`${n.kind}:${n.subject}:${n.message}`}
							className="text-sm text-muted-foreground"
						>
							{n.subject}: {n.message}
						</span>
					))}
					{counts.moreNotes > 0 ? (
						<span className="text-sm text-muted-foreground">
							and {counts.moreNotes} more notes
						</span>
					) : null}
				</div>

				<span className="text-sm text-muted-foreground">
					Every type keeps its source IRI, so the model can be exported back
					later. Nothing is published until you review the draft.
				</span>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${id}-name`}>Call it</Label>
					<Input
						id={`${id}-name`}
						value={name}
						onChange={(e: { target: { value: string } }) =>
							onName(e.target.value)
						}
						placeholder={result.draft.schema_name}
					/>
					{nameTaken !== null ? (
						<span role="alert" className="text-sm text-destructive">
							A model named {nameTaken} is already in this Graph — call this one
							something else.
						</span>
					) : null}
				</div>

				{unsupported.length ? (
					<span className="text-warning">
						It lands as a draft, but cannot publish here until this database can
						hold{" "}
						{unsupported.map((u) => `${u.property_key} (${u.type})`).join(", ")}
						.
					</span>
				) : null}

				<FormError error={error} />
			</div>
		</>
	);
}
