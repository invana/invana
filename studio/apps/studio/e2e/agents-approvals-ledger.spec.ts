/**
 * Agents › Approvals and Agents › Ledger (approvals.md · the-ledger.md): the
 * Waiting view rides `?f.view=`; an alert rule is made in its dialog, turned
 * off in its row and refused without anyone to tell; the ledger's head states
 * its integrity, its verdict filter rides the URL, and a record with no acts
 * says so.
 *
 * Every alert rule here is made by the spec and deleted in `finally`. Needs
 * `demos/airways`.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const APPROVALS = `${GRAPH}/agents/approvals`;
const LEDGER = `${GRAPH}/agents/ledger`;

interface Rule {
	id: string;
	name: string;
	enabled: boolean;
}

async function dropRules(page: Page, prefix: string) {
	const rules = await graphApi<{ items: Rule[] }>(
		page,
		"/alert-rules?limit=200",
	).catch(() => ({ items: [] as Rule[] }));
	for (const r of rules.items.filter((x) => x.name.startsWith(prefix)))
		await graphApi(page, `/alert-rules/${r.id}`, { method: "DELETE" }).catch(
			() => {},
		);
}

test("Waiting opens on For you and the view rides the URL", async ({
	page,
}) => {
	await page.goto(APPROVALS);
	const showing = page.getByRole("radiogroup", { name: "Showing" });
	await expect(showing).toBeVisible({ timeout: 30_000 });
	await expect(showing.getByText(/^For you · \d+$/)).toBeVisible();
	await showing.getByText(/^All · \d+$/).click();
	await expect(page).toHaveURL(/[?&]f\.view=all/);
	await page.reload();
	await expect(page).toHaveURL(/[?&]f\.view=all/);
	await expect(page.getByRole("radiogroup", { name: "Showing" })).toBeVisible({
		timeout: 30_000,
	});
});

test("New alert makes a rule that turns off in its row", async ({ page }) => {
	const name = `e2e-alert-${Date.now()}`;
	try {
		await page.goto(`${APPROVALS}/alerts`);
		await page
			.getByRole("button", { name: "New alert" })
			.first()
			.click({ timeout: 30_000 });
		await page.getByLabel("When", { exact: true }).fill(name);
		await page.getByLabel("Act", { exact: true }).fill("graph.write.*");
		await page.getByRole("checkbox").last().check();
		await page.getByRole("button", { name: "Create alert" }).click();

		const row = page.getByRole("row", { name: new RegExp(name) });
		await expect(row).toBeVisible({ timeout: 15_000 });
		await expect(row.getByText("graph.write.*")).toBeVisible();
		const on = row.getByRole("switch");
		await expect(on).toBeChecked();
		await on.click();
		await expect(on).not.toBeChecked({ timeout: 15_000 });
	} finally {
		await dropRules(page, name);
	}
});

test("An alert with nobody to tell cannot be created", async ({ page }) => {
	await page.goto(`${APPROVALS}/alerts`);
	await page
		.getByRole("button", { name: "New alert" })
		.first()
		.click({ timeout: 30_000 });
	await page.getByLabel("When", { exact: true }).fill("e2e-alert-nobody");
	await expect(
		page.getByRole("button", { name: "Create alert" }),
	).toBeDisabled();
});

test("The ledger states its integrity and the verdict filter rides the URL", async ({
	page,
}) => {
	await page.goto(LEDGER);
	await expect(page.getByText("append-only", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/days kept|hash chain broken/)).toBeVisible();
	await page
		.getByRole("radiogroup", { name: "Verdict" })
		.getByText("Refused", { exact: true })
		.click();
	await expect(page).toHaveURL(/[?&]f\.verdict=refused/);
	await expect(
		page.getByRole("group", { name: "Applied filters" }),
	).toBeVisible();
});

test("A record with no acts says so", async ({ page }) => {
	await page.goto(`${LEDGER}/record?address=graph/NoSuchType:e2e&since=7d`);
	await expect(
		page.getByText("No act on this record in the window"),
	).toBeVisible({ timeout: 30_000 });
});
