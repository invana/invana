/**
 * The agent page (the-agent-page.md): *New agent* opens a draft on its
 * builder, *Create agent* makes it live, and the open tab rides `?tab=`
 * through a reload.
 *
 * Every agent here is made by the spec and deleted in `finally`. Nothing calls
 * a model: an agent with no eval cases passes the gate unchecked. Needs
 * `demos/airways`.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const AGENTS = `${GRAPH}/agents`;

async function makeDraft(page: Page): Promise<string> {
	const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = await graphApi<{ id: string }>(page, "/agents", {
		method: "POST",
		data: { name: `e2e-page-${stamp}`, instructions: "Answer briefly." },
	});
	return made.id;
}

async function dropAgent(page: Page, id: string | null) {
	if (!id) return;
	await graphApi(page, `/agents/${id}`, { method: "DELETE" }).catch(() => {});
}

test("New agent opens a draft on its builder", async ({ page }) => {
	let id: string | null = null;
	try {
		await page.goto(`${AGENTS}/agents`);
		await page
			.getByRole("button", { name: "New agent" })
			.click({ timeout: 30_000 });
		await expect(page).toHaveURL(/[?&]page=agent(:|%3A)/, { timeout: 15_000 });
		id =
			decodeURIComponent(page.url()).match(/page=agent:([^&]+)/)?.[1] ?? null;
		await expect(
			page.getByText("untitled", { exact: true }).first(),
		).toBeVisible();
		await expect(
			page.getByText("draft", { exact: true }).first(),
		).toBeVisible();
		await expect(page.getByText("Identity", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Create agent" }),
		).toBeVisible();
	} finally {
		await dropAgent(page, id);
	}
});

test("Create agent makes the draft live", async ({ page }) => {
	const id = await makeDraft(page);
	try {
		await page.goto(`${AGENTS}/agents?page=agent:${id}`);
		await page
			.getByRole("button", { name: "Create agent" })
			.click({ timeout: 30_000 });
		await expect(page.getByText(/^\w+ · v\d+$/).first()).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("button", { name: "Create agent" }),
		).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
	} finally {
		await dropAgent(page, id);
	}
});

test("a tab switch writes ?tab= and a reload keeps it", async ({ page }) => {
	const id = await makeDraft(page);
	try {
		await page.goto(`${AGENTS}/agents?page=agent:${id}`);
		await page.getByRole("tab", { name: "Limits" }).click({ timeout: 30_000 });
		await expect(page).toHaveURL(/[?&]tab=limits/);
		await page.reload();
		await expect(page.getByRole("tab", { name: "Limits" })).toHaveAttribute(
			"aria-selected",
			"true",
			{ timeout: 30_000 },
		);
		await expect(page.getByText("When it reaches a limit")).toBeVisible();
	} finally {
		await dropAgent(page, id);
	}
});
