import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * Agents is a rail and a workbook: the product lands on Home, every rail item
 * opens its section as a page in `mainSection` — no leftSection — and a row
 * opens its record as a workbook tab of its own.
 *
 * Needs `demos/airways`.
 */

const AGENTS = `${GRAPH}/agents`;

/** The section's path, whatever region params ride along. */
const onPath = (item: string) => new RegExp(`${AGENTS}/${item}(\\?|$)`);

test("the product lands on Home; a tile opens its section", async ({
	page,
}) => {
	await page.goto(AGENTS);
	await expect(page).toHaveURL(onPath("home"));
	for (const item of [
		"Fleet",
		"Performance",
		"Agents",
		"Skills",
		"Functions",
		"Connections",
		"LLMs",
		"Settings",
	]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible({
			timeout: 30_000,
		});
	}
	await expect(page.getByText("Or open a section")).toBeVisible();

	await page.getByRole("button", { name: /^Skills\s*\d+ skills?/ }).click();
	await expect(page).toHaveURL(onPath("skills"));
	await expect(page.getByPlaceholder("Find a skill")).toBeVisible({
		timeout: 30_000,
	});
});

test("a rail item opens its section page; a row opens the agent as a tab", async ({
	page,
}) => {
	await page.goto(`${AGENTS}/home`);
	await page.locator('button[aria-label="Agents"]').click({ timeout: 30_000 });
	await expect(page).toHaveURL(onPath("agents"));
	const row = page.getByRole("row").filter({ hasText: "Explorer" }).first();
	await row.click({ timeout: 30_000 });
	await expect(page).toHaveURL(/[?&]page=agent(:|%3A)/);
});
