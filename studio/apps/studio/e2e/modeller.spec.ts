import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * The Modeller is its own product: its rail is the shell's `leftNav`, every
 * rail item is a path, and the landing is the Global model.
 *
 * Needs `demos/airways`, whose published models give the Model tab a canvas.
 */

const MODELLER = `${GRAPH}/modeller`;

/** The rail item's path, whatever region params ride along. */
const onPath = (item: string) => new RegExp(`${MODELLER}/${item}(\\?|$)`);

test("the Global model lands with the Modeller rail and the Model tab", async ({
	page,
}) => {
	await page.goto(`${MODELLER}/global-model`);
	await expect(
		page.getByLabel("Breadcrumb").getByText("Global model", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	for (const item of ["Models", "Stitches", "Worlds", "Rules"]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible();
	}
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveAttribute("aria-selected", "true");
});

test("a rail item writes its path: Rules opens, Requests shows its lock", async ({
	page,
}) => {
	await page.goto(`${MODELLER}/global-model`);
	await page.locator('button[aria-label="Rules"]').click({ timeout: 30_000 });
	await expect(page).toHaveURL(onPath("rules"));
	await expect(page.getByText("offered and cited, never enforced")).toBeVisible(
		{ timeout: 30_000 },
	);

	await page.locator('button[aria-label="Requests"]').click();
	await expect(page).toHaveURL(onPath("requests"));
	await expect(page.getByText("Opens with engine support")).toBeVisible({
		timeout: 30_000,
	});
});

test("a rail move keeps the docked chat open", async ({ page }) => {
	await page.goto(`${MODELLER}/global-model?right=assistant`);
	for (const item of ["Rules", "Worlds"]) {
		await page
			.locator(`button[aria-label="${item}"]`)
			.click({ timeout: 30_000 });
		await expect(page).toHaveURL(onPath(item.toLowerCase()));
		await expect(page).toHaveURL(/[?&]right=assistant(&|$)/);
	}
});
