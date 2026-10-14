import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * ⌘K and the first run: the palette finds a record by name and opens it, hands
 * a question to the assistant without sending it, and an install with no Graph
 * starts by asking what you are trying to decide.
 */

test("⌘K finds a model by name, grouped under its product, and opens it", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/agents`);
	await expect(page.getByRole("button", { name: /Search or ask/ })).toBeVisible(
		{ timeout: 30_000 },
	);
	await page.keyboard.press("ControlOrMeta+k");
	const palette = page.getByRole("dialog");
	await palette.getByRole("combobox").fill("AirRoutes");
	const group = palette.getByRole("group", { name: "Modeller" });
	await expect(group.getByRole("option", { name: /AirRoutes/ })).toBeVisible({
		timeout: 30_000,
	});
	await group
		.getByRole("option", { name: /AirRoutes/ })
		.first()
		.click();
	await expect(page).toHaveURL(new RegExp(`${GRAPH}/modeller/models`));
	await expect(palette).toHaveCount(0);
});

test("Ask the assistant puts the question in the composer and sends nothing", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/explorer`);
	await page
		.getByRole("button", { name: /Search or ask/ })
		.click({ timeout: 30_000 });
	const question = "which airport has the most routes";
	await page.getByRole("dialog").getByRole("combobox").fill(question);
	await page
		.getByRole("option", { name: `Ask the assistant: “${question}”` })
		.click();
	await expect(page).toHaveURL(/right=assistant/);
	await expect(page.locator("textarea").first()).toHaveValue(question, {
		timeout: 30_000,
	});
});

test("the first run offers three ways in", async ({ page }) => {
	await page.goto("/graphs?first-run");
	await expect(
		page.getByRole("heading", { name: "What are you trying to decide?" }),
	).toBeVisible({ timeout: 30_000 });
	for (const way of [
		"Connect a graph database",
		"Start from data",
		"Try a sample Graph",
	]) {
		await expect(page.getByText(way, { exact: true })).toBeVisible();
	}
	await page.getByRole("button", { name: "Open Datasets" }).click();
	await expect(page).toHaveURL(/\/datasets\/catalogue(\?|$)/);
});
