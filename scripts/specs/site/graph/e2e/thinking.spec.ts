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
	nodes: { id: string; kind: string }[];
	edges: { source: string; target: string; type: string }[];
	analysis: { cycles: string[][]; chains: string[][]; orphans: string[] };
};
/** A feature something depends on, so its blast radius reaches past itself. */
const depended = graph.edges.find(
	(e) =>
		e.type === "DEPENDS_ON" &&
		graph.nodes.find((n) => n.id === e.target)?.kind === "Feature",
)?.target;

const app = (page: Page) => page.frameLocator("iframe.spec-graph-app");

function errorsOf(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	return errors;
}

/** Open /graph on the spec graph (the page opens on Journeys) and wait for the first draw. */
async function open(page: Page, query = "?view=spec") {
	await page.goto(`graph/${query}`);
	const frame = app(page);
	await expect(frame.getByText(/of \d+ nodes/)).toBeVisible({
		timeout: 30_000,
	});
	return frame;
}

test("the Analysis panel lists the parse's loops, chains and orphans, and highlights a loop", async ({
	page,
}) => {
	const errors = errorsOf(page);
	const frame = await open(page);
	await frame.getByRole("button", { name: "Analysis" }).click();
	const loops = frame.getByRole("region", { name: "Loops" });
	await expect(loops).toContainText(String(graph.analysis.cycles.length));
	await expect(frame.getByRole("region", { name: "Orphans" })).toContainText(
		String(graph.analysis.orphans.length),
	);
	test.skip(graph.analysis.cycles.length === 0, "no loop in the parse");
	await loops.getByRole("button", { name: /^Loop 1/ }).click();
	await expect(frame.getByText(/^Loop 1 · \d+ shown/)).toBeVisible();
	expect(errors).toEqual([]);
});

/** What the live canvas draws now: its nodes with their kind and position, the hulls, and the density layer. */
interface Drawn {
	nodes: { id: string; type: string; x: number; y: number }[];
	sets: { id: string; members: readonly string[] }[];
	contour: boolean;
}

async function drawn(page: Page): Promise<Drawn> {
	const frame = page.frames().find((f) => f.url().includes("/graph/app/"));
	if (!frame) throw new Error("the graph app's frame is not loaded");
	return frame.evaluate(() => {
		const c = window.specGraphCanvas;
		if (!c) return { nodes: [], sets: [], contour: false };
		const store =
			c.layers.get<import("@invana/graph").GraphLayer>("graph")?.store;
		const nodes = store
			? [...store.nodes()].map((n) => {
					const p = store.getPosition(n.id);
					return { id: n.id, type: n.type, x: p?.x ?? 0, y: p?.y ?? 0 };
				})
			: [];
		const groups =
			c.layers.get<import("@invana/graph-layer-bubble-sets").BubbleSetsLayer>(
				"groups",
			);
		const sets = (groups?.getSets() ?? []).map((s) => ({
			id: s.id,
			members: s.members,
		}));
		return { nodes, sets, contour: !!c.layers.get("unready-density") };
	});
}

/** The median x of each kind's nodes. */
function medianX(nodes: Drawn["nodes"], kind: string): number {
	const xs = nodes
		.filter((n) => n.type === kind)
		.map((n) => n.x)
		.sort((a, b) => a - b);
	return xs[Math.floor(xs.length / 2)] ?? Number.NaN;
}

async function pick(page: Page, control: RegExp, option: string) {
	const frame = app(page);
	await frame.getByRole("button", { name: control }).click();
	await frame.getByText(option, { exact: true }).click();
}

test("the flow layout draws story → feature → NFR → section columns", async ({
	page,
}) => {
	const errors = errorsOf(page);
	const frame = await open(page);
	await pick(page, /^Layout:/, "Flow (d3-sankey)");
	await expect(
		frame.getByRole("button", { name: "Layout: Flow (d3-sankey)" }),
	).toBeVisible();
	// The page's own picker names the layout; the toolbar draws no second one.
	await expect(frame.getByText("Force (d3)", { exact: true })).toHaveCount(0);
	const columns = ["Story", "Feature", "NFR", "DesignSection"];
	await expect
		.poll(
			async () => {
				const { nodes } = await drawn(page);
				return [
					[...new Set(nodes.map((n) => n.type))].sort(),
					columns
						.map((k) => medianX(nodes, k))
						.every((x, i, all) => (i === 0 ? true : x > all[i - 1])),
				];
			},
			{ timeout: 30_000 },
		)
		.toEqual([[...columns].sort(), true]);
	expect(errors).toEqual([]);
});

test("Group by draws one hull per product, then one per loop", async ({
	page,
}) => {
	const errors = errorsOf(page);
	const frame = await open(page);
	await pick(page, /^Groups:/, "Group by product");
	await expect(
		frame.getByRole("button", { name: "Groups: Group by product" }),
	).toBeVisible();
	// A hull per product with two or more nodes drawn, around exactly those nodes.
	await expect
		.poll(async () => {
			const { nodes, sets } = await drawn(page);
			const shown = new Set(nodes.map((n) => n.id));
			return (
				sets.length > 0 &&
				sets.every(
					(s) =>
						s.id.startsWith("product:") &&
						s.members.length > 1 &&
						s.members.every((m) => shown.has(m)),
				)
			);
		})
		.toBe(true);

	await pick(page, /^Groups:/, "Group by loop");
	await expect(
		frame.getByRole("button", { name: "Groups: Group by loop" }),
	).toBeVisible();
	// A hull per loop of the parse with two or more of its nodes drawn — none when nothing loops.
	await expect
		.poll(async () => {
			const { nodes, sets } = await drawn(page);
			const shown = new Set(nodes.map((n) => n.id));
			const loops = graph.analysis.cycles.filter(
				(c) => c.filter((id) => shown.has(id)).length > 1,
			).length;
			return (
				sets.length === loops && sets.every((s) => s.id.startsWith("loop:"))
			);
		})
		.toBe(true);
	expect(errors).toEqual([]);
});

test("the unready density adds its contour layer, and removes it", async ({
	page,
}) => {
	const errors = errorsOf(page);
	const frame = await open(page);
	expect((await drawn(page)).contour).toBe(false);
	await frame
		.getByRole("button", {
			name: "Show where idea and placeholder nodes crowd",
		})
		.click();
	await expect.poll(async () => (await drawn(page)).contour).toBe(true);
	await frame.getByRole("button", { name: "Hide the unready density" }).click();
	await expect.poll(async () => (await drawn(page)).contour).toBe(false);
	expect(errors).toEqual([]);
});

test("each Analysis section links to its page on the site", async ({
	page,
}) => {
	const sections: [string, RegExp][] = [
		["Loops", /\/loops\/$/],
		["Blocking chains", /\/loops\/#chains$/],
		["Gaps", /\/gaps\/$/],
		["Orphans", /\/orphans\/$/],
	];
	for (const [title, url] of sections) {
		const frame = await open(page);
		await frame.getByRole("button", { name: "Analysis" }).click();
		await frame.getByRole("button", { name: `${title} on the site` }).click();
		await expect(page).toHaveURL(url);
		await expect(page.locator("h1").first()).toBeVisible();
	}
});

/**
 * Where node `id` is on the page now, once the pointer there names it in the status bar. The camera zooms onto it
 * first, so the node — not an edge across it — is under the pointer; the page point is solved from the status
 * bar's world *Pointer* read at two page points, so it needs no knowledge of the renderer's scale. Retried while
 * the camera glides.
 */
async function onScreen(page: Page, id: string) {
	const frame = page.frames().find((f) => f.url().includes("/graph/app/"));
	const world = await frame?.evaluate((nodeId) => {
		const layer =
			window.specGraphCanvas?.layers.get<import("@invana/graph").GraphLayer>(
				"graph",
			);
		layer?.focusNode(nodeId, { zoom: 2 });
		const p = layer?.store.getPosition(nodeId);
		return p ? { x: p.x, y: p.y } : null;
	}, id);
	if (!world) throw new Error(`${id} is not drawn`);
	const pointer = app(page).getByText(/Pointer: -?\d/);
	const read = async (x: number, y: number) => {
		await page.mouse.move(x, y);
		const m = /Pointer: (-?[\d.]+), (-?[\d.]+)/.exec(
			(await pointer.textContent()) ?? "",
		);
		return { x: Number(m?.[1]), y: Number(m?.[2]) };
	};
	let point = { id, x: 0, y: 0 };
	await expect(async () => {
		const box = await graphBox(page);
		const a = { x: box.x + box.width / 3, y: box.y + box.height / 3 };
		const b = { x: a.x + 200, y: a.y + 200 };
		const wa = await read(a.x, a.y);
		const wb = await read(b.x, b.y);
		const centre = {
			x: a.x + ((world.x - wa.x) * 200) / (wb.x - wa.x),
			y: a.y + ((world.y - wa.y) * 200) / (wb.y - wa.y),
		};
		// Edges meet at the node's centre and win the hit there: step out until the node's own body is hit.
		for (let r = 0; r <= 90; r += 10)
			for (const [dx, dy] of [
				[0, 0],
				[r, r],
				[-r, r],
				[r, -r],
				[-r, -r],
				[0, r],
				[r, 0],
				[0, -r],
				[-r, 0],
			]) {
				point = { id, x: centre.x + dx, y: centre.y + dy };
				await page.mouse.move(point.x, point.y);
				const hovered = await app(page)
					.getByText(/Hovered Node/)
					.allTextContents();
				if (hovered.some((t) => t.includes(`ID: ${id}]`))) return;
			}
		throw new Error(`the pointer never lands on ${id}`);
	}).toPass({ timeout: 20_000 });
	return point;
}

/** The graph's canvas on the page — the largest one; the minimap draws on its own. */
async function graphBox(page: Page) {
	let box = { x: 0, y: 0, width: 0, height: 0 };
	for (const c of await app(page).locator("canvas").all()) {
		const b = await c.boundingBox();
		if (b && b.width * b.height > box.width * box.height) box = b;
	}
	return box;
}

/**
 * Move the pointer over the graph until the status bar names a hovered node; return its id and where it is. The
 * layout is force-directed, so where a node lands is not known ahead.
 */
async function pointAtNode(page: Page) {
	const frame = app(page);
	// The frame is taller than the window: bring all of it into view.
	await page.setViewportSize({ width: 1600, height: 1600 });
	await page
		.locator("iframe.spec-graph-app")
		.evaluate((el) => el.scrollIntoView({ block: "start" }));
	// The graph's canvas is the largest one; the minimap draws on its own.
	let box = { x: 0, y: 0, width: 0, height: 0 };
	for (const c of await frame.locator("canvas").all()) {
		const b = await c.boundingBox();
		if (b && b.width * b.height > box.width * box.height) box = b;
	}
	const hovered = frame.getByText(/Hovered Node/);
	for (let y = box.y + 60; y < box.y + box.height - 60; y += 14)
		for (let x = box.x + 60; x < box.x + box.width - 60; x += 14) {
			await page.mouse.move(x, y);
			if (await hovered.isVisible()) {
				const text = (await hovered.textContent()) ?? "";
				const id = /ID: ([^\]]+)\]/.exec(text)?.[1];
				if (id) return { id, x, y };
			}
		}
	throw new Error("no node under the pointer anywhere");
}

test("a node's right-click menu shows a path to another node and its blast radius", async ({
	page,
}) => {
	test.skip(!depended, "no feature is depended on");
	const errors = errorsOf(page);
	const frame = await open(page, `?focus=${depended}`);
	await expect(frame.getByText(`Focused on ${depended}`)).toBeVisible({
		timeout: 30_000,
	});
	const from = await pointAtNode(page);
	await page.mouse.click(from.x, from.y, { button: "right" });
	await frame.getByText("Path from here…", { exact: true }).click();
	await expect(
		frame.getByText(`Path from ${from.id} — right-click`),
	).toBeVisible();
	// The camera has not moved yet: the same point is the same node.
	await page.mouse.click(from.x, from.y, { button: "right" });
	await frame.getByText("Blast radius", { exact: true }).click();
	// The Analysis panel names the highlight; the message bar says how much of it is shown.
	const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const label = new RegExp(`^Blast radius of ${esc(from.id)} · \\d+ reached`);
	await expect(frame.getByText(label)).toHaveCount(2);
	// The highlight framed its reach: the path ends at a node it depends on, found where the camera now put it.
	const shown = new Set((await drawn(page)).nodes.map((n) => n.id));
	const next = graph.edges
		.filter((e) => e.source === from.id || e.target === from.id)
		.map((e) => (e.source === from.id ? e.target : e.source))
		.find((id) => id !== from.id && shown.has(id));
	test.skip(!next, `nothing drawn is next to ${from.id}`);
	const to = await onScreen(page, next ?? "");
	await page.mouse.click(to.x, to.y, { button: "right" });
	await frame
		.getByText(`Path from ${from.id} to here`, { exact: true })
		.click();
	// Either the path, named end to end, or the message that there is none in this view.
	const path = new RegExp(
		`^Path ${esc(from.id)} → (.+ → )?${esc(to.id)}( ·|$)`,
	);
	const none = `No path from ${from.id} to ${to.id} in this view`;
	await expect(
		frame
			.getByText(path)
			.or(frame.getByText(none, { exact: true }))
			.first(),
	).toBeVisible();
	expect(errors).toEqual([]);
});
