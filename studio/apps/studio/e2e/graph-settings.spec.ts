/**
 * Graph settings › Basic and Database (MO-14, boards `modeller.settings` and
 * `modeller.settings.database`).
 *
 * Database reads the stored user back and never the password; a test with the
 * password left blank uses the stored one, and only a passing test enables
 * *Save*. Basic refuses a blank name before anything is written. Neither test
 * saves, so the demo Graph is left as it was.
 */
import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

test("MO-14 Database tests with the stored password before Save", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/modeller/settings?tab=database`);
	const user = page.getByRole("textbox", { name: "User", exact: true });
	await expect(user).not.toHaveValue("", { timeout: 30_000 });
	await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
	const save = page.getByRole("button", { name: "Save", exact: true });
	await expect(save).toBeDisabled();

	await page.getByRole("button", { name: "Test connection" }).click();
	await expect(page.getByText("Connection works")).toBeVisible({
		timeout: 30_000,
	});
	await expect(save).toBeEnabled();

	// An edit to what was tested makes the test stale again.
	await page
		.getByRole("textbox", { name: "URI", exact: true })
		.fill("bolt://nowhere:7687");
	await expect(save).toBeDisabled();
});

test("MO-14 Basic refuses a blank name", async ({ page }) => {
	await page.goto(`${GRAPH}/modeller/settings`);
	const name = page.getByLabel("Name");
	await expect(name).not.toHaveValue("", { timeout: 30_000 });
	await name.fill("");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByText("Name is required.")).toBeVisible();
});
