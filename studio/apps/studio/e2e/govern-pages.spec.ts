/**
 * The Govern pages — Worlds and Guardrails, each the lens canvas with its
 * inspector, and the rule dialog's refusal.
 *
 * Each spec makes the world or guardrail it reads through the API and removes
 * it after, so a stack with only `demos/airways` loaded passes.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

interface Target {
	target: string;
}
interface GuardrailRow {
	id: string;
	name: string;
	target: string;
}

/** A guardrail on a target nothing guards yet. */
async function makeGuardrail(page: Page): Promise<GuardrailRow> {
	const targets = await graphApi<Target[]>(page, "/govern/guardrails/targets");
	const held = await graphApi<{ items: GuardrailRow[] }>(
		page,
		"/govern/guardrails",
	);
	const taken = new Set(held.items.map((g) => g.target));
	const free = targets.find((t) => !taken.has(t.target));
	test.skip(!free, "every published property is already guarded");
	return graphApi<GuardrailRow>(page, "/govern/guardrails", {
		method: "POST",
		data: { target: free?.target, access: "counts", leaves: false },
	});
}

test("a guardrail opens its inspector beside the lens canvas", async ({
	page,
}) => {
	const g = await makeGuardrail(page);
	try {
		await page.goto(`${GRAPH}/modeller/guardrails/${g.id}`);
		const inspector = page.locator("aside").filter({ hasText: "Applies to" });
		await expect(inspector).toBeVisible({ timeout: 30_000 });
		await expect(inspector.getByText(g.name).first()).toBeVisible();
		await expect(inspector.getByText(/Read in counts only/)).toBeVisible();
		await expect(
			inspector.getByRole("tab", { name: "Refusals" }),
		).toBeVisible();
		await expect(page.getByText(/guarded/).first()).toBeVisible();
	} finally {
		await graphApi(page, `/govern/guardrails/${g.id}`, { method: "DELETE" });
	}
});

test("a rule that narrows nothing is refused in the dialog", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/modeller/guardrails`);
	await page
		.getByRole("button", { name: "New rule" })
		.click({ timeout: 30_000 });
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("New guardrail rule")).toBeVisible();
	await dialog.getByLabel("When a run touches").click();
	await page.getByRole("option").first().click();
	await dialog.getByRole("radio", { name: "Read", exact: true }).click();
	await dialog.getByRole("radio", { name: "May leave" }).click();
	await expect(dialog.getByText(/Impact before saving/)).toBeVisible();
	await dialog.getByRole("button", { name: "Save rule" }).click();
	await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 15_000 });
	await expect(dialog).toBeVisible();
});

test("a world is read on the model with its inspector", async ({ page }) => {
	const name = `e2e world ${Date.now()}`;
	const world = await graphApi<{ id: string }>(page, "/govern/lenses", {
		method: "POST",
		data: { name, kind: "world", rules: [] },
	});
	try {
		await page.goto(`${GRAPH}/modeller/worlds/${world.id}`);
		const inspector = page.locator("aside").filter({ hasText: "Sees" });
		await expect(inspector.getByText(name).first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(inspector.getByText("world", { exact: true })).toBeVisible();
		await expect(
			inspector.getByRole("button", { name: "Open board" }),
		).toBeVisible();
		await inspector.getByRole("tab", { name: "Answers go" }).click();
		await expect(
			inspector.getByRole("tab", { name: "Answers go" }),
		).toHaveAttribute("data-state", "active");
	} finally {
		await graphApi(page, `/govern/lenses/${world.id}`, { method: "DELETE" });
	}
});
