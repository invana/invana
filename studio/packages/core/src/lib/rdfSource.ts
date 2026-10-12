/**
 * Reading an RDF document — a SKOS vocabulary or an ontology — into text the
 * engine's semantic imports accept.
 *
 * The engine never fetches: an import request carries the document's text. So
 * Studio reads it here, from a file the user chose or from a URL the browser
 * fetches itself. A server that does not let a browser read it (no CORS
 * header) cannot be read from Studio; the error says to download the file and
 * choose it instead. Text over the engine's cap is refused before it is sent.
 *
 * ```ts
 * const source = await readRdfFile(file);          // { text, label }
 * const source = await fetchRdfText(SCHEMA_ORG_URL);
 * standardsApi.importSkos({ content: source.text, dry_run: true });
 * ```
 */

/** The engine's cap on an import's text, in characters. */
export const RDF_MAX_CHARS = 20_000_000;

/** schema.org's current release, as JSON-LD with its context inline. */
export const SCHEMA_ORG_URL =
	"https://schema.org/version/latest/schemaorg-current-https.jsonld";

export interface RdfSource {
	text: string;
	/** What was read — a file name or a URL. */
	label: string;
}

function capped(text: string, label: string): RdfSource {
	if (!text.trim()) throw new Error(`${label} is empty.`);
	if (text.length > RDF_MAX_CHARS)
		throw new Error(
			`${label} is over ${RDF_MAX_CHARS / 1_000_000} MB of text — split it, or import it with the CLI.`,
		);
	return { text, label };
}

/** A file the user chose. */
export async function readRdfFile(file: File): Promise<RdfSource> {
	if (file.size > RDF_MAX_CHARS * 4)
		throw new Error(
			`${file.name} is over ${RDF_MAX_CHARS / 1_000_000} MB of text — split it, or import it with the CLI.`,
		);
	return capped(await file.text(), file.name);
}

/** A URL the browser fetches — the engine never does. */
export async function fetchRdfText(url: string): Promise<RdfSource> {
	const target = url.trim();
	if (!/^https?:\/\//i.test(target))
		throw new Error("A URL starts with http:// or https://.");
	let res: Response;
	try {
		res = await fetch(target, {
			headers: {
				accept:
					"text/turtle, application/ld+json, application/rdf+xml;q=0.9, */*;q=0.5",
			},
		});
	} catch {
		throw new Error(
			"The browser could not read that URL — the server may not allow it. Download the file and choose File.",
		);
	}
	if (!res.ok)
		throw new Error(`The server answered ${res.status} for that URL.`);
	return capped(await res.text(), target);
}
