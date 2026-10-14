import { expect, type Page, test } from "@playwright/test";
import { api, graphApi, graphStatus } from "./api";
import { GRAPH } from "./explorer";

/**
 * Simulation on a branch (projects.md PJ-09): a simulator plugin scores
 * crosses over the branch's cited dataset versions, the result is a ranked,
 * derived table, and the branch lists what was simulated on it. A parent that
 * is in none of the inputs is the simulator's refusal — the run fails and the
 * result page shows its sentence.
 *
 * Each test makes its own project (`e2e-…`, deleted after) and an
 * install-wide dataset of three parents with two traits. Datasets cannot be
 * deleted, so they are keyed `e2e-sim-…` and left behind. The run is executed
 * by the engine's in-process runtime; needs the genomic simulator installed.
 */

const PROJECTS = `${GRAPH}/projects`;

async function makeProject(page: Page, tag: string): Promise<string> {
	const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = await graphApi<{ key: string }>(page, "/projects", {
		method: "POST",
		data: {
			name: `E2E project ${tag} ${stamp}`,
			key: `e2e-${stamp}`,
			type: "research",
			question: `Which cross makes ${tag}?`,
			first_branch: `${tag} from a cross`,
		},
	});
	await expect
		.poll(() => graphStatus(page, `/projects/${made.key}/branches/1`), {
			timeout: 10_000,
		})
		.toBe(200);
	return made.key;
}

async function removeProject(page: Page, key: string) {
	await graphApi(page, `/projects/${key}`, { method: "DELETE" });
}

function projectPage(key: string, query: Record<string, string> = {}) {
	const q = new URLSearchParams({ page: `project:${key}`, ...query });
	return `${PROJECTS}/${key}?${q}`;
}

/** Three parents with two traits, version 1, cited by a finding on `b1`. */
async function parentsOnBranch(page: Page, key: string): Promise<string> {
	const name = `e2e-sim-${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = (await api<{ publisher: string; name: string }>(
		page,
		"/datasets",
		{
			method: "POST",
			data: {
				name,
				title: "E2E parents",
				origin: "observed",
				key_column: "name",
			},
		},
	)) as { publisher: string; name: string };
	await api(page, `/datasets/${made.publisher}/${made.name}/versions`, {
		method: "POST",
		data: {
			licence: "CC-BY-4.0",
			records: [
				{ name: "Col-0", flowering_days: 30, height_cm: 25 },
				{ name: "Ler-1", flowering_days: 34, height_cm: 21 },
				{ name: "Cvi-0", flowering_days: 28, height_cm: 30 },
			],
		},
	});
	const ref = `${made.publisher}/${made.name}@1`;
	await graphApi(page, `/projects/${key}/branches/1/findings`, {
		method: "POST",
		data: {
			statement: "The parents' traits are measured",
			stance: "context",
			cites: [{ kind: "dataset", ref }],
		},
	});
	return ref;
}

/** Open *Simulate* on `b1` and fill the genomic simulator's spec. */
async function simulate(page: Page, key: string, ref: string, females: string) {
	await page.goto(projectPage(key, { branch: "1" }));
	await page
		.getByRole("button", { name: "Simulate", exact: true })
		.first()
		.click({ timeout: 30_000 });
	const dialog = page.getByRole("dialog");
	await dialog
		.getByLabel("Female parents", { exact: true })
		.fill(females, { timeout: 30_000 });
	await dialog.getByLabel("Male parents", { exact: true }).fill("Ler-1\nCvi-0");
	await dialog
		.getByLabel("Targets", { exact: true })
		.fill("flowering_days <= 32");
	await dialog.getByLabel(/^Progeny per cross/).fill("200");
	await expect(dialog.getByRole("checkbox", { name: ref })).toBeChecked({
		timeout: 30_000,
	});
	await dialog.getByRole("button", { name: "Run simulation" }).click();
	await expect(dialog).toBeHidden({ timeout: 30_000 });
}

test("PJ-09 a branch simulates crosses, and the result is ranked and derived", async ({
	page,
}) => {
	const key = await makeProject(page, "early flowering");
	try {
		const ref = await parentsOnBranch(page, key);
		await simulate(page, key, ref, "Col-0");

		const main = page.getByRole("main");
		await expect(main.getByText(/^Simulation s1 · /)).toBeVisible({
			timeout: 30_000,
		});
		await expect(main.getByText("derived", { exact: true })).toBeVisible();
		await expect(main.getByRole("cell", { name: /×/ }).first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(
			main.getByRole("button", { name: "Save as dataset" }),
		).toBeVisible();

		await page.goto(projectPage(key, { branch: "1" }));
		await expect(
			page.getByRole("tab", { name: "Simulations · 1" }),
		).toBeVisible({ timeout: 30_000 });
	} finally {
		await removeProject(page, key);
	}
});

test("PJ-09 a parent in none of the inputs fails the run with the simulator's sentence", async ({
	page,
}) => {
	const key = await makeProject(page, "missing parent");
	try {
		const ref = await parentsOnBranch(page, key);
		await simulate(page, key, ref, "Nope-9");

		const main = page.getByRole("main");
		await expect(main.getByText("The simulation failed")).toBeVisible({
			timeout: 30_000,
		});
		await expect(main.getByText(/is in none of the inputs/)).toBeVisible();
	} finally {
		await removeProject(page, key);
	}
});
