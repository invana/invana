/**
 * The two places — the launcher lists the platform alone with no Graph open
 * and both groups inside one; `/profile` is the signed-in user's page; the
 * paths the Agents product no longer serves give no page, and no redirect.
 */
import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

const GRAPH_ITEMS = ["Modeller", "Explorer", "Projects", "Activity", "IAM"];

test("with no Graph open the launcher lists only the platform", async ({
	page,
}) => {
	await page.goto("/fleet");
	await page.getByRole("button", { name: "Products" }).click();
	await expect(page.getByRole("group", { name: "Invana" })).toBeVisible();
	await expect(page.getByRole("group", { name: "This Graph" })).toHaveCount(0);
	await expect(page.getByText(/This Graph ·/)).toHaveCount(0);
});

test("inside airways the launcher lists Invana, then This Graph", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/activity/runs`);
	await page.getByRole("button", { name: "Products" }).click();
	const invana = page.getByRole("group", { name: "Invana" });
	const here = page.getByRole("group", { name: "This Graph" });
	await expect(invana).toBeVisible();
	await expect(here).toBeVisible();
	await expect(here).toContainText(/This Graph · airways/);
	for (const name of GRAPH_ITEMS) {
		await expect(here.getByText(name, { exact: true }).first()).toBeVisible();
	}
	// Invana comes first.
	const boxes = [await invana.boundingBox(), await here.boundingBox()];
	expect(boxes[0]?.y).toBeLessThan(boxes[1]?.y ?? 0);
	// The platform group carries no Graph's products.
	await expect(invana.getByText("Activity", { exact: true })).toHaveCount(0);
});

test("/profile opens the signed-in user's page", async ({ page }) => {
	await page.goto("/profile");
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.getByText(/not found/i)).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Switch graph" })).toHaveCount(
		0,
	);
});

for (const section of [
	"runs",
	"approvals",
	"ledger",
	"workers",
	"functions/plugins",
]) {
	test(`the old Agents path ${section} gives no page and no redirect`, async ({
		page,
	}) => {
		const old = `${GRAPH}/agents/${section}`;
		await page.goto(old);
		await page.waitForTimeout(1500);
		expect(new URL(page.url()).pathname).toBe(old);
		await expect(page.getByText(/not found/i).first()).toBeVisible();
	});
}
