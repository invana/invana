/**
 * Agents › LLMs as a section page, its endpoint as a modal in the path, and an
 * agent's budget read in tokens.
 *
 * The endpoint and the agent are made through the API with an `e2e-` name and
 * deleted in `finally`. Nothing here calls a model. Needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const AGENTS = `${GRAPH}/agents`;
const LLMS = `${AGENTS}/llms`;

test("LLMs is a page, and adding an endpoint is a modal outside the path", async ({
	page,
}) => {
	await page.goto(LLMS);
	await expect(
		page
			.getByText("Model versions", { exact: true })
			.or(page.getByText("No endpoints", { exact: true }))
			.first(),
	).toBeVisible({ timeout: 30_000 });

	await page.getByRole("button", { name: "Add endpoint" }).first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Add an endpoint")).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`${LLMS}(\\?|$)`));

	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("an endpoint opens as a modal in the path, and a reload keeps it open", async ({
	page,
}) => {
	const name = `e2e-${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = await graphApi<{ id: string }>(page, "/llm", {
		method: "POST",
		data: {
			name,
			provider: "ollama",
			base_url: "http://localhost:11434",
			models: [{ model_id: "e2e-model" }],
		},
	});
	try {
		await page.goto(LLMS);
		await page
			.getByRole("button", { name: `Open ${name}` })
			.click({ timeout: 30_000 });
		await expect(page).toHaveURL(new RegExp(`${LLMS}/${made.id}(\\?|$)`));
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("e2e-model").first()).toBeVisible();
		// The trail names the endpoint by its name, never its id.
		const crumbs = page.getByLabel("Breadcrumb");
		await expect(crumbs.getByText(name, { exact: true })).toBeVisible();
		await expect(crumbs.getByText(made.id, { exact: true })).toHaveCount(0);

		await page.reload();
		await expect(
			page.getByRole("dialog").getByText("e2e-model").first(),
		).toBeVisible({ timeout: 30_000 });

		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Cancel" })
			.click();
		await expect(page).toHaveURL(new RegExp(`${LLMS}(\\?|$)`));
		await expect(page.getByRole("dialog")).toHaveCount(0);
	} finally {
		await graphApi(page, `/llm/${made.id}`, { method: "DELETE" }).catch(
			() => {},
		);
	}
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
