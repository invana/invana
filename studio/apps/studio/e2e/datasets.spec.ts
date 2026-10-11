import { expect, test } from "@playwright/test";

/**
 * Datasets is install-wide: its routes start at `/datasets`, with no Graph in
 * the path. The root lands on Catalogue, which shows its lock until the engine
 * records datasets; Imports is the journal of every Graph's loads.
 */

test("the product lands on Catalogue with its own rail", async ({ page }) => {
	await page.goto("/datasets");
	await expect(page).toHaveURL(/\/datasets\/catalogue(\?|$)/, {
		timeout: 30_000,
	});
	for (const item of ["Catalogue", "Validation", "Standards", "Imports"]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible({
			timeout: 30_000,
		});
	}
	await expect(
		page.getByText("Opens when the engine records datasets", { exact: true }),
	).toBeVisible();
});

test("Imports reads the loads of every Graph", async ({ page }) => {
	await page.goto("/datasets/catalogue");
	await page.locator('button[aria-label="Imports"]').click();
	await expect(page).toHaveURL(/\/datasets\/imports(\?|$)/);
	await expect(page.getByText("Imports a day", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/^across \d+ Graphs?$/)).toBeVisible({
		timeout: 30_000,
	});
});
