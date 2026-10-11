import { expect, type Page, test } from "@playwright/test";
import { ask, GRAPH } from "./explorer";

/**
 * Where the assistant sits, end to end
 * (docs/for-developers/modules/ask/features/the-assistant.md ·
 * docs/for-developers/modules/explore/features/the-console.md).
 *
 * It starts centred on the Graph's page, docks on the right once a question
 * is asked, closes to give the canvas the width, and a failed query opens the
 * console under the canvas on Log.
 */

const QUERY = "MATCH (a:airport)-[r:route]->(b:airport) RETURN a, r, b LIMIT 6";

function closeAssistant(page: Page) {
	return page.getByRole("button", { name: "Close the assistant" });
}

/** Send a Cypher query from the centred start on the Graph's page. */
async function sendFromStart(page: Page, query: string) {
	const mode = page.getByRole("button", { name: "Ask mode" });
	if (!(await mode.textContent())?.includes("Cypher")) {
		await mode.click();
		await page.getByRole("menuitemradio", { name: "Cypher" }).click();
	}
	await page.getByRole("textbox").first().fill(query);
	await page.getByRole("button", { name: "Send" }).click();
}

test("asking from the centred box docks the conversation on the right", async ({
	page,
}) => {
	await page.goto(GRAPH);
	await expect(
		page.getByRole("heading", { name: /What do you want to know about/ }),
	).toBeVisible({ timeout: 30_000 });
	await expect(closeAssistant(page)).toHaveCount(0);

	await sendFromStart(page, QUERY);

	await expect(page).toHaveURL(/right=assistant/);
	await expect(closeAssistant(page)).toBeVisible({ timeout: 30_000 });
	// One composer on screen: the centred box gave way to the docked chat.
	await expect(
		page.getByRole("heading", { name: /What do you want to know about/ }),
	).toHaveCount(0);
});

test("closing the assistant gives the canvas the width; the pill brings it back", async ({
	page,
}) => {
	await ask(page, QUERY);
	await page.getByRole("button", { name: "Load to canvas" }).click({
		timeout: 30_000,
	});
	const canvas = page.locator("canvas").first();
	await expect(canvas).toBeVisible({ timeout: 30_000 });
	const docked = (await canvas.boundingBox())?.width ?? 0;

	await closeAssistant(page).click();
	await expect(page).not.toHaveURL(/right=assistant/);
	await expect(closeAssistant(page)).toHaveCount(0);
	await expect
		.poll(async () => (await canvas.boundingBox())?.width ?? 0)
		.toBeGreaterThan(docked);

	await page.getByRole("button", { name: /^Assistant · / }).click();
	await expect(closeAssistant(page)).toBeVisible();
});

test("a first query that fails from the centred start docks the chat and opens Log", async ({
	page,
}) => {
	await page.goto(GRAPH);
	await expect(
		page.getByRole("heading", { name: /What do you want to know about/ }),
	).toBeVisible({ timeout: 30_000 });

	await sendFromStart(page, "MATC (a:airport {code:'LHR'}) RETURN a LIMIT 1");

	// Both regions' params land: the failure opening Log must not undo the dock.
	await expect(page).toHaveURL(/console=log/, { timeout: 30_000 });
	await expect(page).toHaveURL(/right=assistant/);
	await expect(closeAssistant(page)).toBeVisible();
	await page.getByRole("button", { name: "Open the log" }).click();
	await expect(page).toHaveURL(/right=assistant/);
});

test("a failed query opens the console on Log, read back after a reload", async ({
	page,
}) => {
	const bad = "MATC (a:airport) RETURN a LIMIT 1";
	await ask(page, bad);

	await expect(page).toHaveURL(/console=log/, { timeout: 30_000 });
	await expect(page.getByText("error", { exact: true }).first()).toBeVisible();

	// A reload closes the thread, and the console closes with its canvas; the
	// param stays, so reopening the thread reads its log back from the record.
	await page.reload();
	await expect(page).toHaveURL(/console=log/);
	await page.getByText(bad).last().click({ timeout: 30_000 });
	await expect(page.getByText("error", { exact: true }).first()).toBeVisible({
		timeout: 30_000,
	});
});
