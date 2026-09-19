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

test("a session survives a reload; its answer does not — yet", async ({
	page,
}) => {
	// Unique per run: every run leaves its sessions behind, and a repeated ask
	// would match a previous run's row in the session list as well as this one.
	const alias = `n_${Date.now()}`;
	const query = `UNWIND [1, 2, 3] AS n RETURN n AS ${alias}`;
	await ask(page, query);

	await expect(emission(page, "table")).toBeVisible({ timeout: 30_000 });
	const url = page.url();

	await page.goto(url);

	// The ask and its steps are records, and come back. It reads twice — once as
	// the session's name in the list, once in the thread.
	await expect(page.getByText(query).first()).toBeVisible({ timeout: 30_000 });

	// The emission is not — it is held in the page until the engine persists
	// emissions (AS10). This assertion is the seam: when 3.3's API lands, it
	// fails, and the decision and this spec change together.
	await expect(emission(page)).toHaveCount(0);
});

test("a rejected query is a diagnosis, never an answer", async ({ page }) => {
	await ask(page, "MATCH (((");

	// The engine names what happened and offers the next step (diagnosis.py).
	await expect(page.getByText(/rejected the query/i)).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("button", { name: "Fix the query" }),
	).toBeVisible();

	// A failure is not an empty answer: nothing renders an emission card here.
	await expect(emission(page)).toHaveCount(0);
});
