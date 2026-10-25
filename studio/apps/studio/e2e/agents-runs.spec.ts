/**
 * Agents › Runs and the run page (the-run-page.md): the list's tiles and its
 * state tab ride `?f.state=`, a filter matching nothing offers *Clear all*, a
 * run opens on its page with its tab in `?tab=`, and a run nobody can open
 * reads *not found*.
 *
 * Nothing here starts a run; the page test reads the newest run the Graph
 * already has and skips when it has none. Needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const RUNS = `${GRAPH}/agents/runs`;

test("Runs shows its tiles and the Live tab filters through the URL", async ({
	page,
}) => {
	await page.goto(RUNS);
	await expect(page.getByText("Waiting on you").first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Tokens · 24 h")).toBeVisible();
	await page.getByRole("radio", { name: "Live" }).click();
	await expect(page).toHaveURL(/[?&]f\.state=live/);
});

test("A filter that matches nothing offers Clear all", async ({ page }) => {
	await page.goto(`${RUNS}?f.agent_id=00000000-0000-0000-0000-000000000000`);
	const clear = page.getByRole("button", { name: "Clear all" }).first();
	await expect(clear).toBeVisible({ timeout: 30_000 });
	await clear.click();
	await expect(page).not.toHaveURL(/f\.agent_id=/);
});

test("A run opens on its page and keeps its tab in the URL", async ({
	page,
}) => {
	const runs = await graphApi<{ items: { id: string }[] }>(
		page,
		"/runs?limit=1",
	);
	const id = runs.items[0]?.id;
	test.skip(!id, "This Graph has no run to open");
	await page.goto(`${RUNS}?page=run:${id}`);
	await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByText("Elapsed").or(page.getByText("ETA")).first(),
	).toBeVisible();
	await page.getByRole("tab", { name: "Data touched" }).click();
	await expect(page).toHaveURL(/[?&]tab=touched/);
	await expect(page.getByText("Graph data")).toBeVisible();
	await page.reload();
	await expect(page.getByRole("tab", { name: "Data touched" })).toHaveAttribute(
		"aria-selected",
		"true",
		{ timeout: 30_000 },
	);
});

test("A run that is not in the Graph reads not found", async ({ page }) => {
	await page.goto(`${RUNS}?page=run:00000000-0000-0000-0000-000000000000`);
	await expect(page.getByText("Not found", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("button", { name: "Stop run" })).toHaveCount(0);
});
