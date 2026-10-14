import { expect, test } from "@playwright/test";
import { askForRun } from "./api";
import { GRAPH } from "./explorer";

/**
 * Activity is the shell's page on a Graph: seven tabs, each a path, the bell
 * in the header as the way in, and a run's page inside the Runs tab.
 */

test("the bell opens the Inbox, and each tab is a path", async ({ page }) => {
	await page.goto(GRAPH);
	await page
		.getByRole("link", { name: "Notifications" })
		.click({ timeout: 30_000 });
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

test("a run's page lives at its path and survives a reload", async ({
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
	await expect(page).toHaveURL(new RegExp(`${GRAPH}/activity/runs/[^/?]+$`));
	const url = page.url();
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
	// The run page owns the main area: its own tabs, no Activity strip above,
	// and the crumb reads the run's short address.
	await expect(page.getByRole("tab", { name: "Log" })).toBeVisible();
	await expect(page.getByRole("tab", { name: "Inbox" })).toHaveCount(0);
	await expect(
		page.getByLabel("Breadcrumb").getByText(/^run:[0-9a-f]{8}$/),
	).toBeVisible();

	await page.reload();
	await expect(page).toHaveURL(url);
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
	await page
		.getByLabel("Breadcrumb")
		.getByRole("link", { name: "Runs" })
		.click();
	await expect(page).toHaveURL(`${GRAPH}/activity/runs`);
});
