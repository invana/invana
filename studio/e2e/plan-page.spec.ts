/**
 * The plan page (LB24) — picking a plan in Library › Plans opens it as a page
 * of four tabs read over a window, and a run row opens that run's page.
 *
 * Reads only. It needs a Graph where `nl-single` has run and
 * `expand-neighbours` never has — `demos/airways` after a few asks.
 */
import { type Page, expect, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

async function openPlan(page: Page, key: string) {
	await page.goto(`${GRAPH}?panel=library&drawer=plans`);
	const row = page.getByRole("button", { name: new RegExp(`^${key}`) }).first();
	await expect(row).toBeVisible({ timeout: 30_000 });
	await row.click();
}

test("a plan that has run reads across its four tabs and opens a run", async ({
	page,
}) => {
	await openPlan(page, "nl-single");

	await expect(page.getByText(/^Each step, across \d+ runs?$/)).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText("Runs a day")).toBeVisible();

	await page.getByRole("tab", { name: "Layers" }).click();
	await expect(page.getByText("Layers it declares").last()).toBeVisible();

	await page.getByRole("tab", { name: "Flow" }).click();
	await expect(page.getByText(/^Medians over the window/)).toBeVisible();

	await page.getByRole("tab", { name: "Activity" }).click();
	const run = page.getByRole("row", { name: /run:[0-9a-f]{8}/ }).first();
	await expect(run).toBeVisible({ timeout: 20_000 });

	// The agent picker names the agents that may run the plan and filters by
	// the one picked: another agent empties the list, the one that ran fills it.
	const ranBy = (await run.getByRole("cell").nth(3).textContent()) ?? "";
	const picker = page.getByRole("combobox", { name: "agent" });
	await picker.click();
	const other = page
		.getByRole("option")
		.filter({ hasNotText: new RegExp(`^(all agents|${ranBy})$`) })
		.first();
	await other.click();
	await expect(page.getByText("No run matches these filters.")).toBeVisible();
	await picker.click();
	await page.getByRole("option", { name: ranBy, exact: true }).click();
	await expect(run).toBeVisible();

	const label = (await run.getByText(/^run:[0-9a-f]{8}$/).textContent()) ?? "";
	await run.click();

	// The run opens as its own page beside the plan's, and comes to the front.
	await expect(page.getByRole("tab", { name: label })).toHaveAttribute(
		"aria-selected",
		"true",
		{ timeout: 20_000 },
	);
	// …and stays there: the plan page does not take focus back.
	await page.waitForTimeout(2_000);
	await expect(page.getByRole("tab", { name: label })).toHaveAttribute(
		"aria-selected",
		"true",
	);
});

test("a plan that has never run shows an empty Overview, not a chart of zeros", async ({
	page,
}) => {
	await openPlan(page, "expand-neighbours");

	await expect(
		page.getByText(/^Nothing ran this plan in the last/),
	).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText(/^Each step, across 0 runs$/)).toBeVisible();
	await expect(page.getByText("Runs a day")).toHaveCount(0);
});
