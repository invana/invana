/**
 * The model's board (ME25 · ME26), against `demos/airways`.
 */
import { expect, type Page, test } from "@playwright/test";
import { GRAPH } from "./explorer";

const MODEL = "NewsArticles";

/** Read one model from the models board — a row click opens its board. */
async function openModel(page: Page) {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(`${GRAPH}/modeller/models`);
	const row = page.getByRole("row", { name: new RegExp(`^${MODEL}\\b`) });
	await expect(row.first()).toBeVisible({ timeout: 30_000 });
	await row.first().click();
}

test("ME26 — the model's board is a tab named for the model", async ({
	page,
}) => {
	await openModel(page);

	// The board strip — the one holding the Graph's own tab — names the model,
	// never the kind. The page's inner tabs (`Overview · Model · …`) are not it.
	const slug = GRAPH.split("/").at(-1) as string;
	const strip = page
		.getByRole("tablist")
		.filter({ has: page.getByRole("tab", { name: slug, exact: true }) });
	await expect(strip.getByRole("tab", { name: new RegExp(MODEL) })).toBeVisible(
		{ timeout: 20_000 },
	);
	await expect(
		strip.getByRole("tab", { name: "Model", exact: true }),
	).toHaveCount(0);
});

test("ME25 — the board draws the model, not an empty viewport", async ({
	page,
}) => {
	await openModel(page);
	// *Open in Schema* draws the model full-bleed.
	await page
		.getByRole("button", { name: "Open in Schema" })
		.click({ timeout: 20_000 });
	await expect(page).toHaveURL(/models_view=schema/);
	// The solve is un-animated: it settles, redraws and frames in one beat.
	await page.waitForTimeout(8000);

	// The board takes the tab's height — a collapsed one draws nothing at all.
	const board = page.locator("canvas").first();
	const box = await board.boundingBox();
	expect(box?.height ?? 0).toBeGreaterThan(300);

	// The types are cards with dark names and edges on a light dotted ground,
	// so *dark ink* is the signal — the dots never produce it. The shot is the
	// canvas alone, so no chrome around it can stand in for the drawing.
	const shot = await board.screenshot();
	const painted = await page.evaluate(async (b64) => {
		const img = new Image();
		img.src = `data:image/png;base64,${b64}`;
		await img.decode();
		const c = document.createElement("canvas");
		c.width = img.width;
		c.height = img.height;
		const ctx = c.getContext("2d");
		if (!ctx) return -1;
		ctx.drawImage(img, 0, 0);
		const { data } = ctx.getImageData(0, 0, c.width, c.height);
		let n = 0;
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const bl = data[i + 2];
			if (Math.max(r, g, bl) < 110) n++;
		}
		return n;
	}, shot.toString("base64"));

	// One card's name alone is a few hundred dark pixels; an empty viewport is 0.
	expect(painted).toBeGreaterThan(300);
});
