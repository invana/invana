/**
 * The model page (1.8 · the-model-page.md) — Models as one page, the model a
 * filter on it.
 *
 * Needs `demos/airways`: four published models, stitched to each other. The
 * refusal changes nothing — an archive refused leaves the model where it was.
 */
import { type Page, expect, test } from "@playwright/test";
import { ask } from "./explorer";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

async function openModels(page: Page) {
	await page.goto(`${GRAPH}?panel=model`);
	await expect(page.getByRole("tab", { name: "All models" })).toBeVisible({
		timeout: 30_000,
	});
}

const row = (page: Page, name: string) =>
	page.getByRole("button", { name: new RegExp(`^${name}`) }).first();

test("a click scopes the page, Open drills in, and a reload lands on the same reading", async ({
	page,
}) => {
	await openModels(page);
	await expect(page.getByText("Each model")).toBeVisible();

	// A click selects: the board is re-read at that model, the tab kept (MP5).
	await row(page, "AirRoutes").click();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible();
	await expect(page.getByText("Each type")).toBeVisible();

	// `Open` drills the panel in and turns the page to the Model tab.
	await page.getByRole("button", { name: "Open", exact: true }).click();
	await expect(page.getByText("Node types").first()).toBeVisible();
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText(/\d+ nodes and \d+ edges rendered/)).toBeVisible({
		timeout: 20_000,
	});

	// Scope, tab and panel are the URL's.
	await page.reload();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText("Node types").first()).toBeVisible();
});

test("archiving a model an active stitch binds is refused, naming the stitches", async ({
	page,
}) => {
	await openModels(page);
	await row(page, "NewsArticles").click();
	await expect(page.getByRole("tab", { name: "NewsArticles" })).toBeVisible();

	await page.getByRole("button", { name: "More actions" }).click();
	await page.getByRole("menuitem", { name: "Archive" }).click();

	const card = page.getByRole("dialog", { name: "Archive NewsArticles" });
	await expect(card).toBeVisible({ timeout: 20_000 });
	await expect(card.getByText(/^refused · \d+ active stitch/)).toBeVisible();
	await expect(card.getByText(/NewsArticles\.\w+/).first()).toBeVisible();
	await card.getByRole("button", { name: "Close" }).first().click();

	// Nothing moved: the model is still listed.
	await expect(row(page, "NewsArticles")).toBeVisible();
});

// ── B · Database ─────────────────────────────────────────────────────────────

test("the Database tab marks each label against the models, unmodelled first", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=model&models_tab=database`);
	await expect(page.getByRole("tab", { name: "All models" })).toBeVisible({
		timeout: 30_000,
	});
	const never = page.getByText("Never introspected");
	if (await never.isVisible({ timeout: 5_000 }).catch(() => false)) {
		// A fresh Graph has no mirror yet; Introspect is what captures one.
		await page.getByRole("button", { name: "Introspect" }).click();
		await expect(never).toBeHidden({ timeout: 30_000 });
	}
	await expect(page.getByText(/captured .* by introspect/)).toBeVisible();
	await expect(page.getByText("Labels", { exact: true })).toBeVisible();
	await expect(page.getByText(/\d+ modelled · \d+ not/).first()).toBeVisible();
	await expect(page.getByText("● in both").nth(3)).toBeVisible();
	// Neo4j lists its indexes, so they are read, never "not reported" (MP26).
	await expect(
		page.getByText(/\d+ declared · \d+ in the database/).first(),
	).toBeVisible();
});

test("one model's Database tab leaves out what no model declares", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=model&models_tab=database`);
	await expect(page.getByText("Labels", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await row(page, "AirRoutes").click();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible();
	await expect(page.getByText(/\d+ modelled · 0 not/).first()).toBeVisible();
	await expect(page.getByText("no model")).toHaveCount(0);
});

// ── C · Growth ───────────────────────────────────────────────────────────────

test("Growth stacks records by model, each write marked and named", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=model&models_tab=growth`);
	await expect(page.getByText("Records over time, by model")).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Each model")).toBeVisible();
	// Each row names the act that last wrote it, and it opens that run.
	await expect(
		page.getByRole("button", { name: /^(import|stitch commit) · / }).first(),
	).toBeVisible();
	await expect(
		page.getByText(/\d+ imports? · \d+ stitch commits?/),
	).toBeVisible();
});

test("a model nothing was counted for draws no chart of zeros", async ({
	page,
}) => {
	const name = `E2E Growth ${Date.now()}`;
	await page.goto(`${GRAPH}?panel=model&models_tab=growth`);
	await expect(page.getByText("Records over time, by model")).toBeVisible({
		timeout: 30_000,
	});
	await page.getByRole("button", { name: "New model", exact: true }).click();
	await page.getByRole("textbox", { name: "Name" }).fill(name);
	await page.getByRole("button", { name: "Create model" }).click();

	await row(page, name).click();
	await expect(page.getByText(`${name} has no records yet`)).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText("Records over time")).toHaveCount(0);

	// Never published, so it is deleted rather than archived (MP7).
	await page.getByRole("button", { name: "More actions" }).click();
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await page.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(row(page, name)).toHaveCount(0);
});

// ── D · Usage and Performance ────────────────────────────────────────────────

test("Performance groups queries by shape, and a picked shape shows its plan", async ({
	page,
}) => {
	// Opening the Graph counts its types — an Explorer read, and so a logged one.
	await page.goto(GRAPH);
	await page.waitForTimeout(3_000);
	await page.goto(`${GRAPH}?panel=model&models_tab=performance`);
	await expect(page.getByText("Query shapes")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("p95 a day")).toBeVisible();

	await page
		.getByText(/^MATCH /)
		.first()
		.click();
	const card = page.getByRole("dialog", { name: "A query shape" });
	await expect(card).toBeVisible({ timeout: 20_000 });
	await expect(card.getByText("Slowest calls")).toBeVisible();
	// Neo4j explains, so the plan is drawn and advice is not refused (MP38 · MP39).
	await expect(card.getByText("The plan", { exact: true })).toBeVisible();
	await expect(card.getByText(/Advice is not available/)).toHaveCount(0);
});

test("Usage calls nothing unused below 50 queries", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=model&models_tab=usage`);
	await expect(page.getByText("Each model")).toBeVisible({ timeout: 30_000 });
	const tooFew = page.getByText(/too few to call anything unused/);
	const unused = page.getByText("Unused types").locator("..");
	if (await tooFew.isVisible()) {
		await expect(page.getByText("needs 50 queries").first()).toBeVisible();
		await expect(unused).toContainText("—");
	} else {
		await expect(unused).toContainText(/\d/);
	}
});

// ── D · Advice ───────────────────────────────────────────────────────────────
//
// Advice is read off logged query-language asks, so each test asks first. The
// asks leave their sessions behind, as the Explorer specs' do.

/** Ask in query language, then open the Performance card of that shape. */
async function adviceFor(page: Page, query: string, shape: RegExp) {
	await ask(page, query);
	await expect(page.getByText(/\d+ rows?/).last()).toBeVisible({
		timeout: 60_000,
	});
	// The log is written off the query's path (MP36), so the shape may land a
	// beat after the reply.
	await expect(async () => {
		await page.goto(`${GRAPH}?panel=model&models_tab=performance`);
		await expect(page.getByText(shape).first()).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({ timeout: 30_000 });
	await page.getByText(shape).first().click();
	const card = page.getByRole("dialog", { name: "A query shape" });
	await expect(card).toBeVisible({ timeout: 20_000 });
	return card;
}

test("Add index to draft stages the index on the model that declares the label", async ({
	page,
}) => {
	const card = await adviceFor(
		page,
		"MATCH (a:airport) WHERE a.city = 'Austin' RETURN a.code",
		/a\.city = \$p0/,
	);
	await expect(card.getByText("airport.city has no index.")).toBeVisible();
	await card.getByRole("button", { name: "Add index to draft" }).click();

	// The page is scoped to the model, with the index staged on its draft (MP13).
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible();
	const chip = page.getByText("airport_city", { exact: true });
	await expect(chip).toBeVisible({ timeout: 20_000 });

	// Publishing would create it — the confirm says so, and is cancelled.
	await page.getByRole("button", { name: "Publish", exact: true }).click();
	const confirm = page.getByRole("dialog", { name: "Publish AirRoutes" });
	await expect(
		confirm.getByText("CREATE RANGE INDEX airport_city ON airport(city)"),
	).toBeVisible();
	await confirm.getByRole("button", { name: "Cancel" }).click();

	// Only what this test staged is discarded; the draft is left as it was found.
	await page.getByRole("button", { name: "Discard this change" }).click();
	await expect(chip).toHaveCount(0);
});

test("advice on a label no model declares names it and offers nothing", async ({
	page,
}) => {
	const card = await adviceFor(
		page,
		"MATCH (g:E2eUnmodelled) WHERE g.name = 'A1' RETURN g",
		/g:E2eUnmodelled/,
	);
	await expect(
		card.getByText("E2eUnmodelled.name has no index."),
	).toBeVisible();
	await expect(
		card.getByText("No model declares E2eUnmodelled."),
	).toBeVisible();
	await expect(
		card.getByRole("button", { name: "Add index to draft" }),
	).toHaveCount(0);
});
