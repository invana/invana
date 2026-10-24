/**
 * Declared boards, reports and rules, against `demos/airways`.
 *
 * Every run, report, rule and Todo below is made by the spec itself (`api.ts`),
 * so nothing here depends on a row somebody made by hand. Two reads are
 * patched where no clean stack can produce the data: which rules a step was
 * offered and cited needs an LLM step, and a QL ask has none. What those two
 * tests prove is Studio's threading of a real response, not the engine's read.
 */
import { expect, type Page, test } from "@playwright/test";
import { askForRun, graphApi, me, ruleWithStatement } from "./api";
import { GRAPH } from "./explorer";

const STATEMENT = "Airport codes are IATA, never ICAO.";
const QUERY =
	"UNWIND [['LHR','GB'],['CDG','FR'],['AMS','NL']] AS r RETURN r[0] AS code, r[1] AS country";

/** A run with one report kept of it: ask, open its board, `Save report`. */
async function reportedRun(page: Page): Promise<string> {
	const run = await askForRun(page, QUERY);
	await page.goto(`${GRAPH}?page=run:${run}`);
	await page.getByRole("button", { name: "Save report", exact: true }).click();
	// Saving turns the page into the reading it kept.
	await expect(page).toHaveURL(new RegExp(`page=run%3A${run}%40`), {
		timeout: 20_000,
	});
	return run;
}

test("B21 — a declared board offers Reports, and the card lists them", async ({
	page,
}) => {
	const run = await reportedRun(page);
	await page.goto(`${GRAPH}?page=run:${run}`);
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
	const run = await reportedRun(page);
	await page.goto(`${GRAPH}?page=run:${run}`);
	await page.getByRole("button", { name: "Reports", exact: true }).click();
	// No fork: the live board is always there, so there is nothing to fork into.
	await expect(
		page.getByRole("button", { name: /Open as new canvas/ }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Open this report" }).first().click();
	await expect(
		page.getByText(/A report — the numbers as they were/),
	).toBeVisible({ timeout: 30_000 });
	await expect(page).toHaveURL(new RegExp(`page=run%3A${run}%40`));
	await page.getByRole("button", { name: "Open the live board" }).click();
	await expect(page).toHaveURL(new RegExp(`page=run%3A${run}$`));
});

test("SR44 — a step board opened cold finds its own run", async ({ page }) => {
	const run = await askForRun(page, QUERY);
	const trace = await graphApi<{ steps: { id: string; label: string }[] }>(
		page,
		`/runs/${run}/trace`,
	);
	const step = trace.steps.at(-1);
	expect(step, "the run recorded its steps").toBeTruthy();
	const { id, label } = step as { id: string; label: string };

	await page.goto(`${GRAPH}?page=task_run:${id}`);
	// B17's refusal is what a reload used to get. It must not appear.
	await expect(page.getByText("This board arrived without a run")).toHaveCount(
		0,
		{ timeout: 30_000 },
	);
	// The trace loaded, which is only possible once the run was resolved.
	await expect(page.getByText(label).first()).toBeVisible({ timeout: 30_000 });
	await expect(
		page.getByRole("button", { name: "Reports", exact: true }),
	).toBeVisible();
});

test("RU13 — a statement closes the trace and opens the rule board", async ({
	page,
}) => {
	const rule = await ruleWithStatement(page, STATEMENT);
	// A QL ask has no LLM step, so nothing offers it a rule; the first step is
	// given one. What is under test is the threading, not the read.
	await page.route("**/runs/*/trace", async (route) => {
		const res = await route.fetch();
		const body = await res.json();
		if (body.steps?.length) {
			const cited = [{ rule_id: rule, statement: STATEMENT }];
			body.steps[0].rules_offered = cited;
			body.steps[0].rules_cited = cited;
		}
		await route.fulfill({ response: res, json: body });
	});

	await askForRun(page, QUERY);
	await page
		.getByRole("button", { name: /^cite · / })
		.last()
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
	await expect(page).toHaveURL(new RegExp(`page=rule%3A${rule}`));
});

test("RU12 — a Todo's Activity tab draws offered and marks cited", async ({
	page,
}) => {
	const rule = await ruleWithStatement(page, STATEMENT);
	const title = `E2E activity ${Date.now()}`;
	const todo = await graphApi<{ id: string }>(page, "/tasks", {
		method: "POST",
		// With no project open the section lists *My todos*, so it is assigned.
		data: { title, assignee_kind: "user", assignee_id: me() },
	});
	// Two steps were offered the same statement and only `Understand` cited it,
	// so the mark is the whole difference between them. No clean stack runs an
	// LLM step, so the tree is given the two steps.
	const offered = [{ rule_id: rule, statement: STATEMENT }];
	const step = (id: string, label: string, cited: boolean) => ({
		id,
		kind: "step",
		action: "ran",
		label,
		detail: "",
		actor_kind: null,
		actor_id: null,
		actor_name: null,
		on_behalf_of_name: null,
		run_id: null,
		status: "succeeded",
		skills_offered: [],
		skills_applied: [],
		rules_offered: offered,
		rules_cited: cited ? offered : [],
		tokens_in: null,
		tokens_out: null,
		at: null,
		children: [],
	});
	await page.route(`**/tasks/${todo.id}/activity`, async (route) => {
		const res = await route.fetch();
		const body = await res.json();
		body.nodes = [step("s1", "Understand", true), step("s2", "Plan", false)];
		await route.fulfill({ response: res, json: body });
	});

	try {
		await page.goto(`${GRAPH}?panel=projects`);
		await page
			.getByRole("button", { name: new RegExp(`^${title}`) })
			.first()
			.click();
		// The tab strip sits under a sticky footer, so it is driven by keyboard.
		await page.getByRole("tab", { name: /^Work$/ }).click({ force: true });
		await page.getByRole("tab", { name: /^Work$/ }).press("ArrowRight");
		await expect(page.getByText(STATEMENT).first()).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByText(STATEMENT)).toHaveCount(2);
		await expect(page.getByText("✓cited")).toHaveCount(1);
	} finally {
		await graphApi(page, `/tasks/${todo.id}`, { method: "DELETE" });
	}
});

// Every declared kind that keeps readings renders inside `DeclaredBoard` and
// carries both acts. The skill's own page is not one of them: it is the page
// that authors the playbook, and nothing freezes a playbook.
for (const kind of ["rule"] as const) {
	test(`${kind} board carries both acts`, async ({ page }) => {
		const subject = await ruleWithStatement(page, STATEMENT);
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
