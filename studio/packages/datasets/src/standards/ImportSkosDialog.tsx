/**
 * **Import a standard from a SKOS vocabulary** (board `datasets.standards.import`,
 * DS-15): a published concept scheme becomes a standard without retyping.
 *
 * The browser reads the vocabulary — a file the curator chose or a URL it
 * fetches itself; the engine never fetches. Each read runs the preview, which
 * is the import with nothing written: what was found, how SKOS maps onto a
 * standard, the terms it would publish and what it skipped. A file with
 * several concept schemes is refused with their IRIs, and choosing one re-runs
 * the preview. *Import as a standard* creates the standard or mints its next
 * version; identical terms write nothing. Either way the page opens it.
 *
 * ```tsx
 * <ImportSkosDialog open onClose={close} onImported={(r) => open(r.address)} />
 * ```
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { fetchRdfText, type RdfSource, readRdfFile } from "@invana-studio/core";
import { FormError, RdfSourceField } from "@invana-studio/ui";
import { useState } from "react";
import { toast } from "sonner";
import { useImportSkos, usePreviewSkos } from "../queries";
import type { SkosImportResult } from "../types";
import { conceptCount, levelCount, schemesIn } from "./skosPreview";

const MAPS_TO: [string, string][] = [
	["skos:Concept", "term or allowed value"],
	["skos:prefLabel", "name · label"],
	["skos:broader", "broader value"],
	["skos:notation", "code"],
	["IRI", "kept on every term and value"],
];

const SAMPLE = 4;
const NOTES_SHOWN = 3;

/** Lower letters, digits and hyphens — a standard's name. */
const slugOnly = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
const validName = (s: string) => /^[a-z0-9][a-z0-9-]*$/.test(s);

const messageOf = (e: unknown) =>
	e instanceof Error ? e.message : String(e ?? "");

export function ImportSkosDialog({
	open,
	onClose,
	onImported,
}: {
	open: boolean;
	onClose: () => void;
	onImported: (result: SkosImportResult) => void;
}) {
	const preview = usePreviewSkos();
	const importer = useImportSkos();
	const [source, setSource] = useState<RdfSource | null>(null);
	const [reading, setReading] = useState(false);
	const [readError, setReadError] = useState<string | null>(null);
	const [schemes, setSchemes] = useState<string[]>([]);
	const [scheme, setScheme] = useState<string | undefined>();
	const [name, setName] = useState("");

	const found = preview.data;
	const publisher = found?.address.split("/")[0] ?? "";
	const previewError = preview.error
		? schemesIn(messageOf(preview.error)).length
			? null
			: preview.error
		: null;

	const runPreview = (content: string, chosen?: string) => {
		importer.reset();
		preview.mutate(
			{ content, scheme: chosen },
			{
				onSuccess: (r) => setName(r.address.split("/")[1] ?? ""),
				onError: (e) => {
					const listed = schemesIn(messageOf(e));
					if (listed.length) setSchemes(listed);
				},
			},
		);
	};

	const read = async (how: () => Promise<RdfSource>) => {
		setReading(true);
		setReadError(null);
		setSchemes([]);
		setScheme(undefined);
		preview.reset();
		importer.reset();
		try {
			const s = await how();
			setSource(s);
			runPreview(s.text);
		} catch (e) {
			setSource(null);
			setReadError(messageOf(e));
		} finally {
			setReading(false);
		}
	};

	const submit = () => {
		if (!source) return;
		importer.mutate(
			{ content: source.text, scheme, name },
			{
				onSuccess: (r) => {
					toast.success(
						r.unchanged
							? `Nothing changed — v${r.standard?.current_version ?? ""} already holds these terms`
							: `Imported ${r.address} v${r.version?.version ?? ""}`,
					);
					onImported(r);
				},
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Import a standard</DialogTitle>
					<DialogDescription>from a SKOS vocabulary</DialogDescription>
				</DialogHeader>

				<div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
					<RdfSourceField
						hint="SKOS in JSON-LD, Turtle or RDF/XML"
						busy={reading || preview.isPending}
						loaded={source?.label}
						onReadUrl={(url) => read(() => fetchRdfText(url))}
						onReadFile={(file) => read(() => readRdfFile(file))}
					/>
					<FormError error={readError} />

					{schemes.length && source ? (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="skos-scheme">Concept scheme</Label>
							<Select
								value={scheme ?? ""}
								onValueChange={(v) => {
									setScheme(v);
									runPreview(source.text, v);
								}}
							>
								<SelectTrigger id="skos-scheme" aria-label="Concept scheme">
									<SelectValue placeholder="Choose a scheme" />
								</SelectTrigger>
								<SelectContent>
									{schemes.map((s) => (
										<SelectItem key={s} value={s}>
											{s}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span className="text-sm text-muted-foreground">
								The file holds {schemes.length} concept schemes — one import
								takes one.
							</span>
						</div>
					) : null}
					<FormError error={previewError} />

					{found ? (
						<>
							<div className="flex flex-col gap-1.5">
								<Label>Found</Label>
								<Table density="compact" aria-label="Found">
									<TableHeader>
										<TableRow>
											<TableHead className="w-full">Concept scheme</TableHead>
											<TableHead>Concepts</TableHead>
											<TableHead>Levels</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<TableRow>
											<TableCell>
												<div className="flex flex-col">
													<span>{found.title}</span>
													{found.scheme_iri ? (
														<span className="font-mono text-sm text-muted-foreground break-all">
															{found.scheme_iri}
														</span>
													) : null}
												</div>
											</TableCell>
											<TableCell>{conceptCount(found)}</TableCell>
											<TableCell>{levelCount(found)}</TableCell>
										</TableRow>
									</TableBody>
								</Table>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="skos-name">Published as</Label>
								<div className="flex items-center gap-1">
									<span className="font-mono text-muted-foreground">
										{publisher}/
									</span>
									<Input
										id="skos-name"
										className="min-w-0 flex-1"
										value={name}
										onChange={(e) => setName(slugOnly(e.target.value))}
									/>
								</div>
								<span className="text-sm text-muted-foreground">
									{validName(name)
										? "A standard at this address gains a new version"
										: "Lower letters, digits and hyphens"}
								</span>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label>Maps to</Label>
								<Table density="compact">
									<TableHeader>
										<TableRow>
											<TableHead>SKOS</TableHead>
											<TableHead className="w-full">Invana</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{MAPS_TO.map(([skos, invana]) => (
											<TableRow key={skos}>
												<TableCell className="font-mono">{skos}</TableCell>
												<TableCell>{invana}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label>Terms</Label>
								<Table density="compact" aria-label="Terms">
									<TableHeader>
										<TableRow>
											<TableHead>Term</TableHead>
											<TableHead>Values</TableHead>
											<TableHead className="w-full">Sample codes</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{found.terms.map((t) => {
											const codes = (t.values ?? []).map((v) => v.code);
											return (
												<TableRow key={t.name}>
													<TableCell>{t.name}</TableCell>
													<TableCell>{codes.length}</TableCell>
													<TableCell className="font-mono">
														{codes.slice(0, SAMPLE).join(", ")}
														{codes.length > SAMPLE ? ", …" : ""}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							{found.report.notes_count ? (
								<Alert tone="warning">
									<AlertDescription>
										<ul className="flex flex-col gap-0.5">
											{found.report.notes.slice(0, NOTES_SHOWN).map((n) => (
												<li key={`${n.kind}-${n.subject}-${n.iri ?? ""}`}>
													<span className="font-mono">{n.subject}</span>{" "}
													{n.message}
												</li>
											))}
											{found.report.notes_count > NOTES_SHOWN ? (
												<li>
													and {found.report.notes_count - NOTES_SHOWN} more in
													the import report
												</li>
											) : null}
										</ul>
									</AlertDescription>
								</Alert>
							) : null}

							{found.report.skipped_count ? (
								<div className="flex flex-col gap-1.5">
									<Label>Skipped · {found.report.skipped_count}</Label>
									<ul className="flex flex-col gap-1">
										{found.report.skipped.map((s) => (
											<li
												key={`${s.kind}-${s.subject}-${s.iri ?? ""}`}
												className="flex items-baseline gap-2"
											>
												<Badge variant="outline" tone="muted" size="xs">
													skipped
												</Badge>
												<span className="font-mono">{s.subject}</span>
												<span className="text-sm text-muted-foreground">
													{s.message}
												</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
						</>
					) : null}

					<FormError error={importer.error} />
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={
							!found ||
							!source ||
							!validName(name) ||
							preview.isPending ||
							importer.isPending
						}
						onClick={submit}
					>
						Import as a standard
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
