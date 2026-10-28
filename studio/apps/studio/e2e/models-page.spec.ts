/**
 * The model page (1.8 · the-model-page.md) — Models as one page, the model a
 * filter on it.
 *
 * Needs `demos/airways`: four published models, stitched to each other. The
 * refusal changes nothing — an archive refused leaves the model where it was.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { ask } from "./explorer";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

// The Modeller's Models rail item: the models board on Overview.
async function openModels(page: Page) {
	await page.goto(`${GRAPH}/modeller/models`);
	await expect(page.getByRole("tab", { name: "All models" })).toBeVisible({
		timeout: 30_000,
	});
}

// A model is a row of *Each model*; there is no models list in the leftSection.
const row = (page: Page, name: string) =>
	page.getByRole("row", { name: new RegExp(`^${name}\\b`) }).first();

test("a click opens the model, a type opens its page, and a reload lands on the same reading", async ({
	page,
}) => {
	await openModels(page);
	await expect(page.getByText("Each model")).toBeVisible();

	// A click selects: the board is re-read at that model, the tab kept (MP5).
	await row(page, "AirRoutes").click();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible();
	await expect(page.getByText("Each type")).toBeVisible();

	// The row opens the model: its outline in the leftSection, its own head.
	await expect(page.getByText("Node types").first()).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Open in Schema" }),
	).toBeVisible();
	await expect(
		page.getByRole("tab", { name: "Model", exact: true }),
	).toHaveCount(0);

	// A type in the outline opens its page.
	await page
		.getByRole("button", { name: /^airport/ })
		.first()
		.click();
	await expect(page.getByRole("tab", { name: /^Properties/ })).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByRole("tab", { name: "Mappings" })).toBeVisible();

	// Scope, type and outline are the URL's.
	await page.reload();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("tab", { name: /^Properties/ })).toBeVisible();
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

	// Nothing moved: the model's page is still open on it.
	await expect(page.getByRole("tab", { name: "NewsArticles" })).toBeVisible();
	await expect(page.getByText("Each type")).toBeVisible();
});

test("a saved report reopens frozen, and Back to live returns to the board", async ({
	page,
}) => {
	// Reports are never deleted, so one is saved only when the Graph has none.
	const slug = GRAPH.split("/").at(-1);
	const kept = await graphApi<{ items: { id: string }[] }>(
		page,
		`/boards/models/${slug}/versions`,
	);
	if (kept.items.length) {
		await page.goto(
			`${GRAPH}/modeller/models?page=${encodeURIComponent(`models:${slug}@${kept.items[0].id}`)}`,
		);
	} else {
		await openModels(page);
		await expect(page.getByText("Each model")).toBeVisible();
		await page.getByRole("button", { name: "Save report" }).click();
	}

	// The reading, frozen: the banner, the chip, no tab strip (MP52).
	await expect(
		page.getByText(/Saved report · .* it will not change/),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("saved report", { exact: true })).toBeVisible();
	await expect(page.getByRole("tab", { name: "Usage" })).toHaveCount(0);

	await page.getByRole("button", { name: "Back to live" }).click();
	await expect(page.getByRole("tab", { name: "Usage" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/Saved report · /)).toHaveCount(0);
});

// ── B · Database ─────────────────────────────────────────────────────────────

test("the Database tab marks each label against the models, unmodelled first", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/modeller/models?models_tab=database`);
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
	await page.goto(`${GRAPH}/modeller/models?models_tab=database`);
	await expect(page.getByText("Labels", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	// Model rows are *Each model* on Overview; the tab is kept once one is read.
	await page.getByRole("tab", { name: "Overview" }).click();
	await row(page, "AirRoutes").click();
	await expect(page.getByRole("tab", { name: "AirRoutes" })).toBeVisible();
	await page.getByRole("tab", { name: "Database" }).click();
	// The scoped physical read walks the live database; it can take several seconds.
	await expect(page.getByText(/\d+ modelled · 0 not/).first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("no model")).toHaveCount(0);
});

// ── C · Growth ───────────────────────────────────────────────────────────────

test("Growth stacks records by model, each write marked and named", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/modeller/models?models_tab=growth`);
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
	const { data: model } = await graphApi<{ data: { id: string } }>(
		page,
		"/models",
		{ method: "POST", data: { name } },
	);
	try {
		await page.goto(`${GRAPH}/modeller/models`);
		await expect(row(page, name)).toBeVisible({ timeout: 30_000 });
		await row(page, name).click();
		await expect(page).toHaveURL(/model=/);
		await page.getByRole("tab", { name: "Growth" }).click();
		await expect(page.getByText(`${name} has no records yet`)).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText("Records over time")).toHaveCount(0);
	} finally {
		// Never published, so it is deleted rather than archived — even when a
		// step above failed, so no stray model is left in the Graph.
		await graphApi(page, `/models/${model.id}`, { method: "DELETE" });
	}
});

// ── D · Usage and Performance ────────────────────────────────────────────────

test("Performance groups queries by shape, and a picked shape shows its plan", async ({
	page,
}) => {
	// Opening the Graph counts its types — an Explorer read, and so a logged one.
	await page.goto(GRAPH);
	await page.waitForTimeout(3_000);
	await page.goto(`${GRAPH}/modeller/models?models_tab=performance`);
	await expect(page.getByText("Query shapes")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("p95 a day")).toBeVisible();

	// Not every shape carries a plan — which one tops the list depends on what
	// the Graph was asked lately — so open shapes until one does.
	const shapes = page.getByText(/^MATCH /);
	const card = page.getByRole("dialog", { name: "A query shape" });
	const plan = card.getByText("The plan", { exact: true });
	const count = Math.min(await shapes.count(), 10);
	let planned = false;
	for (let i = 0; i < count && !planned; i++) {
		await shapes.nth(i).click();
		await expect(card).toBeVisible({ timeout: 20_000 });
		await expect(card.getByText("Slowest calls")).toBeVisible();
		planned = await plan.isVisible();
		if (!planned) {
			await card.getByRole("button", { name: "Close" }).click();
			await expect(card).toBeHidden();
		}
	}
	// Neo4j explains, so the plan is drawn and advice is not refused (MP38 · MP39).
	expect(planned, "no shape among the first ten carries a plan").toBe(true);
	await expect(card.getByText(/Advice is not available/)).toHaveCount(0);
});

test("Usage calls nothing unused below 50 queries", async ({ page }) => {
	await page.goto(`${GRAPH}/modeller/models?models_tab=usage`);
	await expect(page.getByText("Each model")).toBeVisible({ timeout: 30_000 });
	const tooFew = page.getByText(/too few to call anything unused/);
	const unused = page.getByText("Unused types", { exact: true }).locator("..");
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
	// The reply's meta line settles every answer, an empty one too.
	await expect(page.getByText(/\d+ records? · /).last()).toBeVisible({
		timeout: 60_000,
	});
	// The log is written off the query's path (MP36), so the shape may land a
	// beat after the reply.
	await expect(async () => {
		await page.goto(`${GRAPH}/modeller/models?models_tab=performance`);
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
	await page
		.locator("span")
		.filter({ has: chip })
		.getByRole("button", { name: "Discard this change" })
		.last()
		.click();
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
