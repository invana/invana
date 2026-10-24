/**
 * Agents › instructions, evals, history, plugins and pinned models — one test
 * per story (AG-04 · AG-06 · AG-08 · AG-09 · AG-11 · AG-13 · AG-14).
 *
 * The agent each test needs is made through the API with an `e2e-` name and
 * deleted in `finally`. Nothing here calls a live model: a publish with no
 * eval set passes the gate unchecked, and the skill stories read a seeded
 * skill rather than drawing a new plan. Needs `demos/airways`.
 */
import { expect, type Page, test } from "@playwright/test";
import { api, graphApi, skillNamed } from "./api";
import { GRAPH } from "./explorer";

const AGENTS = `${GRAPH}/agents`;

async function makeAgent(page: Page, tag: string): Promise<string> {
	const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = await graphApi<{ id: string }>(page, "/agents", {
		method: "POST",
		data: { name: `e2e-${tag}-${stamp}`, instructions: "Answer briefly." },
	});
	return made.id;
}

async function dropAgent(page: Page, id: string) {
	await graphApi(page, `/agents/${id}`, { method: "DELETE" }).catch(() => {});
}

async function openAgentTab(page: Page, id: string, tab: string) {
	await page.goto(`${AGENTS}/agents?page=agent:${id}`);
	await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click({
		timeout: 30_000,
	});
}

test("AG-04 · AG-06 a draft publishes and History names the change", async ({
	page,
}) => {
	const id = await makeAgent(page, "publish");
	try {
		await openAgentTab(page, id, "Instructions");
		await page.getByRole("button", { name: "Edit", exact: true }).click();
		await page
			.getByRole("textbox", { name: "instructions.md" })
			.fill("Answer briefly, and cite every record.");
		await page.getByRole("button", { name: "Save draft" }).click();
		await expect(page.getByText("draft · nothing runs on it")).toBeVisible();

		await page.getByRole("button", { name: "Publish", exact: true }).click();
		await page
			.getByLabel("Why — kept in History")
			.fill("Readers ask for sources");
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Publish" })
			.click();
		await expect(
			page.getByText("Answer briefly, and cite every record."),
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText("draft · nothing runs on it")).toHaveCount(0);

		await page.getByRole("tab", { name: "History" }).click();
		await expect(page.getByText("instructions changed").first()).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByText("Readers ask for sources")).toBeVisible();
	} finally {
		await dropAgent(page, id);
	}
});

test("AG-08 an eval case is added through the panel", async ({ page }) => {
	const id = await makeAgent(page, "evals");
	try {
		await openAgentTab(page, id, "Instructions");
		await page.getByRole("button", { name: "Add a case" }).click();
		await page.getByLabel("Question").fill("Which routes leave LHR?");
		await page.getByRole("button", { name: "Add case" }).click();
		await expect(
			page.getByRole("cell", { name: "Which routes leave LHR?", exact: true }),
		).toBeVisible({ timeout: 15_000 });
	} finally {
		await dropAgent(page, id);
	}
});

test("AG-09 a skill's History lists its versions", async ({ page }) => {
	const id = await skillNamed(page, "Answer in natural language");
	await page.goto(`${AGENTS}/skills?page=skill:${id}`);
	await page.getByRole("tab", { name: "History" }).click({ timeout: 30_000 });
	await expect(page.getByText("Changes", { exact: true })).toBeVisible();
	await expect(page.getByRole("cell", { name: /^v\d+$/ }).first()).toBeVisible({
		timeout: 15_000,
	});
	await page.getByRole("tab", { name: /^Plan/ }).click();
	await expect(page.getByText(/\d+ steps? · \d of 6 layers/)).toBeVisible({
		timeout: 15_000,
	});
});

test("AG-11 a plan with no replanned run says so", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=library&section=plans`);
	const row = page.getByRole("button", { name: /^expand-neighbours/ }).first();
	await row.click({ timeout: 30_000 });
	await page.getByRole("tab", { name: "Revisions in runs" }).click({
		timeout: 20_000,
	});
	await expect(page.getByText("No run replanned")).toBeVisible({
		timeout: 20_000,
	});
});

test("AG-13 Plugins lists the registry; a plugin and a function open", async ({
	page,
}) => {
	const registry = await api<{ items: { name: string; task_types: number }[] }>(
		page,
		"/plugins",
	);
	const core = registry?.items.find(
		(p) => p.name.startsWith("invana.core.") && p.task_types > 0,
	);
	expect(core, "a core plugin with functions").toBeTruthy();
	const name = (core as { name: string }).name;

	await page.goto(`${AGENTS}/plugins`);
	await page.getByRole("button", { name: new RegExp(`^${name}`) }).click({
		timeout: 30_000,
	});
	await expect(page.getByText("Functions", { exact: true })).toBeVisible({
		timeout: 15_000,
	});
	await page.getByRole("row").nth(1).click();
	await expect(page.getByText("Manifest", { exact: true })).toBeVisible({
		timeout: 15_000,
	});
	await expect(
		page.getByText(/each run records the version it used/),
	).toBeVisible();
});

test("AG-14 an agent pins a model version and History names it", async ({
	page,
}) => {
	const id = await makeAgent(page, "pin");
	try {
		await openAgentTab(page, id, "Thinking");
		await expect(page.getByText("Model version").first()).toBeVisible({
			timeout: 15_000,
		});
		await page.getByLabel("Move to").click();
		const option = page.getByRole("option").first();
		const address = (await option.textContent())?.trim() ?? "";
		expect(address).toMatch(/^llm\//);
		await option.click();
		await page.getByRole("button", { name: `Move to ${address}` }).click();
		await page
			.getByLabel("Why — kept in History")
			.fill("Pin for repeatability");
		await page
			.getByRole("dialog")
			.getByRole("button", { name: `Pin ${address}` })
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
		await expect(page.getByText(address).first()).toBeVisible();

		await page.getByRole("tab", { name: "History" }).click();
		await expect(page.getByText("model version changed").first()).toBeVisible({
			timeout: 15_000,
		});
	} finally {
		await dropAgent(page, id);
	}
});
