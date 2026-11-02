import { expect, test } from "@playwright/test";
import { askForRun } from "./api";
import { GRAPH } from "./explorer";

/**
 * Activity is a Graph product: its rail is Runs · Approvals · Ledger │
 * Schedules · Events · Inbox · Rules · Channels, each a path and a workbook
 * tab, and the bell in the header is a way in. A row of Runs opens the run's
 * page as a tab beside it.
 */

const rail = (page: import("@playwright/test").Page, item: string) =>
	page.locator(`button[aria-label="${item}"]`);

test("the bell opens the tray, the tray opens the Inbox, and each rail item is a path", async ({
	page,
}) => {
	await page.goto(GRAPH);
	const bell = page.getByRole("button", { name: "Notifications" });
	await bell.waitFor({ timeout: 30_000 });
	const here = page.url();
	await bell.click();
	// The tray opens over the page; the bell never navigates.
	await expect(page).toHaveURL(here);
	await page.getByRole("button", { name: "Open inbox" }).click();
	await expect(page).toHaveURL(`${GRAPH}/activity/inbox`);
	// What needs someone, or that nothing does.
	await expect(
		page.getByText(/^(Nothing needs you|\d+ needs? you)$/).first(),
	).toBeVisible({ timeout: 30_000 });

	await rail(page, "Channels").click();
	await expect(page).toHaveURL(`${GRAPH}/activity/channels`);
	await rail(page, "Events").click();
	await expect(page).toHaveURL(`${GRAPH}/activity/events`);
	await rail(page, "Runs").click();
	await expect(page).toHaveURL(`${GRAPH}/activity/runs`);
	await expect(
		page.getByLabel("Breadcrumb").getByText("Runs", { exact: true }),
	).toBeVisible();
	// Each section the rail opened is a workbook tab; closing one moves to the last.
	await expect(page.getByRole("tab", { name: "Channels" })).toBeVisible();
	await page.getByRole("button", { name: "Close Runs" }).click();
	await expect(page).toHaveURL(`${GRAPH}/activity/events`);
});

test("a Runs row opens its run's page in Activity, and it survives a reload", async ({
	page,
}) => {
	// A query of its own, so its row is this test's and nobody else's.
	const query = `RETURN ${Date.now()} AS n`;
	await askForRun(page, query);
	await page.goto(`${GRAPH}/activity/runs`);
	await page
		.getByRole("row")
		.filter({ hasText: query })
		.first()
		.click({ timeout: 30_000 });
	await expect(page).toHaveURL(
		new RegExp(`${GRAPH}/activity/runs\\?page=run%3A[^&]+`),
	);
	const url = page.url();
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
	// The run page's own tabs, beside the Runs section's tab.
	await expect(page.getByRole("tab", { name: "Ledger" })).toBeVisible();

	await page.reload();
	await expect(page).toHaveURL(url);
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
});
