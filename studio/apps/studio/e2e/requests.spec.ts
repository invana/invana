/**
 * The Requests page — one inbox, Open then Done, each open row resolved by
 * *Decline*, *Allow in a world* or *Model it*.
 *
 * Each spec files its own `change` request through the API, so a stack with
 * only `demos/airways` loaded passes.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

interface Filed {
	id: string;
	title: string;
}

async function fileRequest(page: Page): Promise<Filed> {
	const title = `e2e change ${Date.now()}`;
	return graphApi<Filed>(page, "/requests", {
		method: "POST",
		data: { title, detail: "filed by the requests spec" },
	});
}

const rowOf = (page: Page, title: string) =>
	page.locator("div.group").filter({ hasText: title });

test("the open chip is the engine's count", async ({ page }) => {
	await fileRequest(page);
	const listed = await graphApi<{ open: number }>(
		page,
		"/requests?status=open&limit=1",
	);
	await page.goto(`${GRAPH}/modeller/requests`);
	await expect(page.getByText("Requests", { exact: true }).first()).toBeVisible(
		{ timeout: 20_000 },
	);
	await expect(page.getByText(`${listed.open} open`)).toBeVisible();
	await expect(
		page.getByText(/asks the Graph could not answer/).first(),
	).toBeVisible();
});

test("a change request is declined and moves to Done", async ({ page }) => {
	const filed = await fileRequest(page);
	await page.goto(`${GRAPH}/modeller/requests`);
	const row = rowOf(page, filed.title);
	await expect(row).toBeVisible({ timeout: 20_000 });
	// A change request is modelled, not allowed.
	await expect(row.getByRole("button", { name: "Model it" })).toBeVisible();
	await expect(
		row.getByRole("button", { name: "Allow in a world" }),
	).toHaveCount(0);

	await row.getByRole("button", { name: "Decline" }).click();
	await expect(rowOf(page, filed.title)).toHaveCount(0, { timeout: 15_000 });

	// Done starts folded; unfolded, the row reads what was done.
	await page.getByRole("button", { name: "Done" }).click();
	const done = rowOf(page, filed.title);
	await expect(done).toBeVisible();
	await expect(done.getByText("done", { exact: true })).toBeVisible();
	await expect(done.getByRole("button", { name: "Decline" })).toHaveCount(0);
});

test("a request resolved elsewhere first is refused as already resolved", async ({
	page,
}) => {
	const filed = await fileRequest(page);
	await page.goto(`${GRAPH}/modeller/requests`);
	const row = rowOf(page, filed.title);
	await expect(row).toBeVisible({ timeout: 20_000 });

	// Someone else declines it while this page still lists it as open.
	await graphApi(page, `/requests/${filed.id}/resolve`, {
		method: "POST",
		data: { action: "decline" },
	});

	await row.getByRole("button", { name: "Decline" }).click();
	await expect(page.getByText(/Already resolved/)).toBeVisible();
	await expect(rowOf(page, filed.title)).toHaveCount(0, { timeout: 15_000 });
});
