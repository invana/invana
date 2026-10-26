/**
 * Agents › Workers — Pools with its tiles (or the empty state on an install
 * with none), Add workers walking Where → Pool → Join token with the secret
 * shown once, and a pool row opening its pool tab.
 */
import { expect, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

test("Workers opens on Pools with its tiles", async ({ page }) => {
	await page.goto(`${GRAPH}/agents/workers`);
	await expect(page).toHaveURL(/\/agents\/workers/, { timeout: 30_000 });
	await expect(
		page.getByText("Slots busy").or(page.getByText("No workers yet")),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("tab", { name: "Join tokens" })).toBeVisible();
});

test("Add workers walks to a join token and shows the secret once", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/workers`);
	const add = page.getByRole("button", { name: "Add workers" }).first();
	await expect(add).toBeVisible({ timeout: 30_000 });
	test.skip(await add.isDisabled(), "Adding workers is an install admin's act");

	await add.click();
	await expect(page).toHaveURL(/add=where/);
	await page.getByRole("button", { name: /Docker/ }).click();
	await page.getByRole("button", { name: "Next" }).click();
	await expect(page).toHaveURL(/add=pool/);

	// An install with no pool makes one; otherwise the first existing pool is used.
	const name = page.getByLabel("Name");
	if (await name.isVisible()) await name.fill(`e2e-${Date.now() % 100000}`);
	else await page.getByRole("combobox", { name: "Pool" }).click();
	if (!(await name.isVisible())) await page.getByRole("option").first().click();
	await page.getByRole("button", { name: "Next" }).click();
	await expect(page).toHaveURL(/add=token/);

	await page.getByRole("button", { name: "Make token" }).click();
	const secret = page.getByLabel("Join token · shown once");
	await expect(secret).toHaveValue(/^invana_join_/, { timeout: 30_000 });

	// Reload: the modal reopens at step 1 and never shows the secret again.
	await page.reload();
	await expect(page.getByRole("button", { name: /Docker/ })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByLabel("Join token · shown once")).toHaveCount(0);
});

test("a pool row opens its pool tab", async ({ page }) => {
	await page.goto(`${GRAPH}/agents/workers`);
	await expect(
		page.getByText("Slots busy").or(page.getByText("No workers yet")),
	).toBeVisible({ timeout: 30_000 });
	const rows = page.getByRole("row", {
		name: /keeping up|short|no workers|healthy/,
	});
	test.skip((await rows.count()) === 0, "No pool on this install");
	await rows.first().click();
	await expect(page).toHaveURL(/worker_pool:/);
	await expect(page.getByRole("button", { name: "Drain" })).toBeVisible();
});
