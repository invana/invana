/**
 * IAM › Tokens: the page lists the tokens that reach the Graph, and
 * `?new=1` opens *New token* as a modal that closes back to the list.
 *
 * Nothing is minted: the modal is opened and cancelled. Needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

const TOKENS = `${GRAPH}/iam/tokens`;

test("Tokens lists every token that reaches the Graph", async ({ page }) => {
	await page.goto(TOKENS);
	await expect(
		page
			.getByRole("columnheader", { name: "Narrowed to" })
			.or(page.getByText("No tokens reach this Graph yet", { exact: true }))
			.first(),
	).toBeVisible({ timeout: 30_000 });
	await expect(
		page.getByRole("button", { name: "New token" }).first(),
	).toBeVisible();
});

test("?new=1 opens New token as a modal, and Cancel drops the param", async ({
	page,
}) => {
	await page.goto(`${TOKENS}?new=1`);
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("New token", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(dialog.getByLabel("Name")).toBeVisible();
	await expect(dialog.getByLabel("Narrow to")).toBeVisible();
	await expect(dialog.getByLabel("Expires")).toHaveText(/in \d+ days|never/);

	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(page).not.toHaveURL(/[?&]new=1/);
});
