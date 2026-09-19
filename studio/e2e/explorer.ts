import { type Page, expect } from "@playwright/test";

/**
 * Driving the Explorer: the few gestures every spec needs.
 *
 * Kept together so a change to the composer moves one file, not every spec.
 */

export const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/air-routes-graph";

/** Open the Explorer with the composer in query-language mode. */
export async function openExplorer(page: Page) {
	// The composer lives in the assistant, which is the `assistant` occupant of
	// the right side (`?right=`) — Sessions is not a left-rail panel
	// (the-assistant.md AD1/AD7).
	// The graph's own URL is the page (graph-detail-page.md G15); `/explorer` is
	// a redirect now, and going straight there saves the hop.
	await page.goto(`${GRAPH}?right=assistant`);

	// The mode is remembered between visits, so switch only when it is not
	// already where these specs need it.
	const mode = page.getByRole("combobox", { name: "Ask mode" });
	await expect(mode).toBeVisible({ timeout: 30_000 });
	if ((await mode.textContent())?.includes("Natural")) {
		await mode.click();
		await page.getByRole("option", { name: "Query Language" }).click();
	}

	// The composer is a contenteditable, not an <input> — it has no placeholder
	// attribute to address it by, and it can carry a draft from a previous visit.
	return page.getByRole("textbox").first();
}

/** Ask, and return the URL the session settled on so a reload can come back. */
export async function ask(page: Page, query: string) {
	const composer = await openExplorer(page);
	await composer.fill(query);
	await page.getByRole("button", { name: "Send" }).click();
}

export function emission(page: Page, kind?: string) {
	const selector = kind
		? `[data-testid="emission"][data-emission-kind="${kind}"]`
		: '[data-testid="emission"]';
	return page.locator(selector);
}
