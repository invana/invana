/**
 * Connecting a database and starting a model (connect-a-database.md ·
 * domain-models.md) — the two ways a model begins.
 *
 * Needs `demos/airways` and its starters. The connect test makes no Graph: a
 * refused test only says why. The starter's model is deleted when the test ends.
 */
import { expect, test } from "@playwright/test";
import { graphApi } from "./api";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

test("Test refuses a database nobody answers at, and connects nothing", async ({
	page,
}) => {
	await page.goto("/graphs/new");
	await expect(
		page.getByRole("heading", { name: "Connect a database" }),
	).toBeVisible({ timeout: 30_000 });
	const connect = page.getByRole("button", {
		name: "Connect and draft a model",
	});
	await expect(connect).toBeDisabled();

	await page.getByLabel("URI").fill("bolt://127.0.0.1:1");
	await page.getByRole("button", { name: "Test", exact: true }).click();
	await expect(page.getByText("Connection works")).toHaveCount(0);
	await expect(page.locator(".text-destructive").first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page).toHaveURL(/\/graphs\/new$/);
});

test("New model › A starter lands on the new model's draft canvas", async ({
	page,
}) => {
	const name = `E2E Starter ${Date.now()}`;
	await page.goto(`${GRAPH}/modeller/models`);
	await page.getByRole("button", { name: "New model" }).click();
	const dialog = page.getByRole("dialog", { name: "New model" });
	await dialog.getByLabel("Name").fill(name);
	await dialog.getByRole("button", { name: /^A starter/ }).click();
	await dialog
		.locator("button[aria-pressed]")
		.filter({ hasNotText: /^(Describe it|A file|A starter)/ })
		.first()
		.click();
	await dialog.getByRole("button", { name: "Create draft" }).click();

	await expect(page).toHaveURL(/models_view=schema/, { timeout: 30_000 });
	const id = new URL(page.url()).searchParams.get("model");
	try {
		expect(id).toBeTruthy();
		await expect(page.getByText(name).first()).toBeVisible();
	} finally {
		if (id) await graphApi(page, `/models/${id}`, { method: "DELETE" });
	}
});
