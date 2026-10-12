import { expect, type Page, test } from "@playwright/test";
import { graphApi, graphStatus } from "./api";
import { GRAPH, openExplorer } from "./explorer";

/**
 * Projects is its own product: its rail is the shell's `leftNav`, a project
 * opens as a page in `mainSection` beside the Projects stack, and Decisions is
 * a page of its own. One test per story — a new project, fork, a branch, a
 * finding, decide (and a rule's refusal), merge, lineage, the decisions list,
 * the report — and keeping an answer as a finding from the Explorer.
 *
 * Every project is made here through the API, keyed `e2e-…`, and deleted
 * after. Needs `demos/airways`.
 */

const PROJECTS = `${GRAPH}/projects`;

interface Made {
	key: string;
	name: string;
}

/**
 * A research project with its first branch (`b1`), made through the API.
 *
 * The engine commits after it answers, so the next call can arrive before the
 * project exists: this returns once `b1` reads back.
 */
async function makeProject(page: Page, tag: string): Promise<Made> {
	const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const name = `E2E project ${tag} ${stamp}`;
	const made = await graphApi<{ key: string }>(page, "/projects", {
		method: "POST",
		data: {
			name,
			key: `e2e-${stamp}`,
			type: "research",
			question: `Does ${tag} hold?`,
			first_branch: `${tag} holds`,
		},
	});
	await expect
		.poll(() => graphStatus(page, `/projects/${made.key}/branches/1`), {
			timeout: 10_000,
		})
		.toBe(200);
	return { key: made.key, name };
}

async function addFinding(
	page: Page,
	key: string,
	branch: number,
	data: Record<string, unknown>,
) {
	return graphApi<{ number: number }>(
		page,
		`/projects/${key}/branches/${branch}/findings`,
		{ method: "POST", data: { stance: "supports", cites: [], ...data } },
	);
}

async function removeProject(page: Page, key: string) {
	await graphApi(page, `/projects/${key}`, { method: "DELETE" });
}

/** The project's page, on a tab or a drill-in (`view`, `branch`, `finding`…). */
function projectPage(key: string, query: Record<string, string> = {}) {
	const q = new URLSearchParams({ page: `project:${key}`, ...query });
	return `${PROJECTS}/${key}?${q}`;
}

test("the product lands on Projects, and Decisions is a page of its own", async ({
	page,
}) => {
	await page.goto(PROJECTS);
	for (const item of ["Projects", "My todos", "Decisions"]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible({
			timeout: 30_000,
		});
	}
	await page.locator('button[aria-label="Decisions"]').click();
	await expect(page).toHaveURL(new RegExp(`${PROJECTS}/decisions\\?`));
	await expect(page.getByText(/^Append-only: a later decision/)).toBeVisible({
		timeout: 30_000,
	});
});

test("PJ-02 a new project takes a type and who can see it", async ({
	page,
}) => {
	const question = `E2E question ${Date.now()} — does the route hold?`;
	try {
		await page.goto(PROJECTS);
		await page
			.getByRole("button", { name: "New project" })
			.click({ timeout: 30_000 });
		const dialog = page.getByRole("dialog");
		// Not launched: drawn, and switched off.
		await expect(
			dialog.getByRole("radio", { name: "Investment" }),
		).toBeDisabled();
		await dialog.getByRole("radio", { name: "Policy" }).click();
		await dialog.getByLabel("The question").fill(question);
		await dialog.getByRole("radio", { name: "Only the people on it" }).click();
		await dialog.getByRole("button", { name: "Create project" }).click();
		await expect(dialog).toBeHidden({ timeout: 30_000 });

		const main = page.getByRole("main");
		await expect(page.getByText("people only").first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(main.getByText("Policy").first()).toBeVisible();
	} finally {
		const { items } = await graphApi<{
			items: { key: string; question: string }[];
		}>(page, "/projects");
		for (const p of items.filter((i) => i.question === question))
			await removeProject(page, p.key);
	}
});

test("PJ-04 a branch forks into children", async ({ page }) => {
	const p = await makeProject(page, "fork");
	try {
		await page.goto(`${PROJECTS}/${p.key}`);
		await page
			.getByRole("button", { name: "Fork a branch" })
			.click({ timeout: 30_000 });
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("New branch 1").fill("Weather explains it");
		await dialog.getByLabel("New branch 2").fill("Crew rosters explain it");
		await dialog.getByRole("button", { name: "Fork into 2" }).click();
		await expect(dialog).toBeHidden({ timeout: 30_000 });
		await expect(page.getByRole("tab", { name: "Branches · 3" })).toBeVisible({
			timeout: 30_000,
		});
	} finally {
		await removeProject(page, p.key);
	}
});

test("PJ-05 a branch's page shows its work, evidence and history", async ({
	page,
}) => {
	const p = await makeProject(page, "branch");
	try {
		await addFinding(page, p.key, 1, { statement: "Delays rise in winter" });
		await page.goto(projectPage(p.key, { branch: "1" }));
		await expect(page.getByRole("tab", { name: "Work" })).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByRole("tab", { name: "History · 0" })).toBeVisible();
		await page.getByRole("tab", { name: "Findings · 1" }).click();
		await expect(page.getByText("Delays rise in winter").first()).toBeVisible();
	} finally {
		await removeProject(page, p.key);
	}
});

test("PJ-06 an agent's finding waits for a person's review", async ({
	page,
}) => {
	const p = await makeProject(page, "review");
	try {
		const agents = await graphApi<{ default_agent_id: string | null }>(
			page,
			"/agents",
		);
		test.skip(!agents.default_agent_id, "the Graph has no default agent");
		const f = await addFinding(page, p.key, 1, {
			statement: "Hub airports cascade delays",
			agent_id: agents.default_agent_id,
		});
		await page.goto(
			projectPage(p.key, { branch: "1", finding: String(f.number) }),
		);
		await expect(page.getByText("not reviewed").first()).toBeVisible({
			timeout: 30_000,
		});
		await page.getByRole("button", { name: "Review", exact: true }).click();
		await expect(page.getByText("person-reviewed")).toBeVisible({
			timeout: 30_000,
		});
	} finally {
		await removeProject(page, p.key);
	}
});

test("PJ-07 a decision is checked by the rules, and a refusal names what broke it", async ({
	page,
}) => {
	const p = await makeProject(page, "decide");
	try {
		const agents = await graphApi<{ default_agent_id: string | null }>(
			page,
			"/agents",
		);
		test.skip(!agents.default_agent_id, "the Graph has no default agent");
		await graphApi(page, `/projects/${p.key}/rules`, {
			method: "POST",
			data: {
				statement: "Decide on reviewed evidence only",
				check: { kind: "evidence.reviewed" },
				mode: "block",
			},
		});
		await addFinding(page, p.key, 1, {
			statement: "An agent's guess",
			agent_id: agents.default_agent_id,
		});
		await page.goto(projectPage(p.key, { branch: "1" }));
		await page.getByRole("button", { name: "Decide", exact: true }).click({
			timeout: 30_000,
		});
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Rationale").fill("The evidence points one way");
		await dialog.getByRole("button", { name: "Record decision" }).click();
		await expect(dialog.getByText("Blocked by a rule")).toBeVisible({
			timeout: 30_000,
		});
		await dialog.getByRole("button", { name: /^Remove f1 from the/ }).click();
		await dialog.getByRole("button", { name: "Record decision" }).click();
		await expect(dialog).toBeHidden({ timeout: 30_000 });
		await expect(page.getByRole("tab", { name: "History · 1" })).toBeVisible();
	} finally {
		await removeProject(page, p.key);
	}
});

test("PJ-08 a merge carries a branch's findings into another", async ({
	page,
}) => {
	const p = await makeProject(page, "merge");
	try {
		await graphApi(page, `/projects/${p.key}/branches/1/fork`, {
			method: "POST",
			data: { titles: ["Weather", "Crew"] },
		});
		await addFinding(page, p.key, 2, { statement: "Storms ground flights" });
		await page.goto(projectPage(p.key, { branch: "2" }));
		await page.getByRole("button", { name: "Merge…" }).click({
			timeout: 30_000,
		});
		const dialog = page.getByRole("dialog");
		await dialog.getByRole("combobox", { name: "Merge into" }).click();
		await page.getByRole("option", { name: /^H3 · Crew/ }).click();
		await dialog.getByLabel("Rationale").fill("Weather is part of crew");
		await dialog.getByRole("button", { name: "Merge 1 item" }).click();
		await expect(dialog).toBeHidden({ timeout: 30_000 });
		await expect(page.getByText("merged into H3")).toBeVisible({
			timeout: 30_000,
		});
	} finally {
		await removeProject(page, p.key);
	}
});

/** A project with one finding citing a run, decided on `b1`. */
async function decided(page: Page, tag: string) {
	const p = await makeProject(page, tag);
	await addFinding(page, p.key, 1, {
		statement: "Delays track hub size",
		cites: [{ kind: "run", ref: "00000000-0000-0000-0000-00000000e2e0" }],
	});
	await graphApi(page, `/projects/${p.key}/branches/1/decisions`, {
		method: "POST",
		data: {
			verdict: "supported",
			choice: "pursue",
			rationale: "Hub size explains it",
		},
	});
	return p;
}

test("PJ-11 lineage traces a decision back to what it stood on", async ({
	page,
}) => {
	const p = await decided(page, "lineage");
	try {
		await page.goto(projectPage(p.key, { view: "lineage", decision: "1" }));
		// The drawing is a canvas; its links are also listed in words under it.
		const list = page
			.locator("section")
			.filter({ has: page.getByText("Links", { exact: true }) });
		await expect(list.getByText("Delays track hub size").first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(list.getByText(/cites run 00000000/)).toBeVisible();
		await expect(list.getByText(/cited by f1$/)).toBeVisible();
		await expect(list.getByText(/rationale kept$/)).toBeVisible();
	} finally {
		await removeProject(page, p.key);
	}
});

test("PJ-13 the Decisions page lists every project's decisions", async ({
	page,
}) => {
	const p = await decided(page, "decisions");
	try {
		await page.goto(`${PROJECTS}/decisions`);
		const row = page.getByRole("row", { name: new RegExp(p.name) });
		await expect(row).toBeVisible({ timeout: 30_000 });
		await row.click();
		await expect(page).toHaveURL(
			new RegExp(`page=project%3A${p.key}.*branch=1`),
		);
	} finally {
		await removeProject(page, p.key);
	}
});

test("PJ-14 a report is drafted from the records and published", async ({
	page,
}) => {
	const p = await decided(page, "report");
	try {
		await page.goto(projectPage(p.key, { view: "report" }));
		await page
			.getByRole("button", { name: "Draft from the records" })
			.click({ timeout: 30_000 });
		// The draft reads rendered, the project's name its heading.
		await expect(
			page
				.getByRole("article", { name: "Report" })
				.getByRole("heading", { name: p.name }),
		).toBeVisible({ timeout: 30_000 });
		await page.getByRole("button", { name: "Publish v1" }).click();
		await expect(
			page.getByRole("button", { name: /^v1 · published/ }),
		).toBeVisible({
			timeout: 30_000,
		});
	} finally {
		await removeProject(page, p.key);
	}
});

test("EX-12 an answer is kept as a finding on a project's branch", async ({
	page,
}) => {
	// An ask runs the whole pipeline, which is slower than a read.
	test.setTimeout(120_000);
	const p = await makeProject(page, "answer");
	try {
		const composer = await openExplorer(page);
		await composer.fill("MATCH (n) RETURN n LIMIT 1");
		await page.getByRole("button", { name: "Send" }).click();
		const add = page.getByRole("button", { name: "Add to a project" }).last();
		await add.click({ timeout: 60_000 });

		const dialog = page.getByRole("dialog");
		await dialog.getByRole("combobox", { name: "Project" }).click();
		await page.getByRole("option", { name: p.name }).click();
		await dialog.getByRole("combobox", { name: "Branch" }).click();
		await page.getByRole("option", { name: /^H1/ }).click();
		await dialog.getByRole("button", { name: "Add finding" }).click();
		await expect(dialog).toBeHidden({ timeout: 30_000 });

		const branch = await graphApi<{
			findings: { cites: { kind: string }[] }[];
		}>(page, `/projects/${p.key}/branches/1`);
		expect(branch.findings).toHaveLength(1);
		expect(branch.findings[0].cites.map((c) => c.kind)).toContain("run");
	} finally {
		await removeProject(page, p.key);
	}
});
