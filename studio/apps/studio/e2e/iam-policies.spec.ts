import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * IAM › Policies: the list shows every Graph's managed policies, a policy's
 * page opens on its statements grouped by layer, and Test access answers
 * layer by layer without running anything.
 *
 * Needs `demos/airways`.
 */

const POLICIES = `${GRAPH}/iam/policies`;

test("the list shows the managed policies, filtered by kind", async ({
	page,
}) => {
	await page.goto(`${POLICIES}?f.kind=managed`);
	const table = page.getByRole("table");
	await expect(table.getByText("viewer", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	for (const name of ["builder", "owner", "iam-admin"])
		await expect(table.getByText(name, { exact: true })).toBeVisible();
	await expect(table.getByText("custom", { exact: true })).toHaveCount(0);
});

test("a policy's page opens on its statements", async ({ page }) => {
	await page.goto(POLICIES);
	await page
		.getByRole("table")
		.getByText("builder", { exact: true })
		.click({ timeout: 30_000 });
	await expect(page).toHaveURL(/[?&]page=policy(:|%3A)builder/);
	const statements = page.getByRole("table", { name: "Statements" });
	await expect(statements).toBeVisible({ timeout: 30_000 });
	await expect(
		statements.getByText("work.spawn_agent", { exact: false }),
	).toBeVisible();
	await expect(
		page.getByText("managed — built in", { exact: false }),
	).toBeVisible();
});

test("Test access answers with every layer's verdict", async ({ page }) => {
	await page.goto(`${POLICIES}?page=policy:viewer&dialog=test`);
	const dialog = page.getByRole("dialog", { name: "Test access" });
	await expect(dialog).toBeVisible({ timeout: 30_000 });

	await dialog.getByRole("combobox", { name: "Who" }).click();
	await page.getByRole("option").first().click();
	await dialog.getByLabel("Does").fill("graph.read.records");
	await dialog.getByLabel("To").fill("graph/Airport/*");
	await dialog.getByRole("button", { name: "Test", exact: true }).click();

	const layers = dialog.getByRole("table", { name: "Layers checked" });
	await expect(layers).toBeVisible({ timeout: 30_000 });
	await expect(
		layers.getByText(/^(allows|refuses|n\/a)$/).first(),
	).toBeVisible();
});
