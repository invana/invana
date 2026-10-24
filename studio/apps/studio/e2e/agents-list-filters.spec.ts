import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * The Agents list is filtered by the engine and its filters live in the URL:
 * a link opens the same rows and chips, × drops one, a reload keeps the rest.
 *
 * Needs `demos/airways`.
 */

const FILTERED = `${GRAPH}/agents/agents?q=fare&f.ephemeral=shown`;

test("a filtered link shows its chips; removing one keeps the rest across a reload", async ({
	page,
}) => {
	await page.goto(FILTERED);
	const strip = page.getByRole("group", { name: "Applied filters" });
	await expect(strip).toBeVisible({ timeout: 30_000 });
	const removes = strip.getByRole("button", { name: /^Remove / });
	await expect(removes).toHaveCount(2);

	await strip.getByRole("button", { name: /^Remove .*ephemeral/i }).click();
	await expect(page).not.toHaveURL(/f\.ephemeral=/);
	await expect(page).toHaveURL(/[?&]q=fare/);
	await expect(removes).toHaveCount(1);

	await page.reload();
	await expect(strip).toBeVisible({ timeout: 30_000 });
	await expect(removes).toHaveCount(1);
	await expect(page).toHaveURL(/[?&]q=fare/);

	await strip.getByRole("button", { name: "Clear all" }).click();
	await expect(page).not.toHaveURL(/[?&]q=/);
	await expect(strip).toHaveCount(0);
});
