/**
 * The Rules page — every rule in force in the Graph, filtered by the engine,
 * and the rule dialog over it.
 *
 * Reads the install rules `demos/airways/rules.json` applies and the Graph's
 * own invariant; writes nothing, so the list the boards are shot from stays
 * as seeded.
 */
import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

const RULES = `${GRAPH}/modeller/rules`;
const INSTALL_RULE = "A final decision cites person-reviewed data only.";
const GRAPH_RULE = "Airport codes are IATA, never ICAO.";

test("the Scope filter is applied by the engine", async ({ page }) => {
	await page.goto(`${RULES}?f.scope=install`);
	await expect(page.getByText(INSTALL_RULE)).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText(GRAPH_RULE)).toHaveCount(0);
});

test("a rule opens as a dialog at its path, with the 30-day impact", async ({
	page,
}) => {
	await page.goto(RULES);
	await page.getByText(INSTALL_RULE).click({ timeout: 30_000 });
	await expect(page).toHaveURL(/\/modeller\/rules\/[0-9a-f-]{36}/);
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Project decision")).toBeVisible();
	await expect(dialog.getByText(/^Last 30 days this/)).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		page.getByLabel("Breadcrumb").getByText(INSTALL_RULE),
	).toBeVisible();
});

test("a check without its params cannot be saved", async ({ page }) => {
	await page.goto(`${RULES}?new=1`);
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Statement").fill("Every bound dataset is licensed.");
	await dialog.getByRole("combobox", { name: "Check" }).click();
	await page
		.getByRole("option", { name: "The dataset's licence is one allowed" })
		.click();
	await expect(
		dialog.getByRole("button", { name: "Save rule" }),
	).toBeDisabled();
	await dialog.getByLabel("Allowed licences").fill("CC-BY-4.0");
	await expect(dialog.getByRole("button", { name: "Save rule" })).toBeEnabled();
});
