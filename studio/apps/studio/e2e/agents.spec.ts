import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * Agents is its own product: its rail is the shell's `leftNav`, every rail
 * item is a path, and the landing is the agents list.
 *
 * Needs `demos/airways`.
 */

const AGENTS = `${GRAPH}/agents`;

/** The rail item's path, whatever region params ride along. */
const onPath = (item: string) => new RegExp(`${AGENTS}/${item}(\\?|$)`);

test("the product lands on Agents with its own rail", async ({ page }) => {
	await page.goto(AGENTS);
	await expect(page).toHaveURL(onPath("agents"));
	for (const item of [
		"Overview",
		"Skills",
		"Library",
		"Plugins",
		"LLMs",
		"Performance",
		"Settings",
	]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible({
			timeout: 30_000,
		});
	}
});

test("Plugins holds the catalogue; Performance shows its lock", async ({
	page,
}) => {
	await page.goto(`${AGENTS}/agents`);
	await page.locator('button[aria-label="Plugins"]').click({ timeout: 30_000 });
	await expect(page).toHaveURL(onPath("plugins"));
	await expect(page.getByText("No plugins yet")).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Catalogue", { exact: true })).toBeVisible();

	await page.locator('button[aria-label="Performance"]').click();
	await expect(page).toHaveURL(onPath("performance"));
	await expect(page.getByText("Opens with engine support")).toBeVisible({
		timeout: 30_000,
	});
});

test("Settings holds the Graph's concurrency", async ({ page }) => {
	await page.goto(`${AGENTS}/settings`);
	await expect(page.getByText("Concurrency", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
});
