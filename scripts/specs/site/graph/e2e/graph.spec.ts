import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/** The parse the site build wrote beside the app — the same one the page loads. */
const graph = JSON.parse(
	readFileSync(
		resolve(import.meta.dirname, "../../build/graph/app/specs-graph.json"),
		"utf-8",
	),
) as {
	nodes: { id: string; kind: string; path: string | null }[];
	edges: { source: string; type: string }[];
};
const feature = graph.nodes.find((n) => n.kind === "Feature" && n.path);
/** A story on a journey's diagram — its `NEXT` edges are what the Journeys view draws. */
const onJourney = graph.edges.find(
	(e) =>
		e.type === "NEXT" &&
		graph.nodes.find((n) => n.id === e.source)?.kind === "Story",
)?.source;

/** The app inside the /graph page's frame. */
const app = (page: Page) => page.frameLocator("iframe.spec-graph-app");

/** Page errors, so a spec fails on an uncaught one. */
function errorsOf(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	return errors;
}

test("the /graph page draws the parse with its chrome", async ({ page }) => {
	const errors = errorsOf(page);
	await page.goto("graph/?view=spec");
	const frame = app(page);
	await expect(frame.locator("canvas").first()).toBeVisible();
	await expect(
		frame.getByText(new RegExp(`of ${graph.nodes.length} nodes`)),
	).toBeVisible({ timeout: 30_000 });
	await expect(frame.getByRole("region", { name: "Kind" })).toBeVisible();
	expect(errors).toEqual([]);
});

test("Show in graph opens the graph focused on that node", async ({ page }) => {
	test.skip(!feature, "no feature in the parse");
	const errors = errorsOf(page);
	await page.goto(`graph/?focus=${encodeURIComponent(feature?.id ?? "")}`);
	await expect(app(page).getByText(`Focused on ${feature?.id}`)).toBeVisible({
		timeout: 30_000,
	});
	expect(errors).toEqual([]);
});

test("a spec page links to the graph, focused on its node", async ({
	page,
}) => {
	const path = (feature?.path ?? "")
		.replace(/^specs\//, "")
		.replace(/\.md$/, "/");
	await page.goto(path);
	const link = page.getByRole("link", { name: "Show in graph" }).first();
	await expect(link).toHaveAttribute(
		"href",
		new RegExp(`graph/\\?focus=${encodeURIComponent(feature?.id ?? "")}$`),
	);
});

test("an unknown focus id opens the whole graph, unfocused", async ({
	page,
}) => {
	const errors = errorsOf(page);
	await page.goto("graph/?focus=NO-SUCH-ID");
	const frame = app(page);
	await expect(
		frame.getByText(new RegExp(`of ${graph.nodes.length} nodes`)),
	).toBeVisible({ timeout: 30_000 });
	await expect(frame.getByText("Focused on")).toHaveCount(0);
	expect(errors).toEqual([]);
});

test("the Journeys view opens by default, and unticking a story hides it", async ({
	page,
}) => {
	const errors = errorsOf(page);
	await page.goto("graph/");
	const frame = app(page);
	const legend = frame.getByLabel("Canvas legend");
	await expect(legend).toBeVisible({ timeout: 30_000 });
	// The legend starts folded to its bar, off the graph; it opens on demand.
	const expand = legend.getByRole("button", { name: "Expand" });
	await expect(expand).toHaveAttribute("aria-expanded", "false");
	await expand.click();
	await expect(legend.getByText("Journeys")).toBeVisible();
	const message = frame.getByText(/^\d+ of \d+ stories/);
	await expect(message).toBeVisible({ timeout: 30_000 });
	const [, shown, total] =
		/^(\d+) of (\d+) stories/.exec((await message.textContent()) ?? "") ?? [];
	expect(shown).toBe(total);
	test.skip(!onJourney, "no story on a journey");
	await frame.getByLabel("Search the filter").fill(onJourney ?? "");
	await frame
		.getByRole("tree", { name: "Products" })
		.getByRole("checkbox", { name: `Show ${onJourney} · `, exact: false })
		.first()
		.click();
	await expect(
		frame.getByText(new RegExp(`^${Number(total) - 1} of ${total} stories`)),
	).toBeVisible();
	expect(errors).toEqual([]);
});

/** The Group by hulls drawn now, and the ids of the stories on the canvas. */
async function hulls(page: Page) {
	const f = page.frames().find((x) => x.url().includes("/graph/app/"));
	if (!f) throw new Error("the graph app's frame is not loaded");
	return f.evaluate(() => {
		const c = window.specGraphCanvas;
		const store =
			c?.layers.get<import("@invana/graph").GraphLayer>("graph")?.store;
		const stories = store
			? [...store.nodes()].filter((n) => n.type === "Story").map((n) => n.id)
			: [];
		const sets = (
			c?.layers
				.get<import("@invana/graph-layer-bubble-sets").BubbleSetsLayer>(
					"groups",
				)
				?.getSets() ?? []
		).map((s) => ({ id: s.id, members: [...s.members] }));
		return { stories, sets };
	});
}

test("Group by on the Journeys view draws a hull per group, kept in the address", async ({
	page,
}) => {
	const errors = errorsOf(page);
	await page.goto("graph/");
	const frame = app(page);
	await expect(frame.getByText(/^\d+ of \d+ stories/)).toBeVisible({
		timeout: 30_000,
	});
	expect((await hulls(page)).sets).toEqual([]);

	await frame.getByRole("button", { name: /^Group by:/ }).click();
	await frame.getByText("Persona", { exact: true }).click();
	// A hull per persona the drawn stories serve, around drawn stories only.
	await expect
		.poll(async () => {
			const { stories, sets } = await hulls(page);
			const drawn = new Set(stories);
			return (
				sets.length > 0 &&
				sets.every(
					(s) =>
						s.id.startsWith("persona:") &&
						s.members.length > 0 &&
						s.members.every((m) => drawn.has(m)),
				)
			);
		})
		.toBe(true);
	expect(page.url()).toContain("group=persona");
	const legend = frame.getByLabel("Canvas legend");
	await legend.getByRole("button", { name: "Expand" }).click();
	await expect(legend.getByText("Groups · Persona")).toBeVisible();

	// The address reopens it: one hull per journey.
	await page.goto("graph/?group=journey");
	await expect
		.poll(async () => {
			const { sets } = await hulls(page);
			return sets.length > 0 && sets.every((s) => s.id.startsWith("journey:"));
		})
		.toBe(true);
	expect(errors).toEqual([]);
});
