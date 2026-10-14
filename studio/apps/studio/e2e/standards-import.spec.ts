import { expect, test } from "@playwright/test";

/**
 * A curator imports a standard from a SKOS vocabulary (datasets.md DS-15,
 * board `datasets.standards.import`).
 *
 * The vocabulary is a small Turtle file made here: one top concept with three
 * narrower ones, one of them a level deeper, and a `skos:related` the import
 * lists as skipped. It publishes to a fixed address, so a re-run is the
 * unchanged import — nothing written — and still lands on the same page.
 */

const TURTLE = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/e2e/crop-traits/> .

ex:scheme a skos:ConceptScheme ;
  dct:title "E2E crop traits"@en ;
  skos:hasTopConcept ex:seed .

ex:seed a skos:Concept ; skos:prefLabel "Seed type"@en ;
  skos:inScheme ex:scheme ; skos:topConceptOf ex:scheme .

ex:desi a skos:Concept ; skos:prefLabel "Desi"@en ; skos:notation "desi" ;
  skos:broader ex:seed ; skos:inScheme ex:scheme ; skos:related ex:kabuli .

ex:kabuli a skos:Concept ; skos:prefLabel "Kabuli"@en ; skos:notation "kabuli" ;
  skos:broader ex:seed ; skos:inScheme ex:scheme .

ex:kabuli-small a skos:Concept ; skos:prefLabel "Small kabuli"@en ;
  skos:notation "kabuli-small" ; skos:broader ex:kabuli ; skos:inScheme ex:scheme .
`;

const NAME = "e2e-skos-crop-traits";

async function openImport(page: import("@playwright/test").Page) {
	await page.goto("/datasets/standards");
	await page.getByRole("button", { name: "Import from SKOS" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Import a standard")).toBeVisible();
	await dialog.getByRole("radio", { name: "File" }).click();
	return dialog;
}

test("DS-15 · a SKOS vocabulary previews and imports as a standard", async ({
	page,
}) => {
	const dialog = await openImport(page);
	await dialog.getByLabel("Source file").setInputFiles({
		name: "crop-traits.ttl",
		mimeType: "text/turtle",
		buffer: Buffer.from(TURTLE),
	});

	const found = dialog
		.getByRole("table", { name: "Found" })
		.getByRole("row", { name: /E2E crop traits/ });
	await expect(found).toBeVisible({ timeout: 30_000 });
	await expect(found.getByRole("cell").nth(1)).toHaveText("4");
	await expect(found.getByRole("cell").nth(2)).toHaveText("3");
	const term = dialog
		.getByRole("table", { name: "Terms" })
		.getByRole("row", { name: /Seed type/ });
	await expect(term).toContainText("desi, kabuli, kabuli-small");
	await expect(dialog.getByText("skipped", { exact: true })).toBeVisible();

	await dialog.getByLabel("Published as").fill(NAME);
	await dialog.getByRole("button", { name: "Import as a standard" }).click();
	await expect(page).toHaveURL(
		new RegExp(`/datasets/standards/admin/${NAME}$`),
		{
			timeout: 30_000,
		},
	);
});

test("DS-15 · an unreadable file is refused and nothing can be imported", async ({
	page,
}) => {
	const dialog = await openImport(page);
	await dialog.getByLabel("Source file").setInputFiles({
		name: "garbage.ttl",
		mimeType: "text/turtle",
		buffer: Buffer.from("this is not a vocabulary {{{"),
	});
	await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 30_000 });
	await expect(
		dialog.getByRole("button", { name: "Import as a standard" }),
	).toBeDisabled();
});
