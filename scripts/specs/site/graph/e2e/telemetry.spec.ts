import { expect, type Page, type Request, test } from "@playwright/test";

/**
 * The page's telemetry against the collector it is built for (`VITE_OTEL_ENDPOINT`, `http://localhost:4318` by
 * default). The collector is a route in the browser, never a port on the machine: a developer's own HyperDX may hold
 * :4318, and the specs must neither feed it nor depend on it.
 */
const COLLECTOR = /^http:\/\/localhost:4318\//;
/** The probe's body: one empty trace export. */
const PROBE = JSON.stringify({ resourceSpans: [] });
const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Every request the page sends to the collector, and the route answering it as up (`200`) or down (refused). */
async function collector(page: Page, up: boolean) {
	const sent: Request[] = [];
	page.on("request", (r) => {
		if (COLLECTOR.test(r.url()) && r.method() === "POST") sent.push(r);
	});
	await page.route(COLLECTOR, (route) =>
		up
			? route.fulfill({ status: 200, headers: CORS, body: "{}" })
			: route.abort("connectionrefused"),
	);
	return sent;
}

/** Open the spec graph and wait for its first draw. */
async function open(page: Page) {
	await page.goto("graph/?view=spec");
	await expect(
		page.frameLocator("iframe.spec-graph-app").getByText(/of \d+ nodes/),
	).toBeVisible({ timeout: 30_000 });
}

test("a collector that is up receives the canvas's spans", async ({ page }) => {
	const sent = await collector(page, true);
	await open(page);
	const spans = () =>
		sent.filter(
			(r) => r.url().endsWith("/v1/traces") && r.postData() !== PROBE,
		);
	await expect
		.poll(() => spans().length, { timeout: 20_000 })
		.toBeGreaterThan(0);
	// The probe came first, and alone: the exporters start only once it answered.
	expect(sent[0]?.postData()).toBe(PROBE);
});

test("a collector that is down gets the probe and nothing else", async ({
	page,
}) => {
	const sent = await collector(page, false);
	await open(page);
	// Long enough for a span export or a metrics interval to have fired, had the exporters started.
	await page.waitForTimeout(6000);
	expect(sent.map((r) => [r.url(), r.postData()])).toEqual([
		["http://localhost:4318/v1/traces", PROBE],
	]);
});
