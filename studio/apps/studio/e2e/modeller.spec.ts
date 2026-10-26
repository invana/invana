import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * The Modeller is its own product: its rail is the shell's `leftNav`, every
 * rail item is a path, and the landing is the Global model.
 *
 * Needs `demos/airways`, whose published models are stitched to each other.
 */

const MODELLER = `${GRAPH}/modeller`;

/** The rail item's path, whatever region params ride along. */
const onPath = (item: string) => new RegExp(`${MODELLER}/${item}(\\?|$)`);

test("the Global model lands on its canvas, the union beside it", async ({
	page,
}) => {
	await page.goto(`${MODELLER}/global-model`);
	await expect(
		page.getByLabel("Breadcrumb").getByText("Global model", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	for (const item of ["Models", "Stitches", "Worlds", "Rules"]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible();
	}
	// The info bar over the canvas, and the union list in the right column.
	await expect(page.getByText(/\d+ edge types · \d+ stitches/)).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Anchored", { exact: true })).toBeVisible();
	// The page is the canvas: no models board tabs around it.
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveCount(0);
});

test("a stitch opens from the Stitches page into the inspector", async ({
	page,
}) => {
	await page.goto(`${MODELLER}/stitches`);
	await expect(page.getByText(/\d+ active/).first()).toBeVisible({
		timeout: 30_000,
	});
	await page.getByRole("button", { name: "Open", exact: true }).first().click();
	await expect(page).toHaveURL(/global-model\?.*stitch=/);
	await expect(page.getByText("Joins on")).toBeVisible({ timeout: 30_000 });
	await expect(
		page.getByRole("button", { name: "Remove stitch" }),
	).toBeVisible();
});

test("Declare a stitch opens the declare card, and closing it declares nothing", async ({
	page,
}) => {
	await page.goto(`${MODELLER}/stitches`);
	const active = page.getByText(/^\d+ active$/).first();
	await expect(active).toBeVisible({ timeout: 30_000 });
	const before = await active.textContent();
	await page.getByRole("button", { name: "Declare a stitch" }).first().click();
	const card = page.getByRole("dialog");
	await expect(card).toBeVisible({ timeout: 20_000 });
	await page.keyboard.press("Escape");
	await expect(card).toBeHidden();
	await expect(active).toHaveText(before ?? "");
});

test("a rail item writes its path: Rules opens, Requests opens its inbox", async ({
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
	await expect(
		page.getByText("asks the Graph could not answer").first(),
	).toBeVisible({ timeout: 30_000 });
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
