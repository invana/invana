/**
 * Verification for the lens-board pass — **not a repo test**. Untracked.
 * Proves WO15 · GR14 · WO16 against the running stack and this dev Graph.
 */
import { expect, test } from "@playwright/test";

const GRAPH = "/u/admin/airways";
const WORLD = "EU · H1 2026";
const GUARDRAIL = "Airways guardrails";

test("WO15 — drilling into a world opens a board named for the world", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=govern&drawer=worlds`);
	await page.getByRole("button", { name: new RegExp(`^${WORLD}`) }).click();

	// The tab carries the world's own name, never `World`.
	await expect(page.getByRole("tab", { name: new RegExp(WORLD) })).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByRole("tab", { name: /^World$/ })).toHaveCount(0);

	// **The drill-in survives the board opening.** The two are two keys of one
	// URL, and the drawer header still reads `WORLDS / EU · H1 2026`.
	expect(new URL(page.url()).searchParams.get("world")).toBeTruthy();
	// The drilled header — `WORLDS / EU · H1 2026`. (The kit's icon-only header
	// actions carry no accessible name, so `‹ Back` is not locatable by role.)
	await expect(page.getByText(WORLD).first()).toBeVisible();

	// The board is the auditing reading: the record, the layers, the rules.
	await expect(page.getByText("The record", { exact: true })).toBeVisible();
	await expect(
		page.getByText("The five layers", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Save report", exact: true }),
	).toBeVisible();
});

test("WO15 — the page id is world:<id>, and a reload lands on it", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=govern&drawer=worlds`);
	await page.getByRole("button", { name: new RegExp(`^${WORLD}`) }).click();
	await expect(page.getByText("The record", { exact: true })).toBeVisible({
		timeout: 20_000,
	});

	const url = new URL(page.url());
	expect(url.searchParams.get("page")).toMatch(/^world:/);

	await page.reload();
	await expect(page.getByText("The record", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
});

test("WO15 — a cold link with a drill-in arrives with its board open", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=govern&drawer=worlds`);
	await page.getByRole("button", { name: new RegExp(`^${WORLD}`) }).click();
	await expect(page.getByText("The record", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	const lensId = new URL(page.url()).searchParams.get("world");

	// The drill-in alone — no `?page=`. The board is opened by what is drilled
	// into, so a shared link lands on both.
	await page.goto(`${GRAPH}?panel=govern&drawer=worlds&world=${lensId}`);
	await expect(page.getByRole("tab", { name: new RegExp(WORLD) })).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText("The record", { exact: true })).toBeVisible();
});

test("GR14 — a guardrail opens the same board, under its own name", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=govern&drawer=guardrails`);
	await page.getByRole("button", { name: new RegExp(`^${GUARDRAIL}`) }).click();

	await expect(
		page.getByRole("tab", { name: new RegExp(GUARDRAIL) }),
	).toBeVisible({ timeout: 20_000 });
	// The guardrail's usage band says what it is, not how many picked it.
	await expect(page.getByText("In force", { exact: true })).toBeVisible();
	// The caption, and the closing sentence that repeats the claim.
	await expect(
		page.getByText("a guardrail is not a world you pick").first(),
	).toBeVisible();
});

test("WO16 — Edit puts the drawer back on the lens, drilled in", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=govern&drawer=worlds`);
	await page.getByRole("button", { name: new RegExp(`^${WORLD}`) }).click();
	await expect(
		page.getByRole("button", { name: "Edit", exact: true }),
	).toBeVisible({ timeout: 20_000 });
	await page.getByRole("button", { name: "Edit", exact: true }).click();

	const url = new URL(page.url());
	expect(url.searchParams.get("panel")).toBe("govern");
	expect(url.searchParams.get("drawer")).toBe("worlds");
	expect(url.searchParams.get("world")).toBeTruthy();
});

test("spec.json — the board can show the document it is", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=govern&drawer=worlds`);
	await page.getByRole("button", { name: new RegExp(`^${WORLD}`) }).click();
	const specTab = page.getByText("spec.json", { exact: true });
	await expect(specTab).toBeVisible({ timeout: 20_000 });
	await specTab.click();
	// The one panel `spec.json` renders — the very document being looked at.
	await expect(page.getByText("the document this page renders")).toBeVisible();
});
