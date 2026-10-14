import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * The fleet's two full-width pages — Overview and Performance — drawn from
 * the engine's fleet reads. Assertions name only the frame (tiles, sections,
 * the URL), so they hold whatever runs the dev Graph has.
 *
 * Needs `demos/airways`.
 */

const AGENTS = `${GRAPH}/agents`;

test("AG-01 Overview is the landing and draws its tiles and sections", async ({
	page,
}) => {
	await page.goto(AGENTS);
	await expect(page).toHaveURL(new RegExp(`${AGENTS}/overview(\\?|$)`));

	for (const tile of [
		"Runs today",
		"Waiting on a person",
		"p95 run time",
		"Tokens this month",
		"Success rate",
	]) {
		await expect(page.getByText(tile, { exact: true })).toBeVisible({
			timeout: 30_000,
		});
	}
	await expect(
		page.getByText("Needs attention", { exact: true }),
	).toBeVisible();
	await expect(page.getByText("Runs a day", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Changed recently", { exact: true }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "New agent" })).toBeVisible();
});

test("AG-15 Performance keeps its window and tab in the URL", async ({
	page,
}) => {
	await page.goto(`${AGENTS}/performance`);
	await expect(page.getByText("Tokens per run", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Each agent", { exact: true })).toBeVisible();

	await page.getByRole("radio", { name: "30 days" }).click();
	await expect(page).toHaveURL(/[?&]window=30d(&|$)/);

	await page.getByRole("tab", { name: "Skills" }).click();
	await expect(page).toHaveURL(/[?&]tab=skills(&|$)/);
	await expect(page.getByText("Each skill", { exact: true })).toBeVisible();
	await expect(page.getByText("Each agent", { exact: true })).toHaveCount(0);
});
