import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * Fleet — Overview · Map · Table, each the path's last segment, drawn from
 * the engine's fleet reads. Assertions name only the frame (tiles, sections,
 * columns, the URL), so they hold whatever runs the dev Graph has.
 *
 * Needs `demos/airways`.
 */

const FLEET = `${GRAPH}/agents/fleet`;

test("Fleet › Overview draws its tiles and sections", async ({ page }) => {
	await page.goto(FLEET);
	for (const tile of [
		"Runs today",
		"Waiting on a person",
		"p95 run time",
		"Tokens this month",
		"Success rate",
	]) {
		await expect(page.getByText(tile, { exact: true })).toBeVisible({
			timeout: 30_000,
		});
	}
	await expect(
		page.getByText("Needs attention", { exact: true }),
	).toBeVisible();
	await expect(page.getByText("Runs a day", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Changed recently", { exact: true }),
	).toBeVisible();
});

test("Fleet's tabs land in the path; Table holds every agent's numbers", async ({
	page,
}) => {
	await page.goto(FLEET);
	await page.getByRole("tab", { name: "Map" }).click({ timeout: 30_000 });
	await expect(page).toHaveURL(new RegExp(`${FLEET}/map(\\?|$)`));

	await page.getByRole("tab", { name: "Table" }).click();
	await expect(page).toHaveURL(new RegExp(`${FLEET}/table(\\?|$)`));
	await expect(
		page.getByRole("columnheader", { name: "Tokens / run" }),
	).toBeVisible({ timeout: 30_000 });

	await page.reload();
	await expect(page.getByRole("tab", { name: "Table" })).toHaveAttribute(
		"aria-selected",
		"true",
		{ timeout: 30_000 },
	);
});
