import { expect, test } from "@playwright/test";
import { ask, emission, GRAPH } from "./explorer";

/**
 * The Explorer around the answer
 * (docs/for-developers/modules/explore/spec.md · docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).
 *
 * The answer surface has its own spec. These cover the surface it arrives on:
 * the workflow that runs in front of the reader, a session that survives a
 * reload, and the failure path — which must never be mistaken for an answer.
 */

test("the workflow runs in front of the reader, step by step", async ({
	page,
}) => {
	await ask(page, "RETURN 1 AS one");

	// C2: the steps are the surface while a run is live, not a spinner; once
	// it settles they fold under *How I got this*, one click away. A run this
	// small can settle before the first look, so the fold is opened when shown.
	const howIGotThis = page.getByRole("button", { name: "How I got this" });
	await expect(
		page.getByText("Plan", { exact: true }).first().or(howIGotThis.last()),
	).toBeVisible({ timeout: 30_000 });
	if (await howIGotThis.last().isVisible()) await howIGotThis.last().click();
	for (const step of ["Plan", "Validate", "Execute", "Project", "Verify"]) {
		await expect(page.getByText(step, { exact: true }).first()).toBeVisible({
			timeout: 30_000,
		});
	}
});

test("a session and its answer survive a reload", async ({ page }) => {
	// Unique per run: every run leaves its sessions behind, and a repeated ask
	// would match a previous run's row in the session list as well as this one.
	const alias = `n_${Date.now()}`;
	const query = `UNWIND [1, 2, 3] AS n RETURN n AS ${alias}`;
	await ask(page, query);

	await expect(emission(page, "table")).toBeVisible({ timeout: 30_000 });
	// The open session is the path's last level.
	await expect(page).toHaveURL(/\/explorer\/[^/?]+/);
	const url = page.url();

	await page.goto(url);

	// The ask, its steps and its emission are records: the path reopens the
	// thread, and the answer comes back with it.
	await expect(page.getByText(query).first()).toBeVisible({ timeout: 30_000 });
	await expect(emission(page, "table")).toBeVisible({ timeout: 30_000 });
});

test("the Explorer has no leftNav; its tools float over the board", async ({
	page,
}) => {
	await ask(page, "RETURN 1 AS one");
	await expect(emission(page)).toBeVisible({ timeout: 30_000 });

	// The graph page's leftNav icons are not drawn on the Explorer.
	await expect(page.getByRole("button", { name: "Runs" })).toHaveCount(0);

	// The board's own chrome floats over it: the mode picker top-left with its
	// tools, and the rail of panels; the layout verbs live on the menus.
	await expect(page.getByRole("button", { name: /^Mode · / })).toBeVisible();
	await expect(page.getByRole("button", { name: "Hand" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Legend" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Run layout" })).toHaveCount(0);
});

test("a rejected query is a diagnosis, never an answer", async ({ page }) => {
	await ask(page, "MATCH (((");

	// The engine names what happened and offers the next step (diagnosis.py).
	// The console's Log carries the same line, so the card is read on its own.
	await expect(
		page.getByTestId("diagnosis").getByText(/rejected the query/i),
	).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("button", { name: "Fix the query" }),
	).toBeVisible();

	// A failure is not an empty answer: nothing renders an emission card here.
	await expect(emission(page)).toHaveCount(0);
});

test("SH-07 the user menu switches the assistant off, and back on", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/explorer`);
	const assistant = page.getByRole("button", {
		name: "Assistant",
		exact: true,
	});
	await expect(assistant).toBeVisible({ timeout: 30_000 });

	await page.getByRole("button", { name: "User menu" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Assistant" }).click();
	await page.keyboard.press("Escape");

	// Off: no header button, no question box — the views and the way back.
	await expect(assistant).toHaveCount(0);
	await expect(page.getByTestId("composer")).toHaveCount(0);
	await expect(page.getByText("The assistant is off.")).toBeVisible();
	// A link that names the chat does not bring it back.
	await page.goto(`${GRAPH}/explorer?right=assistant`);
	await expect(
		page.getByRole("button", { name: "Close the assistant" }),
	).toHaveCount(0);

	await page.getByRole("button", { name: "User menu" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Assistant" }).click();
	await page.keyboard.press("Escape");
	await expect(assistant).toBeVisible();
	await expect(page.getByTestId("composer").first()).toBeVisible();
});

test("4.4 the footer's counts open the console on the canvas's data and on its queries", async ({
	page,
}) => {
	await ask(page, "MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 5");

	// A typed query that answers opens Data: one table per label.
	await expect(page).toHaveURL(/console=data/, { timeout: 30_000 });
	const consolePanel = page.getByTestId("graph-detail-terminal-panel");
	await expect(consolePanel.getByText("Nodes", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();

	// Queries: the session's, from the footer's query count; a row opens its step.
	const queries = page.getByRole("button", { name: /^\d+ quer(y|ies)$/ });
	await queries.click();
	await expect(page).toHaveURL(/console=queries/);
	await page
		.getByRole("cell", { name: /MATCH \(a\)-\[r\]->\(b\)/ })
		.first()
		.click();
	await expect(page).toHaveURL(/console=queries(%3A|:)/);
	await expect(page.getByRole("button", { name: "All queries" })).toBeVisible();

	// The open count collapses it; the record count opens Data again.
	await queries.click();
	await expect(page).not.toHaveURL(/console=/);
	await page.getByRole("button", { name: /nodes · .* relationships/ }).click();
	await expect(page).toHaveURL(/console=data/);
});

test("4.4 a failed query opens the console on its step, and the footer marks it", async ({
	page,
}) => {
	await ask(page, "MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 3");
	await expect(page).toHaveURL(/console=data/, { timeout: 30_000 });

	// The same session: the next query is typed into the docked chat.
	const composer = page.getByTestId("composer").getByRole("textbox").first();
	await composer.fill("MATC (a) RETURN a");
	await page.getByRole("button", { name: "Send" }).click();

	await expect(page).toHaveURL(/console=queries(%3A|:)/, { timeout: 30_000 });
	await expect(page.getByRole("button", { name: "All queries" })).toBeVisible();
	await expect(page.getByLabel("a query failed")).toBeVisible();
});
