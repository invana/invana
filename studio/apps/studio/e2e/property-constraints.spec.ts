/**
 * Constraints on properties (1.11 · property-constraints.md) — the type page's
 * Constraints tab and the constraint dialog.
 *
 * Needs `demos/airways`: AirRoutes holds a draft, and `airport.runways` has no
 * constraint. Each test leaves the draft as it found it.
 */
import { expect, type Page, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";
const AIRROUTES = "d5b061e6-e75b-4545-8cbc-23f316331004";

async function openRunways(page: Page) {
	await page.goto(
		`${GRAPH}/modeller/models?model=${AIRROUTES}&model_open=1&model_type=airport&type_tab=constraints`,
	);
	await expect(page.getByText("Properties and their constraints")).toBeVisible({
		timeout: 30_000,
	});
	await page
		.getByRole("button", { name: "Edit constraint on runways", exact: true })
		.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("airport · constraint")).toBeVisible();
	return dialog;
}

const runwaysRow = (page: Page) =>
	page.getByRole("row", { name: /^runways\b/ }).first();

test("a range counts what breaks it, saves on the draft, and is removed again", async ({
	page,
}) => {
	const dialog = await openRunways(page);
	await dialog.getByLabel("Lowest value").fill("1");
	await dialog.getByLabel("Highest value").fill("3");
	await dialog.getByLabel("Unit").fill("runways");
	// The engine counts the graph's airports outside the range before Save.
	await expect(
		dialog.getByText(/^Today [\d,]+ records? breaks? it/),
	).toBeVisible({ timeout: 20_000 });

	await dialog.getByRole("button", { name: "Save constraint" }).click();
	await expect(dialog).toBeHidden();
	await expect(runwaysRow(page)).toContainText("1 – 3 runways");

	// Reopened, it reads back and offers its removal.
	const again = await openRunways(page);
	await expect(again.getByLabel("Lowest value")).toHaveValue("1");
	await again.getByRole("button", { name: "Remove constraint" }).click();
	await expect(again).toBeHidden();
	await expect(runwaysRow(page)).not.toContainText("1 – 3");
});

test("an inverted range is refused in the dialog and nothing is saved", async ({
	page,
}) => {
	const dialog = await openRunways(page);
	await dialog.getByLabel("Lowest value").fill("5");
	await dialog.getByLabel("Highest value").fill("2");
	await expect(
		dialog.getByText("The lower bound is above the upper bound."),
	).toBeVisible({ timeout: 20_000 });

	await dialog.getByRole("button", { name: "Save constraint" }).click();
	await expect(
		dialog.getByText("The lower bound is above the upper bound.").last(),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(runwaysRow(page)).toContainText("—");
});
