import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * Activity › Runs reads its filters from the URL and the engine applies them:
 * a link the assistant wrote opens with its chips, its mark and its count, a
 * person's change drops the mark, and a reload shows the same rows.
 */

test("a filtered Runs link shows its chips; removing one drops the assistant's mark", async ({
	page,
}) => {
	await page.goto(
		`${GRAPH}/activity/runs?f.state=ended&f.since=30d&via=assistant`,
	);
	const strip = page.getByRole("group", { name: "Applied filters" });
	await expect(strip.getByRole("button", { name: /^Remove / })).toHaveCount(2, {
		timeout: 30_000,
	});
	await expect(strip.getByText("set by the assistant")).toBeVisible();
	await expect(page.getByText(/^\d+ of \d+ runs match$/)).toBeVisible({
		timeout: 30_000,
	});

	await strip.getByRole("button", { name: /^Remove state/ }).click();
	await expect(strip.getByText("set by the assistant")).toHaveCount(0);
	await expect(page).not.toHaveURL(/f\.state=/);
	await expect(page).not.toHaveURL(/via=assistant/);
	await expect(page).toHaveURL(/f\.since=30d/);
	await expect(strip.getByRole("button", { name: /^Remove / })).toHaveCount(1);

	// A person's list counts the same way, without the assistant's words.
	const count = page.getByText(/^\d+ of \d+ match$/);
	await expect(count).toBeVisible({ timeout: 30_000 });
	const before = await count.textContent();
	await page.reload();
	await expect(strip.getByRole("button", { name: /^Remove / })).toHaveCount(1, {
		timeout: 30_000,
	});
	await expect(count).toHaveText(before ?? "", { timeout: 30_000 });
});
