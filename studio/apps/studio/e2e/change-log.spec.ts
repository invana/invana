/**
 * The change log and publish review — one test per story (SH-14 · MO-09 ·
 * MO-05 · DS-04).
 *
 * Nothing here calls a live model or writes to the graph database. SH-14 makes
 * an `e2e-` agent and publishes its instructions once, so it has two versions
 * to compare, and deletes it in `finally`. MO-05 stages changes on the
 * AirRoutes draft (app state only), reads the Publish confirm without
 * submitting it, and discards the draft before it starts and in `finally`. Needs `demos/airways`;
 * DS-04 reads the dataset `datasets.spec.ts` makes.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

interface Model {
	id: string;
	name: string;
}

interface Version {
	id: string;
	status: string;
}

async function airRoutes(page: Page): Promise<Model> {
	const models = await graphApi<Model[]>(page, "/models");
	const model = models.find((m) => m.name === "AirRoutes");
	expect(model, "the AirRoutes model").toBeTruthy();
	return model as Model;
}

/** The model's draft version — the open one, or a new one on the active. */
async function draftOf(page: Page, modelId: string): Promise<string> {
	const versions = await graphApi<Version[]>(
		page,
		`/models/${modelId}/versions`,
	);
	const open = versions.find((v) => v.status === "draft");
	if (open) return open.id;
	const made = await graphApi<{ data: Version }>(
		page,
		`/models/${modelId}/versions`,
		{ method: "POST", data: {} },
	);
	return made.data.id;
}

test("SH-14 · a change lands in the log and Compare opens both versions", async ({
	page,
}) => {
	const name = `e2e-change-${Date.now()}`;
	const agent = await graphApi<{ id: string }>(page, "/agents", {
		method: "POST",
		data: { name, instructions: "Answer briefly." },
	});
	try {
		await graphApi(page, `/agents/${agent.id}/draft`, {
			method: "PATCH",
			data: { instructions: "Answer briefly, and cite every record." },
		});
		await graphApi(page, `/agents/${agent.id}/publish`, {
			method: "POST",
			data: { why: "Readers ask for sources" },
		});

		await page.goto(`${GRAPH}/activity/events?filter=changes`);
		await expect(
			page.getByRole("button", { name: "Changes", exact: true }),
		).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

		const row = page.getByRole("row").filter({ hasText: name }).first();
		await expect(row).toBeVisible({ timeout: 15_000 });
		await row.getByRole("button", { name: "Compare" }).click();

		await expect(page).toHaveURL(/\/activity\/changes\/agent\//);
		await expect(page.getByLabel("From version")).toBeVisible();
		await expect(page.getByLabel("To version")).toBeVisible();
	} finally {
		await graphApi(page, `/agents/${agent.id}`, { method: "DELETE" }).catch(
			() => {},
		);
	}
});

test("MO-09 · a model's History lists its versions", async ({ page }) => {
	const model = await airRoutes(page);
	await page.goto(
		`${GRAPH}/modeller/models?model=${model.id}&models_tab=history`,
	);
	await expect(page.getByText("Versions", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("v1.0.1").first()).toBeVisible();
});

test("MO-05 · Publish names who reads the model, and a breaking draft asks for approval", async ({
	page,
}) => {
	const model = await airRoutes(page);
	const draft = await draftOf(page, model.id);
	// Start from the published state: a run cut short before its `finally`
	// leaves `region` deleted, and every later run would open on a breaking draft.
	await graphApi(page, `/models/${model.id}/draft/discard`, {
		method: "POST",
		data: {},
	});
	const keys = `/models/${model.id}/versions/${draft}/property-keys`;
	try {
		await graphApi(page, keys, {
			method: "POST",
			data: { name: `e2e_note_${Date.now()}`, type: "string" },
		});
		// All models shows the draft on the Comparing bar, on screen.
		await page.goto(`${GRAPH}/modeller/models?models_tab=model`);
		await expect(
			page.getByRole("button", { name: "Review and publish" }),
		).toBeInViewport({ timeout: 30_000 });

		await page.goto(`${GRAPH}/modeller/models?model=${model.id}`);
		const publish = page.getByRole("button", { name: /^Publish/ }).first();
		await expect(publish).toBeEnabled({ timeout: 30_000 });
		await publish.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("Who reads AirRoutes")).toBeVisible({
			timeout: 15_000,
		});
		await expect(dialog.getByText("— breaking")).toHaveCount(0);
		await dialog.getByRole("button", { name: "Cancel" }).click();

		// Removing a property a published type reads makes the draft breaking.
		const version = await graphApi<{
			property_keys: { id: string; name: string }[];
		}>(page, `/models/${model.id}/versions/${draft}`);
		const region = version.property_keys.find((k) => k.name === "region");
		expect(region, "the region property").toBeTruthy();
		await graphApi(page, `${keys}/${region?.id}`, { method: "DELETE" });

		await page.reload();
		await page
			.getByRole("button", { name: /^Publish/ })
			.first()
			.click({ timeout: 30_000 });
		await expect(dialog.getByText(/— breaking/)).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			dialog.getByRole("button", { name: "Request approval" }),
		).toBeVisible();
		await expect(dialog.getByText("Who reads AirRoutes")).toBeVisible();
	} finally {
		await graphApi(page, `/models/${model.id}/draft/discard`, {
			method: "POST",
			data: {},
		}).catch(() => {});
	}
});

test("DS-04 · a record's change log names who made each version", async ({
	page,
}) => {
	await page.goto("/datasets/catalogue/admin/e2e-varieties/records/kak-2");
	await expect(page.getByText("Change log", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("cell", { name: "admin" }).first()).toBeVisible();
});
