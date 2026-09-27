/**
 * The model page (1.8 · the-model-page.md) — Models as one page, the model a
 * filter on it.
 *
 * Needs `demos/airways`: four published models, stitched to each other. The
 * refusal changes nothing — an archive refused leaves the model where it was.
 */
import { type Page, expect, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

async function openModels(page: Page) {
	await page.goto(`${GRAPH}?panel=model`);
	await expect(page.getByRole("tab", { name: "All models" })).toBeVisible({
		timeout: 30_000,
	});
}

const row = (page: Page, name: string) =>
	page.getByRole("button", { name: new RegExp(`^${name}`) }).first();

test("a click scopes the page, Open drills in, and a reload lands on the same reading", async ({
	page,
}) => {
	await openModels(page);
	await expect(page.getByText("Each model")).toBeVisible();

	// A click selects: the board is re-read at that model, the tab kept (MP5).
	await row(page, "AirRoutes").click();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible();
	await expect(page.getByText("Each type")).toBeVisible();

	// `Open` drills the panel in and turns the page to the Model tab.
	await page.getByRole("button", { name: "Open", exact: true }).click();
	await expect(page.getByText("Node types").first()).toBeVisible();
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText(/\d+ nodes and \d+ edges rendered/)).toBeVisible({
		timeout: 20_000,
	});

	// Scope, tab and panel are the URL's.
	await page.reload();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText("Node types").first()).toBeVisible();
});

test("archiving a model an active stitch binds is refused, naming the stitches", async ({
	page,
}) => {
	await openModels(page);
	await row(page, "NewsArticles").click();
	await expect(page.getByRole("tab", { name: "NewsArticles" })).toBeVisible();

	await page.getByRole("button", { name: "More actions" }).click();
	await page.getByRole("menuitem", { name: "Archive" }).click();

	const card = page.getByRole("dialog", { name: "Archive NewsArticles" });
	await expect(card).toBeVisible({ timeout: 20_000 });
	await expect(card.getByText(/^refused · \d+ active stitch/)).toBeVisible();
	await expect(card.getByText(/NewsArticles\.\w+/).first()).toBeVisible();
	await card.getByRole("button", { name: "Close" }).first().click();

	// Nothing moved: the model is still listed.
	await expect(row(page, "NewsArticles")).toBeVisible();
});
