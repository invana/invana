/**
 * Verification for the Models-stack pass — **not a repo test**. Untracked.
 * Proves ME17 · ME18 against the running stack and this dev Graph.
 */
import { expect, test } from "@playwright/test";

const GRAPH = "/u/admin/airways";

test("ME17 — the Models panel is the stack, with no chrome above it", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=model`);

	// The drawer headers are the top of the column.
	const panel = page.getByTestId("models");
	await expect(panel.getByRole("button", { name: "Models" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByText("Stitches", { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByText("Global model", { exact: true }).first(),
	).toBeVisible();

	// The status bar carries the counts the meta row used to.
	await expect(
		page
			.getByText(/^\d+ models?$/)
			.filter({ visible: true })
			.first(),
	).toBeVisible();

	await page.screenshot({
		path: "/tmp/models-list.png",
		clip: { x: 0, y: 0, width: 760, height: 900 },
	});
});

test("ME18 — picking a model drills the first drawer in", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=model`);
	const row = page
		.locator("button")
		.filter({ hasText: /active|never published/ })
		.first();
	await expect(row).toBeVisible({ timeout: 30_000 });
	const name = ((await row.innerText()) ?? "").split("\n")[0].trim();

	await row.click();

	// `MODELS / <name>` is the header, and the type drawers follow.
	await expect(page.getByText("Node types", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText("Edge types", { exact: true })).toBeVisible();
	await expect(page.getByText("Staged", { exact: true })).toBeVisible();
	await expect(page.getByText(name).first()).toBeVisible();

	await page.screenshot({
		path: "/tmp/models-detail.png",
		clip: { x: 0, y: 0, width: 760, height: 900 },
	});
});
