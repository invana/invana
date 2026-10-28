/**
 * The world board — `?page=world:<id>`: the head with its one act, the
 * five tiles, the five layers and the cast; and a world that is gone.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

interface WorldList {
	items: { id: string; display_name: string; kind: string }[];
}

/** `/modeller/worlds/<id>` is the Worlds page on that world; the board is its page id. */
const boardUrl = (id: string) =>
	`${GRAPH}/modeller/worlds/${id}?page=world:${id}`;

async function aWorld(page: Page) {
	const worlds = await graphApi<WorldList>(page, "/govern/lenses?kind=world");
	const world = worlds.items.find((w) => w.kind === "world");
	test.skip(!world, "this Graph has no world");
	return world as WorldList["items"][number];
}

test("a world's board reads its tiles, layers and cast, with Edit alone", async ({
	page,
}) => {
	const world = await aWorld(page);
	await page.goto(boardUrl(world.id));

	await expect(page.getByText("Five layers", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText(world.display_name).first()).toBeVisible();
	await expect(page.getByText("world", { exact: true }).first()).toBeVisible();
	await expect(page.getByText(/^used in \d+ runs$/)).toBeVisible();

	for (const tile of [
		"Rules",
		"Closed layers",
		"In force",
		"Runs",
		"Last used",
	]) {
		await expect(page.getByText(tile, { exact: true }).first()).toBeVisible();
	}
	for (const layer of ["graph data", "llm", "third party", "human"]) {
		await expect(page.getByText(layer, { exact: true }).first()).toBeVisible();
	}
	// No compute layer is governed, so none is drawn.
	await expect(page.getByText("compute", { exact: true })).toHaveCount(0);
	await expect(page.getByText("Cast", { exact: true })).toBeVisible();
	await expect(page.getByText("who runs inside it")).toBeVisible();

	// One act; the report and view switches are gone.
	await expect(
		page.getByRole("button", { name: "Edit", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Save report" })).toHaveCount(
		0,
	);
	await expect(page.getByText("spec.json", { exact: true })).toHaveCount(0);
});

test("a world that does not exist says it is gone", async ({ page }) => {
	await page.goto(boardUrl("00000000-0000-0000-0000-000000000000"));
	await expect(page.getByText("This world is gone")).toBeVisible({
		timeout: 20_000,
	});
});
