import { expect, test } from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * Every panel has a path, under the product that will own it
 * (migration-plan §5), and every old `?panel=` link lands on that path.
 *
 * A redirect carries the rest of the query string across, which is the part
 * worth a test: a bookmark is a URL *plus* its params, and a redirect that
 * drops them lands the reader on an empty state instead of the thing the link
 * was about.
 */

const slug = GRAPH.split("/").pop() as string;

// Every `?panel=` value the graph page has read, and the path it lands on.
const OLD_PANEL_LINKS: [string, string][] = [
	["?panel=info", "/modeller/settings?tab=info"],
	["?panel=connection", "/modeller/settings"],
	["?panel=settings", "/modeller/settings"],
	["?panel=explorer", "/explorer"],
	["?panel=canvases", "/explorer"],
	["?panel=layers", "/explorer"],
	["?panel=sessions", "/explorer?right=assistant"],
	["?panel=messages", "/explorer?right=assistant"],
	["?panel=schema", "/modeller/global-model"],
	["?panel=model", "/modeller/global-model"],
	["?panel=links", "/modeller/global-model"],
	["?panel=skills", "/agents/skills"],
	["?panel=agents", "/agents/agents"],
	["?panel=llms", "/agents/llms"],
	["?panel=agents&section=llms&provider=p1", "/agents/llms/p1"],
	["?panel=library", "/agents/library"],
	["?panel=library&section=plans&plan=nl-single", "/agents/library/nl-single"],
	["?panel=library&section=catalogue&entry=k1", "/agents/plugins/tasks/k1"],
	[
		"?panel=library&section=templates&template=t1",
		"/agents/library/templates/t1",
	],
	["?panel=runs&run=r1", "/activity/runs/r1"],
	["?panel=events", "/activity/events"],
	["?panel=projects&project=p1", "/projects/p1"],
	["?panel=projects&section=todos&todo=t1", "/projects/todos/t1"],
	["?panel=govern&section=worlds&world=w1", "/modeller/worlds/w1"],
	["?panel=govern&section=guardrails&guardrail=g1", "/modeller/guardrails/g1"],
	["?settings=agents", "/agents/agents"],
	["?panel=library&drawer=catalogue", "/agents/plugins/tasks"],
];

test("the graph's own URL renders the page", async ({ page }) => {
	await page.goto(GRAPH);

	// Still here — not bounced to a product.
	await expect(page).toHaveURL(new RegExp(`${GRAPH}/?$`));

	// `owner › graph`, and nothing after it: nothing is open, so there is no
	// level to follow the graph.
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText(slug)).toBeVisible({ timeout: 30_000 });
	await expect(crumbs.getByText("Explorer", { exact: true })).toHaveCount(0);
});

test("every old ?panel= link lands on its path", async ({ page }) => {
	for (const [from, to] of OLD_PANEL_LINKS) {
		await page.goto(`${GRAPH}${from}`);
		await expect(page, from).toHaveURL(`${GRAPH}${to}`);
	}
});

test("an old link keeps the rest of its query string", async ({ page }) => {
	await page.goto(`${GRAPH}/explorer?panel=agents&right=assistant`);
	await expect(page).toHaveURL(`${GRAPH}/agents/agents?right=assistant`);
	await expect(page.getByRole("button", { name: "Ask mode" })).toBeVisible({
		timeout: 30_000,
	});
});

test("a product's root opens its first section", async ({ page }) => {
	await page.goto(`${GRAPH}/modeller`);
	await expect(page).toHaveURL(`${GRAPH}/modeller/global-model`);
	await page.goto(`${GRAPH}/activity`);
	await expect(page).toHaveURL(`${GRAPH}/activity/runs`);
});

test("the breadcrumbs are the path's levels, each a link up", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/activity/events`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("Events", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await crumbs.getByRole("link", { name: "Activity" }).click();
	await expect(page).toHaveURL(`${GRAPH}/activity/runs`);
});

test("an Agents trail names each level and walks back up", async ({ page }) => {
	// graph › Plugins › Tasks › entry: the product has no crumb of its own,
	// since the wordmark reads `Invana Agents`.
	await page.goto(`${GRAPH}/agents/plugins/tasks/k1`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("k1", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(crumbs.getByText("Agents", { exact: true })).toHaveCount(0);
	await crumbs.getByRole("link", { name: "Plugins" }).click();
	await expect(page).toHaveURL(`${GRAPH}/agents/plugins`);
});

test("a reload on a path lands on the same screen", async ({ page }) => {
	await page.goto(`${GRAPH}/modeller/settings?tab=info`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("Graph settings", { exact: true })).toBeVisible(
		{
			timeout: 30_000,
		},
	);
	await expect(page.getByRole("tab", { name: "Info" })).toBeVisible();

	await page.reload();
	await expect(page).toHaveURL(`${GRAPH}/modeller/settings?tab=info`);
	await expect(page.getByRole("tab", { name: "Info" })).toBeVisible({
		timeout: 30_000,
	});
});

test("a leftNav icon writes its path; the same icon closes it", async ({
	page,
}) => {
	await page.goto(GRAPH);
	// The icon's `aria-label` — the open panel's header is a `Runs` button too.
	const runs = page.locator('button[aria-label="Runs"]');
	await runs.click({ timeout: 30_000 });
	await expect(page).toHaveURL(`${GRAPH}/activity/runs`);
	// The address bar moves before the page renders; the crumb is that render.
	await expect(
		page.getByLabel("Breadcrumb").getByText("Runs", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	await runs.click();
	await expect(page).toHaveURL(GRAPH);
});

test("?right= names who holds the right side", async ({ page }) => {
	// The value is the occupant, so the URL says which of the two is on screen
	// (G16) — and it still says so after a reload.
	await page.goto(`${GRAPH}?right=assistant`);
	const composer = page.getByRole("button", { name: "Ask mode" });
	await expect(composer).toBeVisible({ timeout: 30_000 });

	await page.reload();
	await expect(composer).toBeVisible({ timeout: 30_000 });
});

test("a legacy ?ai link opens the assistant", async ({ page }) => {
	// `?ai=1` is read once and normalised onto `?right=assistant`, the same
	// one-way alias `?settings=` gets.
	await page.goto(`${GRAPH}?ai=1`);
	await expect(page.getByRole("button", { name: "Ask mode" })).toBeVisible({
		timeout: 30_000,
	});
});

test("opening the assistant does not cost the open panel", async ({ page }) => {
	// Two axes: the left panel is the path, the right side is `?right=`, and
	// neither write disturbs the other.
	await page.goto(`${GRAPH}/modeller/global-model?right=assistant`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("Global model", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("button", { name: "Ask mode" })).toBeVisible();
});
