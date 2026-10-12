/**
 * Agents › LLMs as a page of its own (AG-14), and an agent's budget read in
 * tokens.
 *
 * The budget test makes its agent through the API with an `e2e-` name and
 * deletes it in `finally`. Nothing here configures an endpoint or calls a
 * model. Needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const AGENTS = `${GRAPH}/agents`;
const LLMS = `${AGENTS}/llms`;

test("AG-14 LLMs is a page, and an endpoint opens in a sheet over it", async ({
	page,
}) => {
	await page.goto(LLMS);
	await expect(
		page.getByText("A run records the version it used", { exact: false }),
	).toBeVisible({ timeout: 30_000 });
	// The table, or the sentence that stands in for it when nothing is configured.
	await expect(
		page
			.getByText("Model versions", { exact: true })
			.or(page.getByText(/^None configured/)),
	).toBeVisible();

	await page.getByRole("button", { name: "Add endpoint" }).first().click();
	await expect(page).toHaveURL(new RegExp(`${LLMS}/new(\\?|$)`));
	const sheet = page.getByRole("dialog");
	await expect(sheet.getByText("New endpoint", { exact: true })).toBeVisible();
	await expect(sheet.getByRole("button", { name: "Cancel" })).toBeVisible();

	await sheet.getByRole("button", { name: "Close" }).click();
	await expect(page).toHaveURL(new RegExp(`${LLMS}(\\?|$)`));
	await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("AG-14 the Agents panel holds the agents alone", async ({ page }) => {
	await page.goto(`${AGENTS}/agents`);
	await expect(page.getByText("Agents", { exact: true }).first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("button", { name: "Add endpoint" })).toHaveCount(
		0,
	);
	await expect(page.getByText(/\d+ endpoints? · \d+ models?/)).toHaveCount(0);
});

test("an agent's budget reads in tokens, never money", async ({ page }) => {
	const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = await graphApi<{ id: string }>(page, "/agents", {
		method: "POST",
		data: {
			name: `e2e-budget-${stamp}`,
			instructions: "Answer briefly.",
			budget: { max_tokens_run: 8000 },
		},
	});
	try {
		await page.goto(`${AGENTS}/agents?page=agent:${made.id}`);
		await expect(page.getByText("up to 8k tokens a run").first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.locator("body")).not.toContainText("$");
	} finally {
		await graphApi(page, `/agents/${made.id}`, { method: "DELETE" }).catch(
			() => {},
		);
	}
});
