/**
 * The Models panel as a stack (ME17 · ME18), against `demos/airways`.
 *
 * A row click reads a model on the page; `Open` drills the panel in.
 */
import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

test("ME17 — the Models panel is the stack, with no chrome above it", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=model`);

	// The drawer headers are the top of the column. The header's name carries
	// its count, which is what tells it from `Starter models` and `Search models`.
	const panel = page.getByTestId("models");
	await expect(panel.getByRole("button", { name: /^Models \d+$/ })).toBeVisible(
		{ timeout: 30_000 },
	);
	// What acts on the list acts from the list's own header.
	for (const name of ["Import a model", "Starter models", "Search models"]) {
		await expect(panel.getByRole("button", { name })).toBeVisible();
	}

	// The status bar carries the counts the meta row used to.
	await expect(
		page
			.getByText(/^\d+ models?$/)
			.filter({ visible: true })
			.first(),
	).toBeVisible();
});

test("ME18 — Open on a model drills the first drawer in", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=model`);
	const row = page.getByRole("button", { name: /^NewsArticles/ }).first();
	await expect(row).toBeVisible({ timeout: 30_000 });

	// A click selects; `Open` is what drills the panel in.
	await row.click();
	await page.getByRole("button", { name: "Open", exact: true }).click();

	// `MODELS / NewsArticles` is the header, and the three drawers follow.
	for (const drawer of ["Node types", "Edge types", "Stitches"]) {
		await expect(
			page.getByRole("button", { name: new RegExp(`^${drawer} \\d+$`) }),
		).toBeVisible({ timeout: 20_000 });
	}
	await expect(page.getByText("NewsArticles").first()).toBeVisible();
});
