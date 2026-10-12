/**
 * A model from an ontology (1.10 · ontology-import.md) — read a file, pick a
 * type, preview what maps and what is skipped, open it as a draft.
 *
 * The ontology is inline Turtle, so the spec needs nothing but the Graph. The
 * draft it creates is deleted through the API, so runs leave nothing behind.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const TINY_OWL = `
@prefix ex: <http://example.org/tiny#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:Person a owl:Class ; rdfs:label "Person" ;
  rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:worksFor ; owl:minCardinality 1 ] .
ex:Organization a owl:Class ; rdfs:label "Organization" .
ex:Place a owl:Class ; rdfs:label "Place" .
ex:fullName a owl:DatatypeProperty ; rdfs:domain ex:Person ; rdfs:range xsd:string .
ex:worksFor a owl:ObjectProperty ; rdfs:domain ex:Person ; rdfs:range ex:Organization .
`;

async function openDialog(page: Page) {
	await page.goto(`${GRAPH}/modeller/models`);
	await expect(page.getByRole("tab", { name: "All models" })).toBeVisible({
		timeout: 30_000,
	});
	await page.getByRole("button", { name: "More actions" }).click();
	await page.getByRole("menuitem", { name: "From an ontology" }).click();
	const dialog = page.getByRole("dialog", {
		name: "New model from an ontology",
	});
	await expect(dialog).toBeVisible();
	await dialog.getByRole("radio", { name: "File" }).click();
	return dialog;
}

async function upload(page: Page, name: string, text: string) {
	await page.getByLabel("Source file").setInputFiles({
		name,
		mimeType: "text/turtle",
		buffer: Buffer.from(text),
	});
}

test("an ontology opens as a draft: pick, preview, import", async ({
	page,
}) => {
	const name = `e2e-onto-${Date.now()}`;
	const dialog = await openDialog(page);
	await upload(page, "tiny.ttl", TINY_OWL);

	await expect(dialog.getByText("tiny.ttl · 3 types")).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		dialog.getByText("None picked — all 3 types import"),
	).toBeVisible();
	await dialog.getByRole("checkbox", { name: "Pick Person" }).click();
	await expect(dialog.getByText(/^1 picked/)).toBeVisible();
	await dialog.getByRole("button", { name: "Preview" }).click();

	const preview = page.getByRole("dialog", { name: "Import preview" });
	await expect(preview).toBeVisible({ timeout: 20_000 });
	await expect(
		preview.getByText("tiny.ttl · Person + 1 they need"),
	).toBeVisible();
	const row = (source: string) =>
		preview.getByRole("row").filter({ hasText: source }).first();
	await expect(row("node type Person")).toContainText("1 property");
	await expect(row("node type Organization")).toContainText(
		"came with Person.worksFor",
	);
	await expect(
		preview.getByRole("row").filter({ hasText: "skipped" }).first(),
	).toBeVisible();
	await expect(preview.getByText(/^\d+ skipped$/)).toBeVisible();

	await preview.getByLabel("Call it").fill(name);
	await preview.getByRole("button", { name: "Open as a draft" }).click();

	try {
		await expect(preview).toBeHidden({ timeout: 20_000 });
		await expect(page.getByRole("tab", { name })).toBeVisible({
			timeout: 20_000,
		});
	} finally {
		const models = await graphApi<{ id: string; name: string }[]>(
			page,
			"/models",
		);
		for (const m of models.filter((m) => m.name === name)) {
			await graphApi(page, `/models/${m.id}`, { method: "DELETE" });
		}
	}
});

test("a file that is not RDF is refused, and nothing can be previewed", async ({
	page,
}) => {
	const dialog = await openDialog(page);
	await upload(page, "garbage.ttl", "this is not turtle {{{ at all");

	await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 20_000 });
	await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled();
});
