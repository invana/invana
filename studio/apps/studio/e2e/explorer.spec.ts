import { expect, test } from "@playwright/test";
import { ask, emission } from "./explorer";

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

	// C2: the steps are the surface while a run is live, not a spinner.
	for (const step of ["Plan", "Validate", "Execute", "Project", "Verify"]) {
		await expect(page.getByText(step, { exact: true })).toBeVisible({
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

	// Compact until Tools is on; then the canvas toolbar is under it.
	const tools = page.getByRole("button", { name: "Tools" });
	await expect(tools).toBeVisible();
	const runLayout = page.getByRole("button", { name: "Run layout" });
	await expect(runLayout).toHaveCount(0);
	await tools.click();
	await expect(tools).toHaveAttribute("aria-pressed", "true");
	await expect(runLayout.first()).toBeVisible();
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
