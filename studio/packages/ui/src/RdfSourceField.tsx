/**
 * **Where an RDF document comes from** — the *Source* field of the semantic
 * imports (SKOS → standard in Datasets, ontology → draft model in Modeller).
 *
 * A segmented choice of named presets (`schema.org`), a URL, or a file, then
 * the act that reads it. Props in, events out: the field never fetches or
 * reads a file itself — `onReadUrl` and `onReadFile` hand the choice to the
 * product, which reads it (through `@invana-studio/core`'s `fetchRdfText` /
 * `readRdfFile`) and passes back what it read as `loaded`.
 *
 * ```tsx
 * <RdfSourceField
 *   presets={[{ value: "schema.org", label: "schema.org", url: SCHEMA_ORG_URL }]}
 *   hint="RDFS / OWL in JSON-LD, Turtle or RDF/XML"
 *   busy={reading}
 *   loaded={source?.label}
 *   onReadUrl={(url) => read(() => fetchRdfText(url))}
 *   onReadFile={(file) => read(() => readRdfFile(file))}
 * />
 * ```
 */

import { Input, Label } from "@invana/forms";
import { Button, SegmentedControl, Spinner } from "@invana/ui";
import { FileUp, Link } from "lucide-react";
import { useId, useRef, useState } from "react";

interface RdfSourcePreset {
	value: string;
	label: string;
	/** The URL the preset reads. */
	url: string;
}

interface Props {
	presets?: RdfSourcePreset[];
	/** One line under the field — the formats it reads. */
	hint?: string;
	placeholder?: string;
	/** A read is in flight. */
	busy?: boolean;
	/** What was read last — a file name or a URL. */
	loaded?: string | null;
	onReadUrl: (url: string) => void;
	onReadFile: (file: File) => void;
}

const ACCEPT =
	".ttl,.jsonld,.json,.rdf,.owl,.xml,.nt,text/turtle,application/ld+json,application/rdf+xml";

export function RdfSourceField({
	presets = [],
	hint = "JSON-LD, Turtle or RDF/XML",
	placeholder = "https://…/vocabulary.ttl",
	busy = false,
	loaded,
	onReadUrl,
	onReadFile,
}: Props) {
	const id = useId();
	const fileInput = useRef<HTMLInputElement>(null);
	const [mode, setMode] = useState<string>(presets[0]?.value ?? "url");
	const [url, setUrl] = useState("");
	const preset = presets.find((p) => p.value === mode);

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={`${id}-url`}>Source</Label>
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					aria-label="Source"
					value={mode}
					onValueChange={setMode}
					options={[
						...presets.map((p) => ({ value: p.value, label: p.label })),
						{ value: "url", label: "URL" },
						{ value: "file", label: "File" },
					]}
				/>
				{preset ? (
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={() => onReadUrl(preset.url)}
					>
						<Link />
						Read {preset.label}
					</Button>
				) : mode === "url" ? (
					<form
						className="flex min-w-0 flex-1 items-center gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (url.trim()) onReadUrl(url.trim());
						}}
					>
						<Input
							id={`${id}-url`}
							aria-label="Source URL"
							className="min-w-0 flex-1"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder={placeholder}
						/>
						<Button
							type="submit"
							size="sm"
							variant="outline"
							disabled={busy || !url.trim()}
						>
							Read
						</Button>
					</form>
				) : (
					<>
						<input
							ref={fileInput}
							type="file"
							accept={ACCEPT}
							aria-label="Source file"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) onReadFile(file);
								e.target.value = "";
							}}
						/>
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							onClick={() => fileInput.current?.click()}
						>
							<FileUp />
							Choose a file
						</Button>
					</>
				)}
				{busy ? <Spinner /> : null}
			</div>
			<span className="text-sm text-muted-foreground">
				{loaded ? `Read ${loaded}` : hint}
			</span>
		</div>
	);
}
