/**
 * Verification for the model-board pass — **not a repo test**. Untracked.
 * Proves ME25 · ME26 against the running stack and this dev Graph.
 */
import { type Page, expect, test } from "@playwright/test";

const GRAPH = "/u/admin/airways";

/** Drill into the first model in the Models panel, and answer with its name. */
async function openFirstModel(page: Page) {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(`${GRAPH}?panel=model`);
	const row = page
		.locator("button")
		.filter({ hasText: /active|never published/ })
		.first();
	await expect(row).toBeVisible({ timeout: 30_000 });
	const name = ((await row.innerText()) ?? "").split("\n")[0].trim();
	await row.click();
	return name;
}

test("ME26 — the model's board is a tab named for the model", async ({
	page,
}) => {
	const name = await openFirstModel(page);

	// The strip names the model, never the kind.
	await expect(page.getByRole("tab", { name })).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveCount(0);
});

test("ME25 — the board draws the model, not an empty viewport", async ({
	page,
}) => {
	await openFirstModel(page);
	// The solve is un-animated: it settles, redraws and frames in one beat.
	await page.waitForTimeout(8000);

	// The types are coloured circles on a near-grey ground, so *saturation* is
	// the signal — a pixel whose channels disagree is paint, and the dotted
	// background never produces one. The clip is the top of the canvas, which
	// leaves the minimap out: it reads the store directly and drew the model
	// even while the viewport was empty, which is the bug this proves gone.
	const shot = await page.screenshot({
		clip: { x: 580, y: 100, width: 1010, height: 600 },
	});
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
			if (Math.max(r, g, bl) - Math.min(r, g, bl) > 40) n++;
		}
		return n;
	}, shot.toString("base64"));

	// A single 14px type circle is ~600px of paint; an empty viewport is 0.
	expect(painted).toBeGreaterThan(300);
});
