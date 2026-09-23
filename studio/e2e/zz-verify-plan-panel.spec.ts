/**
 * Verification for the Plans panel pass — **not a repo test**.
 *
 * It drives this machine's dev Graph against the running stack to prove the
 * panel draws what the design draws: *The plan*, *Layers it declares* with a
 * row per governed band, and *Used by*. Untracked on purpose.
 */
import { expect, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

test("the plan panel draws the five bands it declares", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=library&drawer=plans`);

	const row = page.getByRole("button", { name: /nl-single/ }).first();
	await expect(row).toBeVisible({ timeout: 30_000 });
	await row.click();

	// The record names itself: the key, its version and that it is published.
	await expect(page.getByText("nl-single@2").first()).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText("published")).toBeVisible();
	await expect(page.getByText("Layers it declares")).toBeVisible();
	for (const band of ["graph data", "llm", "third party", "cache", "human"]) {
		await expect(page.getByText(band, { exact: true }).first()).toBeVisible();
	}
	await expect(page.getByText("The plan")).toBeVisible();
	await page.screenshot({
		path: "/private/tmp/claude-501/-Users-ravi-merugu-Projects-invana-invana/ee93e86f-adfa-485c-8ed9-83cbe5a20207/scratchpad/plan-panel-top.png",
	});

	// The record scrolls in its drawer: *Used by* and the behaviour band are
	// below the fold at 420px, and reaching them is the panel working, not a
	// fault.
	const usedBy = page.getByText("Used by", { exact: true });
	await usedBy.scrollIntoViewIfNeeded();
	await expect(usedBy).toBeVisible();
	// The dev Graph has one caller: a skill inlines `nl-single` and tunes the
	// one argument the plan declares — LB19 on real rows.
	await expect(page.getByText("Brief the route desk")).toBeVisible();
	await expect(page.getByText("read_only false")).toBeVisible();
	await expect(page.getByText("How it has behaved")).toBeVisible();
	await page.screenshot({
		path: "/private/tmp/claude-501/-Users-ravi-merugu-Projects-invana-invana/ee93e86f-adfa-485c-8ed9-83cbe5a20207/scratchpad/plan-panel-foot.png",
		fullPage: false,
	});
});

test("a library row carries the bands it will engage", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=library&drawer=plans`);
	const row = page.getByRole("button", { name: /nl-single/ }).first();
	await expect(row).toBeVisible({ timeout: 30_000 });
	// The bands are on the row, not only in the detail — *what will this cost
	// me* is the question the list is scanned with.
	await expect(row.getByText("graph data")).toBeVisible();
	await expect(row.getByText(/used by 1 caller|ran \d/)).toBeVisible();
	await page.screenshot({
		path: "/private/tmp/claude-501/-Users-ravi-merugu-Projects-invana-invana/ee93e86f-adfa-485c-8ed9-83cbe5a20207/scratchpad/plan-rows.png",
	});
});
