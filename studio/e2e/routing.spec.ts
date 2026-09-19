import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * The graph's URL is the graph (graph-detail-page.md G15).
 *
 * `/explorer` and `/modeller` shipped and are bookmarked, so they redirect
 * rather than 404 — and they carry their query string across, which is the part
 * worth a test: a bookmark is a URL *plus* its params, and a redirect that
 * drops them lands the reader on an empty state instead of the thing the link
 * was about.
 */

const slug = GRAPH.split("/").pop() as string;

test("the graph's own URL renders the page", async ({ page }) => {
	await page.goto(GRAPH);

	// Still here — not bounced to a screen name.
	await expect(page).toHaveURL(new RegExp(`${GRAPH}/?$`));

	// `owner › graph`, and nothing after it: the graph names where you are, so
	// there is no screen crumb to follow it. Scoped to the breadcrumb — Explorer
	// is still one of the ten `leftNav` items (G2), and its panel is still
	// labelled; what it is no longer is the name of the page.
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText(slug)).toBeVisible({ timeout: 30_000 });
	await expect(crumbs.getByText("Explorer", { exact: true })).toHaveCount(0);
});

test("/explorer redirects to the graph and keeps its query string", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/explorer?panel=agents`);
	await expect(page).toHaveURL(`${GRAPH}?panel=agents`);
});

test("/modeller redirects to the graph's model panel", async ({ page }) => {
	await page.goto(`${GRAPH}/modeller`);
	await expect(page).toHaveURL(`${GRAPH}?panel=model`);
});

test("the open panel is the third crumb", async ({ page }) => {
	await page.goto(`${GRAPH}?panel=model`);

	// Verbatim from the URL (G16), after the two identifiers that precede it.
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("model", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
});

test("a legacy ?settings link still opens its panel", async ({ page }) => {
	// The param was renamed, not re-pointed: `?settings=` is read so a bookmark
	// keeps working, and the crumb proves the panel actually opened.
	await page.goto(`${GRAPH}?settings=agents`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("agents", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
});

test("?right= names who holds the right side", async ({ page }) => {
	// The value is the occupant, so the URL says which of the two is on screen
	// (G16) — and it still says so after a reload.
	await page.goto(`${GRAPH}?right=assistant`);
	const composer = page.getByRole("combobox", { name: "Ask mode" });
	await expect(composer).toBeVisible({ timeout: 30_000 });

	await page.reload();
	await expect(composer).toBeVisible({ timeout: 30_000 });
});

test("a legacy ?ai link opens the assistant", async ({ page }) => {
	// `?ai=1` is read once and normalised onto `?right=assistant`, the same
	// one-way alias `?settings=` gets.
	await page.goto(`${GRAPH}?ai=1`);
	await expect(page.getByRole("combobox", { name: "Ask mode" })).toBeVisible({
		timeout: 30_000,
	});
});

test("opening the assistant does not cost the open panel", async ({ page }) => {
	// Two axes, two params (explore/spec.md E8): the left panel is `?panel=`,
	// the right side is `?right=`, and neither write disturbs the other.
	await page.goto(`${GRAPH}?panel=model&right=assistant`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("model", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("combobox", { name: "Ask mode" })).toBeVisible();
});
