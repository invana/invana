import { expect, test } from "@playwright/test";
import { ask, emission } from "./explorer";

/**
 * The answer surface, end to end
 * (docs/for-developers/modules/ask/features/the-answer-surface.md).
 *
 * Three asks against a live engine and a real Neo4j — one per emission the
 * engine can produce today. `metric`, `chart` and `prose` have no producer yet
 * and are deliberately not covered: a test that fed them a fixture would assert
 * that Studio can render its own invention, not that an answer arrives.
 */

test("rows come back as a table emission, with the records cited", async ({
	page,
}) => {
	await ask(
		page,
		"UNWIND [['BEL','Defence'],['HAL','Defence'],['BDL','Defence'],['MIDHANI','Defence']] AS r RETURN r[0] AS stock, r[1] AS theme",
	);

	const card = emission(page, "table");
	await expect(card).toBeVisible({ timeout: 30_000 });
	await expect(card).toContainText("cite · 4 records");
	await expect(card.getByRole("cell", { name: "MIDHANI" })).toBeVisible();
});

test("zero rows come back as the empty emission, not a blank table", async ({
	page,
}) => {
	await ask(page, "MATCH (n:__nothing_holds_this__) RETURN n LIMIT 1");

	const card = emission(page, "empty");
	await expect(card).toBeVisible({ timeout: 30_000 });
	await expect(card).toContainText("cite · 0 records");
	await expect(card).toContainText("does not hold records");

	// AS7: the answer is the sentence, and nothing renders an empty table beside
	// it.
	await expect(emission(page, "table")).toHaveCount(0);
});

test("a session's first subgraph is drawn; a later one is offered until loaded", async ({
	page,
}) => {
	await ask(
		page,
		"MATCH (a:airport)-[r:route]->(b:airport) RETURN a, r, b LIMIT 6",
	);

	// The first result is painted onto the session's canvas, so it offers
	// nothing; drawn or not, a subgraph has no card.
	const offer = page.getByRole("button", { name: "Load to canvas" });
	await expect(
		page.getByRole("button", { name: /nodes · .* relationships/ }),
	).toBeVisible({ timeout: 30_000 });
	await expect(offer).toHaveCount(0);
	await expect(emission(page, "subgraph")).toHaveCount(0);

	// A later graph answer in the thread carries the offer; a click spends it.
	await page
		.getByTestId("composer")
		.getByRole("textbox")
		.first()
		.fill(
			"MATCH (a:airport)-[r:route]->(b:airport) RETURN a, r, b SKIP 6 LIMIT 3",
		);
	await page.getByRole("button", { name: "Send" }).click();
	await expect(offer).toBeVisible({ timeout: 30_000 });
	await offer.click();
	await expect(offer).toHaveCount(0);
	await expect(emission(page, "subgraph")).toHaveCount(0);
});
