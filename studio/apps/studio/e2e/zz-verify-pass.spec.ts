/**
 * Verification for the boards/rules pass — **not a repo test**.
 *
 * Every id below is a row in this machine's dev Graph, so this spec is a
 * throwaway that proves the four units by hand against the running stack. It
 * is untracked on purpose; `e2e/*.spec.ts` in the repo are data-independent.
 */
import { expect, test } from "@playwright/test";

const GRAPH = "/u/admin/airways";
/** A step of the one root run whose steps offer rules and whose first cites one. */
const STEP = "a494d060-12d7-4b45-9f0d-49584a1684c3";
/** The one run that has reports kept of it. */
const REPORTED_RUN = "d06ea592-4a09-4605-8bd7-e3b301fdf300";
const RULE = "02ce4540-6d80-4303-b84c-038f35be0ed5";
/** A `rule_version_id` both steps were offered, whose rule has been deleted. */
const DELETED_VERSION = "19bcb7aa-3ed9-4a9a-a6e8-80e277a3dfa8";

test("B21 — a declared board offers Reports, and the card lists them", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?page=run:${REPORTED_RUN}`);
	const reports = page.getByRole("button", { name: "Reports", exact: true });
	await expect(reports).toBeVisible({ timeout: 30_000 });
	await reports.click();
	await expect(
		page.getByRole("button", { name: "Close Reports" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Open this report" }).first(),
	).toBeVisible({ timeout: 15_000 });
});

test("B22 — a report row opens; it does not restore", async ({ page }) => {
	await page.goto(`${GRAPH}?page=run:${REPORTED_RUN}`);
	await page.getByRole("button", { name: "Reports", exact: true }).click();
	// No fork: the live board is always there, so there is nothing to fork into.
	await expect(
		page.getByRole("button", { name: /Open as new canvas/ }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Open this report" }).first().click();
	await expect(
		page.getByText(/A report — the numbers as they were/),
	).toBeVisible({ timeout: 30_000 });
	await expect(page).toHaveURL(new RegExp(`page=run%3A${REPORTED_RUN}%40`));
	await page.getByRole("button", { name: "Open the live board" }).click();
	await expect(page).toHaveURL(new RegExp(`page=run%3A${REPORTED_RUN}$`));
});

test("SR44 — a step board opened cold finds its own run", async ({ page }) => {
	await page.goto(`${GRAPH}?page=task_run:${STEP}`);
	// B17's refusal is what a reload used to get. It must not appear.
	await expect(page.getByText("This board arrived without a run")).toHaveCount(
		0,
		{
			timeout: 30_000,
		},
	);
	// The trace loaded, which is only possible once the run was resolved.
	await expect(page.getByText("Understand").first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("button", { name: "Reports" })).toBeVisible();
});

test("RU13 — a statement closes the trace and opens the rule board", async ({
	page,
}) => {
	// No session in the dev data has an emission whose run also carries rules,
	// so the trace is stubbed. What is under test is the threading, not the read.
	await page.route("**/runs/*/trace", async (route) => {
		const res = await route.fetch();
		const body = await res.json();
		if (body.steps?.length) {
			const cited = [
				{ rule_id: RULE, statement: "Airport codes are IATA, never ICAO." },
			];
			body.steps[0].rules_offered = cited;
			body.steps[0].rules_cited = cited;
		}
		await route.fulfill({ response: res, json: body });
	});

	await page.goto(`${GRAPH}?right=assistant`);
	await page.waitForTimeout(4000);
	await page.getByRole("button", { name: /^More/ }).click();
	await page.waitForTimeout(1500);
	await page
		.getByRole("button", { name: /^How many airports are there\?/ })
		.first()
		.click();
	await page
		.getByRole("button", { name: /^cite · / })
		.first()
		.click();
	await expect(
		page.getByRole("heading", { name: "How this was reached" }),
	).toBeVisible({ timeout: 20_000 });

	const statement = page.getByRole("button", {
		name: /Airport codes are IATA/,
	});
	await expect(statement).toBeVisible({ timeout: 10_000 });
	await statement.click();

	await expect(
		page.getByRole("heading", { name: "How this was reached" }),
	).toHaveCount(0, { timeout: 10_000 });
	await expect(page).toHaveURL(new RegExp(`page=rule%3A${RULE}`));
});

test("RU12 — a Todo's Activity tab draws offered and marks cited", async ({
	page,
}) => {
	await page.goto(`${GRAPH}?panel=projects`);
	await page
		.getByRole("button", { name: /^Which airports does Air Canada hub at\?/ })
		.first()
		.click();
	// The tab strip sits under a sticky footer, so it is driven by keyboard.
	await page.getByRole("tab", { name: /^Work$/ }).click({ force: true });
	await page.getByRole("tab", { name: /^Work$/ }).press("ArrowRight");
	await expect(
		page.getByText("Airport codes are IATA, never ICAO.").first(),
	).toBeVisible({ timeout: 20_000 });
	// Two steps draw the same statement and only `Understand` cited it, so the
	// mark is the whole difference between them.
	await expect(
		page.getByText("Airport codes are IATA, never ICAO."),
	).toHaveCount(2);
	await expect(page.getByText("✓cited")).toHaveCount(1);
	// Both steps were also offered a version whose rule has since been deleted.
	// RU12 drops it rather than drawing an id, so neither reaches the tree.
	await expect(page.getByText(DELETED_VERSION)).toHaveCount(0);
});

// Every declared kind still renders inside the new `DeclaredBoard` wrapper, and
// every one of them now carries both acts (B21).
const SKILL = "cedcf4cc-2d11-4c21-8fd7-dc82d921444c";
for (const [kind, subject] of [
	["skill", SKILL],
	["skill_usage", SKILL],
	["rule", RULE],
] as const) {
	test(`${kind} board carries both acts`, async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.goto(`${GRAPH}?page=${kind}:${subject}`);
		await expect(
			page.getByRole("button", { name: "Reports", exact: true }),
		).toBeVisible({ timeout: 30_000 });
		await expect(
			page.getByRole("button", { name: "Save report" }),
		).toBeVisible();
		expect(errors).toEqual([]);
	});
}
