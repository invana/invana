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
	["?panel=llms&provider=p1", "/agents/llms/p1"],
	["?panel=fleet&section=map", "/agents/fleet/map"],
	["?panel=functions&section=templates", "/agents/functions/templates"],
	["?panel=connections", "/agents/connections/mcp"],
	["?panel=runs", "/agents/runs"],
	["?panel=events", "/activity/events"],
	["?panel=projects&project=p1", "/projects/p1"],
	["?panel=projects&section=todos&todo=t1", "/projects/todos/t1"],
	["?panel=govern&section=worlds&world=w1", "/modeller/worlds/w1"],
	["?panel=govern&section=guardrails&guardrail=g1", "/modeller/guardrails/g1"],
	["?settings=agents", "/agents/agents"],
];

test("the Graph's own URL opens the last product, else Explorer", async ({
	page,
}) => {
	// A fresh browser has no last product, so the Graph opens in Explorer.
	await page.goto(GRAPH);
	await expect(page).toHaveURL(`${GRAPH}/explorer`);
	// The Graph is the header's switcher, not a crumb.
	await expect(page.getByRole("button", { name: "Switch graph" })).toBeVisible({
		timeout: 30_000,
	});
	const crumbs = page.getByLabel("Breadcrumb");

	// Once the Modeller has been open, the Graph returns to it, query and all.
	await page.goto(`${GRAPH}/modeller/rules`);
	await expect(crumbs.getByText("Rules", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await page.goto(`${GRAPH}?right=assistant`);
	await expect(page).toHaveURL(
		`${GRAPH}/modeller/global-model?right=assistant`,
	);
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
	await page.goto(`${GRAPH}/agents`);
	await expect(page).toHaveURL(`${GRAPH}/agents/home`);
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

test("an Agents trail names the section, never its tab", async ({ page }) => {
	// graph › LLMs › endpoint: the product has no crumb of its own, since the
	// wordmark reads `Invana Agents`, and a section's tab is not a level. An
	// open endpoint's crumb is its name (agents-llms.spec); an id is never one.
	await page.goto(`${GRAPH}/agents/llms/p1`);
	const crumbs = page.getByLabel("Breadcrumb");
	await expect(crumbs.getByText("LLMs", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(crumbs.getByText("p1", { exact: true })).toHaveCount(0);
	await expect(crumbs.getByText("Agents", { exact: true })).toHaveCount(0);

	await page.goto(`${GRAPH}/agents/fleet/map`);
	await expect(crumbs.getByText("Fleet", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(crumbs.getByText("map", { exact: true })).toHaveCount(0);
});

test("a rail item opens its section as a tab; closing it goes back to Home", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/home`);
	await expect(page.getByText("What should your agents do?")).toBeVisible({
		timeout: 30_000,
	});
	await page.goto(`${GRAPH}/agents/skills`);
	await expect(page.getByRole("tab", { name: "Skills" })).toBeVisible({
		timeout: 30_000,
	});
	// No left column in Agents: the section is a page in the main area.
	await expect(page.locator("#graph-detail-left-section")).toHaveCount(0);
	// A Workbook tab's × is a sibling control, named for the tab it closes.
	await page.getByRole("button", { name: "Close Skills" }).click();
	await expect(page).toHaveURL(`${GRAPH}/agents/home`);
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
