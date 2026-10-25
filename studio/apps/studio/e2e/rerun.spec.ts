import { expect, test } from "@playwright/test";
import { askForRun, graphApi } from "./api";
import { GRAPH } from "./explorer";

/**
 * Rerunning a settled ask from its run page in Agents › Runs: the same
 * versions reproduce it, and the new run opens on its own page with Compare on
 * its header — and it answers.
 *
 * A query ask, so the re-run needs no model to answer.
 */

test("a settled run reruns on the same versions and links back", async ({
	page,
}) => {
	test.setTimeout(180_000);
	// A query of its own, so the run is this test's.
	const runId = await askForRun(
		page,
		`MATCH (n) RETURN n, ${Date.now()} AS t LIMIT 1`,
	);
	const runPage = `${GRAPH}/agents/runs?page=run%3A${runId}`;
	await page.goto(runPage);

	// The act is offered once the run has settled; a slow stack settles late.
	const rerun = page.getByRole("button", { name: "Rerun", exact: true });
	await expect
		.poll(
			async () => {
				if (await rerun.isEnabled()) return true;
				await page.reload();
				await page
					.getByRole("tab", { name: "Overview" })
					.waitFor({ timeout: 30_000 });
				return rerun.isEnabled();
			},
			{ timeout: 120_000, intervals: [2_000, 5_000] },
		)
		.toBe(true);
	await rerun.click();

	const dialog = page.getByRole("dialog");
	await dialog.getByRole("radio", { name: /^The same versions/ }).click();
	await expect(
		dialog.getByRole("radio", { name: /^Current versions/ }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Rerun", exact: true }).click();

	await expect(page).toHaveURL(new RegExp(`page=run%3A(?!${runId})[^&]+`), {
		timeout: 30_000,
	});
	await expect(
		page.getByRole("button", { name: "Compare", exact: true }),
	).toBeVisible({ timeout: 60_000 });

	// Reproducing it means it answers again, not just that a run opened.
	const newRunId = (
		new URL(page.url()).searchParams.get("page") as string
	).replace(/^run:/, "");
	await expect
		.poll(
			async () =>
				(await graphApi<{ status: string }>(page, `/runs/${newRunId}`)).status,
			{ timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
		)
		.toBe("succeeded");
});
