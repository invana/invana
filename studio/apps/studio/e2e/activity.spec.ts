import { expect, test } from "@playwright/test";
import { askForRun } from "./api";
import { GRAPH } from "./explorer";

/**
 * Activity is the shell's page on a Graph: six tabs, each a path, the bell in
 * the header as the way in. A row of its Runs journal opens the run's page in
 * Agents › Runs, where every run is read.
 */

test("the bell opens the tray, the tray opens the Inbox, and each tab is a path", async ({
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

	await page.getByRole("tab", { name: "Channels" }).click();
	await expect(page).toHaveURL(`${GRAPH}/activity/channels`);

	await page.getByRole("tab", { name: "Events" }).click();
	await expect(page).toHaveURL(`${GRAPH}/activity/events`);
	await page.getByRole("tab", { name: "Runs" }).click();
	await expect(page).toHaveURL(`${GRAPH}/activity/runs`);
	await expect(
		page.getByLabel("Breadcrumb").getByText("Runs", { exact: true }),
	).toBeVisible();
});

test("a journal row opens its run's page in Agents, and it survives a reload", async ({
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
		new RegExp(`${GRAPH}/agents/runs\\?page=run%3A[^&]+`),
	);
	const url = page.url();
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
	// The run page's own tabs; Activity's strip is not there.
	await expect(page.getByRole("tab", { name: "Ledger" })).toBeVisible();
	await expect(page.getByRole("tab", { name: "Inbox" })).toHaveCount(0);

	await page.reload();
	await expect(page).toHaveURL(url);
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
});
