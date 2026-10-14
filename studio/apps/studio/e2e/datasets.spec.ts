import { expect, type Page, test } from "@playwright/test";
import { api } from "./api";

/**
 * Datasets is install-wide: its routes start at `/datasets`, with no Graph in
 * the path. One test per story (datasets.md DS-01…DS-14).
 *
 * The records are made here through the engine's API, named `e2e-…` so a
 * re-run reuses them: a dataset or standard that exists answers 409, and a
 * version identical to the current one answers 409 *unchanged* — both fine.
 * The shared fixtures are only read, so their version count stays fixed. The
 * two stories that mint a version (DS-05, DS-07) write to a dataset of their
 * own, made per run — the engine never deletes a dataset, so a shared one
 * would gain a version every run. The signed-in user is an install Admin, so
 * it publishes as `admin`.
 */

const VARIETIES = "admin/e2e-varieties";
const WITHDRAWN = "admin/e2e-withdrawn";
const SEED_TYPES = "admin/e2e-seed-types";

const ORIGINAL = [{ role: "original", kind: "organisation", name: "E2E lab" }];

async function dataset(
	page: Page,
	name: string,
	title: string,
	origin: string,
	key: string,
	records: Record<string, unknown>[],
) {
	await api(page, "/datasets", {
		method: "POST",
		data: { name, title, origin, key_column: key },
		accept: [409],
	});
	await api(page, `/datasets/admin/${name}/versions`, {
		method: "POST",
		data: {
			licence: "CC BY 4.0",
			author_chain: origin === "observed" ? [] : ORIGINAL,
			records,
		},
		accept: [409],
	});
}

/** A dataset of this run's own, for a story that mints a version. */
async function ownDataset(
	page: Page,
	prefix: string,
	title: string,
	origin: string,
	key: string,
	records: Record<string, unknown>[],
): Promise<string> {
	const name = `${prefix}-${Date.now()}`;
	await dataset(page, name, title, origin, key, records);
	return `admin/${name}`;
}

/** The two datasets and the standard every story reads. */
async function seed(page: Page) {
	await dataset(page, "e2e-varieties", "E2E varieties", "collected", "id", [
		{ id: "jg-11", name: "JG 11", seed_type: "desi" },
		{ id: "kak-2", name: "KAK 2", seed_type: "T/R" },
	]);
	await dataset(page, "e2e-withdrawn", "E2E withdrawn", "official", "id", [
		{ id: "a", value: 1 },
	]);
	await api(page, `/datasets/${WITHDRAWN}/versions/1/retract`, {
		method: "POST",
		data: { reason: "E2E source withdrawn" },
		accept: [409],
	});
	await api(page, "/standards", {
		method: "POST",
		data: {
			name: "e2e-seed-types",
			title: "E2E seed types",
			terms: [
				{
					name: "seed_type",
					values: [{ code: "desi" }, { code: "kabuli" }],
				},
			],
		},
		accept: [409],
	});
	await api(page, `/datasets/${VARIETIES}/standards`, {
		method: "POST",
		data: { standard: SEED_TYPES, mode: "warn" },
	});
}

const at = (address: string, rest = "") =>
	`/datasets/catalogue/${address}${rest ? `/${rest}` : ""}`;

test.beforeEach(async ({ page }) => {
	await seed(page);
});

test("DS-01 · the catalogue narrows by origin and opens a dataset", async ({
	page,
}) => {
	await page.goto("/datasets");
	await expect(page).toHaveURL(/\/datasets\/catalogue(\?|$)/, {
		timeout: 30_000,
	});
	for (const item of ["Catalogue", "Validation", "Standards", "Imports"]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible();
	}
	await expect(page.getByText("E2E varieties", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	// DS-06 has no collector agent to run; the act is drawn, and shut.
	await expect(
		page.getByRole("button", { name: "Collect with an agent" }),
	).toBeDisabled();

	await page.getByRole("button", { name: /^Origin/ }).click();
	await page.getByRole("menuitemradio", { name: "Official" }).click();
	await expect(page.getByText("E2E varieties", { exact: true })).toBeHidden();
	await page.getByText("E2E withdrawn", { exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${at(WITHDRAWN)}$`));
});

test("DS-02 · DS-03 · a dataset's tabs are paths that survive a reload", async ({
	page,
}) => {
	await page.goto(at(VARIETIES));
	await page.getByRole("tab", { name: "Provenance" }).click();
	await expect(page).toHaveURL(new RegExp(`${at(VARIETIES, "provenance")}$`));
	await page.reload();
	await expect(page.getByRole("tab", { name: "Provenance" })).toHaveAttribute(
		"aria-selected",
		"true",
		{ timeout: 30_000 },
	);
	await page.getByRole("tab", { name: /^Versions/ }).click();
	await expect(page).toHaveURL(new RegExp(`${at(VARIETIES, "versions")}$`));
	await expect(page.getByRole("columnheader", { name: "Hash" })).toBeVisible();
});

test("DS-04 · a record shows its values and its change log", async ({
	page,
}) => {
	await page.goto(at(VARIETIES, "records/kak-2"));
	await expect(page.getByText("T/R", { exact: true }).first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Change log", { exact: true })).toBeVisible();
});

test("DS-05 · observations by form mint the next version", async ({ page }) => {
	const trial = await ownDataset(
		page,
		"e2e-trial",
		"E2E field trial",
		"observed",
		"plot",
		[{ plot: "p-1", weight: 28 }],
	);
	await page.goto(at(trial));
	await page.getByRole("button", { name: "Add observations" }).click();
	await page.getByLabel("plot · key").fill("p-2");
	await page.getByLabel("weight").fill("31");
	await page.getByRole("button", { name: "Save 1 observation" }).click();
	// A clean save closes the form; the header names the version it minted.
	await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 });
	await expect(page.getByText(" · v2 · ", { exact: false })).toBeVisible({
		timeout: 30_000,
	});
});

test("DS-08 · a standard names its terms and who claims it", async ({
	page,
}) => {
	await page.goto("/datasets/standards");
	await page.getByPlaceholder("Search standards…").fill("e2e");
	await page.getByText("E2E seed types", { exact: true }).click();
	await expect(page).toHaveURL(/\/datasets\/standards\/admin\/e2e-seed-types$/);
	await expect(page.getByText("seed_type", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("E2E varieties", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
});

test("DS-09 · conformance names the pinned claim and its score", async ({
	page,
}) => {
	await page.goto(at(VARIETIES, "conformance"));
	await expect(
		page.getByRole("cell", { name: /^E2E seed types\s*@v1/ }),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("50% · 1 of 2")).toBeVisible();
	await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
});

test("DS-11 · a bind starts from the dataset's current version", async ({
	page,
}) => {
	await page.goto(at(VARIETIES));
	await page.getByRole("button", { name: "Bind to a Graph" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText(/^E2E varieties · v\d+$/)).toBeVisible({
		timeout: 30_000,
	});
	await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("DS-12 · the publisher shares a dataset with the install", async ({
	page,
}) => {
	await api(page, `/datasets/${VARIETIES}`, {
		method: "PATCH",
		data: { visibility: "private" },
	});
	await page.goto(at(VARIETIES));
	await page.getByRole("button", { name: "Share" }).click();
	await page.getByRole("radio", { name: "Everyone in this install" }).click();
	await page.getByRole("button", { name: "Share with the install" }).click();
	await expect(page.getByText("shared", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
});

test("DS-14 · a retracted version is kept and flagged", async ({ page }) => {
	await page.goto(at(WITHDRAWN, "versions"));
	await expect(page.getByText("v1 retracted", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByText(/^retracted · E2E source withdrawn/),
	).toBeVisible();
});

test("DS-07 · a violation is fixed with a reason, as the next version", async ({
	page,
}) => {
	const fixable = await ownDataset(
		page,
		"e2e-fixable",
		"E2E fixable",
		"collected",
		"id",
		[{ id: "kak-2", seed_type: "T/R" }],
	);
	await api(page, `/datasets/${fixable}/standards`, {
		method: "POST",
		data: { standard: SEED_TYPES, mode: "warn" },
	});
	await page.goto(`/datasets/validation?dataset=${fixable}`);
	await page.getByText("kak-2 · seed_type", { exact: true }).click();
	await expect(page).toHaveURL(
		new RegExp(`/datasets/validation/${fixable}/kak-2/seed_type$`),
	);
	await page.getByLabel("seed_type").fill("kabuli");
	await page.getByLabel("Reason").fill("E2E: typo on the source page");
	await page
		.getByRole("button", { name: "Publish the fix as the next version" })
		.click();
	await expect(page.getByText(/^Published v\d+/)).toBeVisible({
		timeout: 30_000,
	});
});

test("DS-13 · Imports reads the loads of every Graph", async ({ page }) => {
	await page.goto("/datasets/catalogue");
	await page.locator('button[aria-label="Imports"]').click();
	await expect(page).toHaveURL(/\/datasets\/imports(\?|$)/);
	await expect(page.getByText("Imports a day", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText(/^across \d+ Graphs?$/)).toBeVisible({
		timeout: 30_000,
	});
});
