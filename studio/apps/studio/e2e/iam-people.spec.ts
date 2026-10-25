/**
 * IAM › People lists the Graph's members, and IAM › Agents lists its agents;
 * a row opens the agent's effective access as a tab of its own.
 *
 * Nothing is written. Needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

const IAM = `${GRAPH}/iam`;

test("People lists admin, with the kind tabs", async ({ page }) => {
	await page.goto(`${IAM}/people`);
	await expect(
		page.getByRole("row").filter({ hasText: "admin" }).first(),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText(/^Service accounts \d+$/).first()).toBeVisible();
});

test("IAM Agents lists Explorer and opens its effective access", async ({
	page,
}) => {
	await page.goto(`${IAM}/agents`);
	const row = page.getByRole("row").filter({ hasText: "Explorer" }).first();
	await row.click({ timeout: 30_000 });
	await expect(page).toHaveURL(/[?&]page=iam_agent(:|%3A)/);
	await expect(
		page.getByRole("columnheader", { name: "Why not" }).first(),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("Who it may delegate to")).toBeVisible();
});
